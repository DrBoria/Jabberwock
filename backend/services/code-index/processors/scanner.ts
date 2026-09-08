import { listFiles } from "@services/glob/list-files"
import { VirtualWorkspace } from "@features/foundation/time-machine/VirtualWorkspace"
import { Ignore } from "ignore"
import { readIgnoreFile, filterPaths } from "@utils/ignore"
import { getWorkspacePathForContext } from "@utils/io/path"
import { getConfiguration } from "@features/foundation/capabilities/registry"
import { CodeBlock, ICodeParser, IEmbedder, IVectorStore, IDirectoryScanner } from "@services/code-index/interfaces"
import pLimit from "p-limit"
import { Mutex } from "async-mutex"
import { CacheManager } from "@services/code-index/cache-manager"
import {
	MAX_LIST_FILES_LIMIT_CODE_INDEX,
	BATCH_SEGMENT_THRESHOLD,
	PARSING_CONCURRENCY,
	BATCH_PROCESSING_CONCURRENCY,
} from "@services/code-index/constants"
import { Package } from "@shared/package"
import { BatchContext, handleFileError } from "./scannerHelpers"
import {
	accumulateBlocks,
	filterSupportedPaths,
	flushBatch,
	handleDeletedFiles,
	processScanBatch,
	readAndParseFile,
} from "./scannerProcessing"

export class DirectoryScanner implements IDirectoryScanner {
	private readonly virtualWorkspace = new VirtualWorkspace()
	private readonly batchSegmentThreshold: number

	constructor(
		private readonly embedder: IEmbedder,
		private readonly qdrantClient: IVectorStore,
		private readonly codeParser: ICodeParser,
		private readonly cacheManager: CacheManager,
		private readonly ignoreInstance: Ignore,
		batchSegmentThreshold?: number,
	) {
		if (batchSegmentThreshold !== undefined) {
			this.batchSegmentThreshold = batchSegmentThreshold
		} else {
			try {
				// D4g-2 (batch 3): config read via the capability slot (D4b).
				this.batchSegmentThreshold =
					getConfiguration().get<number>(
						Package.name,
						"codeIndex.embeddingBatchSize",
						BATCH_SEGMENT_THRESHOLD,
					) ?? BATCH_SEGMENT_THRESHOLD
			} catch {
				this.batchSegmentThreshold = BATCH_SEGMENT_THRESHOLD
			}
		}
	}

	public async scanDirectory(
		directory: string,
		onError?: (error: Error) => void,
		onBlocksIndexed?: (indexedCount: number) => void,
		onFileParsed?: (fileBlockCount: number) => void,
		signal?: AbortSignal,
	): Promise<{ stats: { processed: number; skipped: number }; totalBlockCount: number }> {
		const directoryPath = directory
		const scanWorkspace = getWorkspacePathForContext(directoryPath)

		const [allPaths] = await listFiles(directoryPath, true, MAX_LIST_FILES_LIMIT_CODE_INDEX, this.virtualWorkspace)

		const filePaths = allPaths.filter((p) => !p.endsWith("/"))

		const ignorePatterns = await readIgnoreFile(directoryPath)
		const allowedPaths = filterPaths(ignorePatterns, filePaths, directoryPath)

		const supportedPaths = filterSupportedPaths(this.ignoreInstance, allowedPaths, scanWorkspace)

		const processedFiles = new Set<string>()
		let processedCount = 0
		let skippedCount = 0

		const parseLimiter = pLimit(PARSING_CONCURRENCY)
		const batchLimiter = pLimit(BATCH_PROCESSING_CONCURRENCY)
		const mutex = new Mutex()

		let currentBatchBlocks: CodeBlock[] = []
		let currentBatchTexts: string[] = []
		let currentBatchFileInfos: { filePath: string; fileHash: string; isNew: boolean }[] = []
		const activeBatchPromises = new Set<Promise<void>>()
		let pendingBatchCount = 0

		const context: BatchContext = {
			currentBatchBlocks,
			currentBatchTexts,
			currentBatchFileInfos,
			activeBatchPromises,
			pendingBatchCount,
			totalBlockCount: 0,
			mutex,
			batchLimiter,
			scanWorkspace,
			onError,
			onBlocksIndexed,
		}

		const parsePromises = supportedPaths.map((filePath) =>
			parseLimiter(async () => {
				if (signal?.aborted) return

				try {
					const result = await readAndParseFile(
						this.cacheManager,
						this.codeParser,
						filePath,
						scanWorkspace,
						signal,
					)
					if (!result) {
						skippedCount++
						return
					}

					const { currentFileHash, isNewFile, blocks, fileBlockCount } = result
					processedFiles.add(filePath)
					onFileParsed?.(fileBlockCount)
					processedCount++

					const hasEmbedderAndClient = this.embedder && this.qdrantClient
					if (hasEmbedderAndClient && blocks.length > 0) {
						await accumulateBlocks(
							this.batchSegmentThreshold,
							blocks,
							currentFileHash,
							isNewFile,
							filePath,
							fileBlockCount,
							signal,
							context,
							processScanBatch,
							this.embedder,
							this.qdrantClient,
							this.cacheManager,
						)
					} else {
						await this.cacheManager.updateHash(filePath, currentFileHash)
					}
				} catch (error) {
					handleFileError(error, filePath, scanWorkspace, onError)
				}
			}),
		)

		await Promise.all(parsePromises)

		if (signal?.aborted) {
			return {
				stats: { processed: processedCount, skipped: skippedCount },
				totalBlockCount: context.totalBlockCount,
			}
		}

		await flushBatch(context, processScanBatch, this.embedder, this.qdrantClient, this.cacheManager)

		await Promise.all(activeBatchPromises)

		if (signal?.aborted) {
			return {
				stats: { processed: processedCount, skipped: skippedCount },
				totalBlockCount: context.totalBlockCount,
			}
		}

		await handleDeletedFiles(this.cacheManager, this.qdrantClient, processedFiles, scanWorkspace, onError)

		return {
			stats: { processed: processedCount, skipped: skippedCount },
			totalBlockCount: context.totalBlockCount,
		}
	}
}

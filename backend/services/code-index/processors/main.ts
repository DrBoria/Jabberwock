import { listFiles } from "@services/glob"
import { VirtualWorkspace } from "@features/foundation/time-machine"
import { Ignore } from "ignore"
import { readIgnoreFile, filterPaths } from "@utils/ignore"
import { getWorkspacePathForContext } from "@utils/io/main"
import { getConfiguration } from "@features/foundation/capabilities"
import { CodeBlock, ICodeParser, IEmbedder, IVectorStore } from "@services/code-index/interfaces"
import pLimit from "p-limit"
import { Mutex } from "async-mutex"
import { CacheManager } from "@services/code-index/cache-manager"
import {
	MAX_LIST_FILES_LIMIT_CODE_INDEX,
	BATCH_SEGMENT_THRESHOLD,
	PARSING_CONCURRENCY,
	BATCH_PROCESSING_CONCURRENCY,
} from "@services/code-index/constants"
import { Package } from "@shared/core/package"
import { BatchContext, handleFileError } from "./errors"
import {
	accumulateBlocks,
	filterSupportedPaths,
	flushBatch,
	handleDeletedFiles,
	processScanBatch,
	readAndParseFile,
} from "./scannerProcessing"

export function DirectoryScanner(
	embedder: IEmbedder,
	qdrantClient: IVectorStore,
	codeParser: ICodeParser,
	cacheManager: CacheManager,
	ignoreInstance: Ignore,
	batchSegmentThreshold?: number,
) {
	let virtualWorkspace = VirtualWorkspace()
	if (batchSegmentThreshold !== undefined) {
	} else {
		try {
			// D4g-2 (batch 3): config read via the capability slot (D4b).
			batchSegmentThreshold =
				getConfiguration().get<number>(Package.name, "codeIndex.embeddingBatchSize", BATCH_SEGMENT_THRESHOLD) ??
				BATCH_SEGMENT_THRESHOLD
		} catch {
			batchSegmentThreshold = BATCH_SEGMENT_THRESHOLD
		}
	}

	const handler = {
		virtualWorkspace: virtualWorkspace,
		batchSegmentThreshold: batchSegmentThreshold,
		embedder,
		qdrantClient,
		codeParser,
		cacheManager,
		ignoreInstance,
		async scanDirectory(
			directory: string,
			onError?: (error: Error) => void,
			onBlocksIndexed?: (indexedCount: number) => void,
			onFileParsed?: (fileBlockCount: number) => void,
			signal?: AbortSignal,
		): Promise<{
			stats: {
				processed: number
				skipped: number
			}
			totalBlockCount: number
		}> {
			const directoryPath = directory
			const scanWorkspace = getWorkspacePathForContext(directoryPath)
			const [allPaths] = await listFiles(
				directoryPath,
				true,
				MAX_LIST_FILES_LIMIT_CODE_INDEX,
				handler.virtualWorkspace,
			)
			const filePaths = allPaths.filter((p) => !p.endsWith("/"))
			const ignorePatterns = await readIgnoreFile(directoryPath)
			const allowedPaths = filterPaths(ignorePatterns, filePaths, directoryPath)
			const supportedPaths = filterSupportedPaths(handler.ignoreInstance, allowedPaths, scanWorkspace)
			const processedFiles = new Set<string>()
			let processedCount = 0
			let skippedCount = 0
			const parseLimiter = pLimit(PARSING_CONCURRENCY)
			const batchLimiter = pLimit(BATCH_PROCESSING_CONCURRENCY)
			const mutex = new Mutex()
			let currentBatchBlocks: CodeBlock[] = []
			let currentBatchTexts: string[] = []
			let currentBatchFileInfos: {
				filePath: string
				fileHash: string
				isNew: boolean
			}[] = []
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
							handler.cacheManager,
							handler.codeParser,
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
						const hasEmbedderAndClient = handler.embedder && handler.qdrantClient
						if (hasEmbedderAndClient && blocks.length > 0) {
							await accumulateBlocks(
								handler.batchSegmentThreshold,
								blocks,
								currentFileHash,
								isNewFile,
								filePath,
								fileBlockCount,
								signal,
								context,
								processScanBatch,
								handler.embedder,
								handler.qdrantClient,
								handler.cacheManager,
							)
						} else {
							await handler.cacheManager.updateHash(filePath, currentFileHash)
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
			await flushBatch(context, processScanBatch, handler.embedder, handler.qdrantClient, handler.cacheManager)
			await Promise.all(activeBatchPromises)
			if (signal?.aborted) {
				return {
					stats: { processed: processedCount, skipped: skippedCount },
					totalBlockCount: context.totalBlockCount,
				}
			}
			await handleDeletedFiles(handler.cacheManager, handler.qdrantClient, processedFiles, scanWorkspace, onError)
			return {
				stats: { processed: processedCount, skipped: skippedCount },
				totalBlockCount: context.totalBlockCount,
			}
		},
	}
	return handler
}
export type DirectoryScanner = ReturnType<typeof DirectoryScanner>

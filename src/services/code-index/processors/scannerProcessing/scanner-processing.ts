import { CodeBlock, IEmbedder, IVectorStore } from "@services/code-index/interfaces"
import { CacheManager } from "@services/code-index/cache-manager"
import { MAX_BATCH_RETRIES, MAX_PENDING_BATCHES } from "@services/code-index/constants"
import {
	BatchContext,
	buildBatchPoints,
	handleBatchProcessingError,
	reportBatchFailure,
} from "@services/code-index/processors/scannerHelpers"

import { deleteExistingPoints } from "./scanner-file-utils"

export async function processScanBatch(
	embedder: IEmbedder,
	qdrantClient: IVectorStore,
	cacheManager: CacheManager,
	batchBlocks: CodeBlock[],
	batchTexts: string[],
	batchFileInfos: { filePath: string; fileHash: string; isNew: boolean }[],
	scanWorkspace: string,
	onError?: (error: Error) => void,
	onBlocksIndexed?: (indexedCount: number) => void,
): Promise<void> {
	if (batchBlocks.length === 0) return
	let attempts = 0
	let success = false
	let lastError: Error | null = null
	while (attempts < MAX_BATCH_RETRIES && !success) {
		attempts++
		try {
			await deleteExistingPoints(qdrantClient, batchFileInfos, scanWorkspace)
			const { embeddings } = await embedder.createEmbeddings(batchTexts)
			const points = buildBatchPoints(batchBlocks, embeddings, scanWorkspace)
			await qdrantClient.upsertPoints(points)
			onBlocksIndexed?.(batchBlocks.length)
			for (const fileInfo of batchFileInfos) {
				await cacheManager.updateHash(fileInfo.filePath, fileInfo.fileHash)
			}
			success = true
		} catch (error) {
			lastError = error as Error
			await handleBatchProcessingError(error, attempts, batchBlocks.length)
		}
	}
	if (!success && lastError) {
		reportBatchFailure(lastError, onError)
	}
}

export async function accumulateBlocks(
	batchSegmentThreshold: number,
	blocks: CodeBlock[],
	currentFileHash: string,
	isNewFile: boolean,
	filePath: string,
	fileBlockCount: number,
	signal: AbortSignal | undefined,
	context: BatchContext,
	processBatchFn: typeof processScanBatch,
	embedder: IEmbedder,
	qdrantClient: IVectorStore,
	cacheManager: CacheManager,
): Promise<void> {
	let addedBlocksFromFile = false
	for (const block of blocks) {
		const trimmedContent = block.content.trim()
		if (!trimmedContent) {
			continue
		}
		const release = await context.mutex.acquire()
		try {
			context.currentBatchBlocks.push(block)
			context.currentBatchTexts.push(trimmedContent)
			addedBlocksFromFile = true
			if (signal?.aborted) {
				throw new DOMException("Indexing aborted", "AbortError")
			}
			const hasReachedThreshold = context.currentBatchBlocks.length >= batchSegmentThreshold
			if (hasReachedThreshold) {
				while (context.pendingBatchCount >= MAX_PENDING_BATCHES) {
					if (signal?.aborted) {
						throw new DOMException("Indexing aborted", "AbortError")
					}
					await Promise.race(context.activeBatchPromises)
				}
				const batchBlocks = [...context.currentBatchBlocks]
				const batchTexts = [...context.currentBatchTexts]
				const batchFileInfos = [...context.currentBatchFileInfos]
				context.currentBatchBlocks = []
				context.currentBatchTexts = []
				context.currentBatchFileInfos = []
				context.pendingBatchCount++
				const batchPromise = context.batchLimiter(() =>
					processBatchFn(
						embedder,
						qdrantClient,
						cacheManager,
						batchBlocks,
						batchTexts,
						batchFileInfos,
						context.scanWorkspace,
						context.onError,
						context.onBlocksIndexed,
					),
				)
				context.activeBatchPromises.add(batchPromise)
				batchPromise.finally(() => {
					context.activeBatchPromises.delete(batchPromise)
					context.pendingBatchCount--
				})
			}
		} finally {
			release()
		}
	}
	if (addedBlocksFromFile) {
		const release = await context.mutex.acquire()
		try {
			context.totalBlockCount += fileBlockCount
			context.currentBatchFileInfos.push({
				filePath,
				fileHash: currentFileHash,
				isNew: isNewFile,
			})
		} finally {
			release()
		}
	}
}

export async function flushBatch(
	context: BatchContext,
	processBatchFn: typeof processScanBatch,
	embedder: IEmbedder,
	qdrantClient: IVectorStore,
	cacheManager: CacheManager,
): Promise<void> {
	const hasRemainingBlocks = context.currentBatchBlocks.length > 0
	if (!hasRemainingBlocks) {
		return
	}
	const release = await context.mutex.acquire()
	try {
		const batchBlocks = [...context.currentBatchBlocks]
		const batchTexts = [...context.currentBatchTexts]
		const batchFileInfos = [...context.currentBatchFileInfos]
		context.currentBatchBlocks = []
		context.currentBatchTexts = []
		context.currentBatchFileInfos = []
		context.pendingBatchCount++
		const batchPromise = context.batchLimiter(() =>
			processBatchFn(
				embedder,
				qdrantClient,
				cacheManager,
				batchBlocks,
				batchTexts,
				batchFileInfos,
				context.scanWorkspace,
				context.onError,
				context.onBlocksIndexed,
			),
		)
		context.activeBatchPromises.add(batchPromise)
		await batchPromise
	} finally {
		context.pendingBatchCount--
		release()
	}
}

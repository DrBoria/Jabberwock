import { PointStruct } from "@services/code-index/interfaces"
import { MAX_BATCH_RETRIES, INITIAL_RETRY_DELAY_MS } from "@services/code-index/constants"
import { toError } from "@services/code-index/processors/file-watcher/error-utils"
import { BatchContext } from "./helpers.types"
import { FileProcessingResult } from "@services/code-index/interfaces"

export async function upsertWithRetry(ctx: BatchContext, batch: PointStruct[]): Promise<void> {
	let retryCount = 0

	while (retryCount < MAX_BATCH_RETRIES) {
		try {
			await ctx.vectorStore!.upsertPoints(batch)
			return
		} catch (error) {
			retryCount++
			if (retryCount === MAX_BATCH_RETRIES) {
				const upsertError = toError(error)
				ctx.captureError("upsertPoints", "upsert_retry_exhausted", {
					error: upsertError.message,
					retryCount: MAX_BATCH_RETRIES,
				})
				throw new Error(`Failed to upsert batch after ${MAX_BATCH_RETRIES} retries: ${upsertError.message}`)
			}
			await new Promise((resolve) => setTimeout(resolve, INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount - 1)))
		}
	}
}

export async function upsertSegmentsWithRetry(ctx: BatchContext, pointsForBatchUpsert: PointStruct[]): Promise<void> {
	for (let i = 0; i < pointsForBatchUpsert.length; i += ctx.batchSegmentThreshold) {
		const batch = pointsForBatchUpsert.slice(i, i + ctx.batchSegmentThreshold)
		await upsertWithRetry(ctx, batch)
	}
}

export function markUpsertSuccess(
	ctx: BatchContext,
	successfullyProcessedForUpsert: Array<{ path: string; newHash?: string }>,
	batchResults: FileProcessingResult[],
): void {
	for (const { path, newHash } of successfullyProcessedForUpsert) {
		if (newHash) {
			ctx.cacheManager.updateHash(path, newHash)
		}
		batchResults.push({ path, status: "success" })
	}
}

export function markAllAsError(
	successfullyProcessedForUpsert: Array<{ path: string; newHash?: string }>,
	batchResults: FileProcessingResult[],
	error: Error,
): void {
	for (const { path } of successfullyProcessedForUpsert) {
		batchResults.push({ path, status: "error", error })
	}
}

export function handleBatchUpsertError(
	ctx: BatchContext,
	err: Error,
	successfullyProcessedForUpsert: Array<{ path: string; newHash?: string }>,
	batchResults: FileProcessingResult[],
	overallBatchError?: Error,
): Error {
	const resultError = overallBatchError || err
	ctx.captureError("executeBatchUpsertOperations", "batch_upsert_error", {
		error: err.message,
		affectedFiles: successfullyProcessedForUpsert.length,
	})
	markAllAsError(successfullyProcessedForUpsert, batchResults, err)
	return resultError
}

export async function executeBatchUpsertOperations(
	ctx: BatchContext,
	pointsForBatchUpsert: PointStruct[],
	successfullyProcessedForUpsert: Array<{ path: string; newHash?: string }>,
	batchResults: FileProcessingResult[],
	overallBatchError?: Error,
): Promise<Error | undefined> {
	const canUpsert = pointsForBatchUpsert.length > 0 && ctx.vectorStore && !overallBatchError

	if (!canUpsert) {
		if (overallBatchError && pointsForBatchUpsert.length > 0) {
			markAllAsError(successfullyProcessedForUpsert, batchResults, overallBatchError)
		}
		return overallBatchError
	}

	try {
		await upsertSegmentsWithRetry(ctx, pointsForBatchUpsert)
		markUpsertSuccess(ctx, successfullyProcessedForUpsert, batchResults)
		return undefined
	} catch (error) {
		const err = toError(error)
		return handleBatchUpsertError(ctx, err, successfullyProcessedForUpsert, batchResults, overallBatchError)
	}
}

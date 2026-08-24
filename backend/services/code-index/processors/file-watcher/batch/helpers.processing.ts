import * as vscode from "vscode"
import { FileProcessingResult, PointStruct } from "@services/code-index/interfaces"
import { toError } from "@services/code-index/processors/file-watcher/error-utils"
import { BatchContext } from "./helpers.types"

export function incrementIfNotDeleted(
	resultPath: string,
	pathsToExplicitlyDelete: string[],
	processedCountInBatch: number,
): number {
	if (pathsToExplicitlyDelete.includes(resultPath)) {
		return processedCountInBatch
	}
	return processedCountInBatch + 1
}

export function processFulfilledFileResult(
	value: { path: string; result?: FileProcessingResult; error?: Error },
	batchResults: FileProcessingResult[],
	pathsToExplicitlyDelete: string[],
	processedCountInBatch: number,
): {
	resultPath?: string
	points?: PointStruct[]
	upsertInfo?: { path: string; newHash?: string }
	updatedCount: number
} {
	const { path, result, error: directError } = value

	if (directError) {
		batchResults.push({ path, status: "error", error: directError })
		return {
			resultPath: path,
			updatedCount: incrementIfNotDeleted(path, pathsToExplicitlyDelete, processedCountInBatch),
		}
	}

	if (!result) {
		batchResults.push({
			path,
			status: "error",
			error: new Error(`Fulfilled promise with no result or error for file ${path}`),
		})
		return {
			resultPath: path,
			updatedCount: incrementIfNotDeleted(path, pathsToExplicitlyDelete, processedCountInBatch),
		}
	}

	if (result.status === "skipped" || result.status === "local_error") {
		batchResults.push(result)
		return {
			resultPath: path,
			updatedCount: incrementIfNotDeleted(path, pathsToExplicitlyDelete, processedCountInBatch),
		}
	}

	if (result.status === "processed_for_batching" && result.pointsToUpsert) {
		const upsertInfo: { path: string; newHash?: string } = { path: result.path || path }
		if (result.newHash) {
			upsertInfo.newHash = result.newHash
		}
		return {
			resultPath: path,
			points: result.pointsToUpsert,
			upsertInfo,
			updatedCount: incrementIfNotDeleted(path, pathsToExplicitlyDelete, processedCountInBatch),
		}
	}

	batchResults.push({
		path,
		status: "error",
		error: new Error(`Unexpected result status from processFile: ${result.status} for file ${path}`),
	})
	return {
		resultPath: path,
		updatedCount: incrementIfNotDeleted(path, pathsToExplicitlyDelete, processedCountInBatch),
	}
}

export function processRejectedFilePromise(
	reason: unknown,
	batchResults: FileProcessingResult[],
	pathsToExplicitlyDelete: string[],
	processedCountInBatch: number,
): {
	resultPath?: string
	updatedCount: number
} {
	const error = toError(reason)
	const rejectedPath =
		typeof reason === "object" && reason !== null && "path" in reason && typeof reason.path === "string"
			? reason.path
			: "unknown"
	console.error("[jabberwock] [FileWatcher] A file processing promise was rejected:", reason)
	batchResults.push({
		path: rejectedPath,
		status: "error",
		error,
	})
	return {
		resultPath: rejectedPath,
		updatedCount: incrementIfNotDeleted(rejectedPath, pathsToExplicitlyDelete, processedCountInBatch),
	}
}

export function processSettledFileResult(
	settledResult: PromiseSettledResult<{ path: string; result?: FileProcessingResult; error?: Error }>,
	batchResults: FileProcessingResult[],
	pathsToExplicitlyDelete: string[],
	processedCountInBatch: number,
	_totalFilesInBatch: number,
): {
	resultPath?: string
	points?: PointStruct[]
	upsertInfo?: { path: string; newHash?: string }
	updatedCount: number
} {
	if (settledResult.status === "fulfilled") {
		return processFulfilledFileResult(
			settledResult.value,
			batchResults,
			pathsToExplicitlyDelete,
			processedCountInBatch,
		)
	}
	return processRejectedFilePromise(
		settledResult.reason,
		batchResults,
		pathsToExplicitlyDelete,
		processedCountInBatch,
	)
}

export async function processSingleFile(
	ctx: BatchContext,
	fileDetail: { path: string; uri: vscode.Uri; originalType: "create" | "change" },
	_totalFilesInBatch: number,
): Promise<{ path: string; result?: FileProcessingResult; error?: Error }> {
	try {
		const result = await ctx.processFile(fileDetail.path)
		return { path: fileDetail.path, result, error: undefined }
	} catch (e) {
		const error = toError(e)
		console.error(`[jabberwock] [FileWatcher] Unhandled exception processing file ${fileDetail.path}:`, e)
		return { path: fileDetail.path, result: undefined, error }
	}
}

export async function processFilesAndPrepareUpserts(
	ctx: BatchContext,
	filesToUpsertDetails: Array<{ path: string; uri: vscode.Uri; originalType: "create" | "change" }>,
	batchResults: FileProcessingResult[],
	processedCountInBatch: number,
	totalFilesInBatch: number,
	pathsToExplicitlyDelete: string[],
): Promise<{
	pointsForBatchUpsert: PointStruct[]
	successfullyProcessedForUpsert: Array<{ path: string; newHash?: string }>
	processedCount: number
}> {
	const pointsForBatchUpsert: PointStruct[] = []
	const successfullyProcessedForUpsert: Array<{ path: string; newHash?: string }> = []
	const filesToProcessConcurrently = [...filesToUpsertDetails]

	for (let i = 0; i < filesToProcessConcurrently.length; i += ctx.fileProcessingConcurrencyLimit) {
		const chunkToProcess = filesToProcessConcurrently.slice(i, i + ctx.fileProcessingConcurrencyLimit)
		const chunkProcessingPromises = chunkToProcess.map((fileDetail) =>
			processSingleFile(ctx, fileDetail, totalFilesInBatch),
		)
		const settledChunkResults = await Promise.allSettled(chunkProcessingPromises)

		for (const settledResult of settledChunkResults) {
			const resultInfo = processSettledFileResult(
				settledResult,
				batchResults,
				pathsToExplicitlyDelete,
				processedCountInBatch,
				totalFilesInBatch,
			)
			processedCountInBatch = resultInfo.updatedCount
			if (resultInfo.points) {
				pointsForBatchUpsert.push(...resultInfo.points)
			}
			if (resultInfo.upsertInfo) {
				successfullyProcessedForUpsert.push(resultInfo.upsertInfo)
			}
			ctx.onBatchProgressUpdate.fire({
				processedInBatch: processedCountInBatch,
				totalInBatch: totalFilesInBatch,
				currentFile: resultInfo.resultPath,
			})
		}
	}

	return {
		pointsForBatchUpsert,
		successfullyProcessedForUpsert,
		processedCount: processedCountInBatch,
	}
}

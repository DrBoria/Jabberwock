import type { IUri } from "@jabberwock/types"
import { FileProcessingResult } from "@services/code-index/interfaces"
import { extractDeletionErrorStatus, toError } from "@services/code-index/processors/file-watcher/error-utils"
import { BatchContext } from "./helpers.types"

export function collectDeletionPaths(
	pathsToExplicitlyDelete: string[],
	filesToUpsertDetails: Array<{ path: string; uri: IUri; originalType: "create" | "change" }>,
): Set<string> {
	const allPathsToClearFromDB = new Set<string>(pathsToExplicitlyDelete)
	for (const fileDetail of filesToUpsertDetails) {
		if (fileDetail.originalType === "change") {
			allPathsToClearFromDB.add(fileDetail.path)
		}
	}
	return allPathsToClearFromDB
}

export function reportDeletionSuccess(
	ctx: BatchContext,
	pathsToExplicitlyDelete: string[],
	batchResults: FileProcessingResult[],
	totalFilesInBatch: number,
): void {
	for (const path of pathsToExplicitlyDelete) {
		ctx.cacheManager.deleteHash(path)
		batchResults.push({ path, status: "success" })
		ctx.onBatchProgressUpdate.fire({
			processedInBatch: batchResults.length,
			totalInBatch: totalFilesInBatch,
			currentFile: path,
		})
	}
}

export function handleDeletionError(
	ctx: BatchContext,
	error: unknown,
	pathsToExplicitlyDelete: string[],
	batchResults: FileProcessingResult[],
	totalFilesInBatch: number,
): Error {
	const errorStatus = extractDeletionErrorStatus(error)
	const errorMessage = error instanceof Error ? error.message : String(error)

	ctx.captureError("deletePointsByMultipleFilePaths", "deletion_error", {
		error: errorMessage,
		errorStatus,
	})

	const batchError = toError(error)
	for (const path of pathsToExplicitlyDelete) {
		batchResults.push({ path, status: "error", error: batchError })
		ctx.onBatchProgressUpdate.fire({
			processedInBatch: batchResults.length,
			totalInBatch: totalFilesInBatch,
			currentFile: path,
		})
	}
	return batchError
}

export async function handleBatchDeletions(
	ctx: BatchContext,
	batchResults: FileProcessingResult[],
	processedCountInBatch: number,
	totalFilesInBatch: number,
	pathsToExplicitlyDelete: string[],
	filesToUpsertDetails: Array<{ path: string; uri: IUri; originalType: "create" | "change" }>,
): Promise<{ overallBatchError?: Error; clearedPaths: Set<string>; processedCount: number }> {
	const allPathsToClearFromDB = collectDeletionPaths(pathsToExplicitlyDelete, filesToUpsertDetails)

	if (allPathsToClearFromDB.size === 0 || !ctx.vectorStore) {
		return { clearedPaths: allPathsToClearFromDB, processedCount: processedCountInBatch }
	}

	try {
		await ctx.vectorStore.deletePointsByMultipleFilePaths(Array.from(allPathsToClearFromDB))
		reportDeletionSuccess(ctx, pathsToExplicitlyDelete, batchResults, totalFilesInBatch)
		return {
			clearedPaths: allPathsToClearFromDB,
			processedCount: processedCountInBatch + pathsToExplicitlyDelete.length,
		}
	} catch (error) {
		const batchError = handleDeletionError(ctx, error, pathsToExplicitlyDelete, batchResults, totalFilesInBatch)
		return {
			overallBatchError: batchError,
			clearedPaths: allPathsToClearFromDB,
			processedCount: processedCountInBatch + pathsToExplicitlyDelete.length,
		}
	}
}

import * as vscode from "vscode"
import { FileProcessingResult, BatchProcessingSummary } from "@services/code-index/interfaces"
import { BatchContext } from "./helpers.types"
import { handleBatchDeletions } from "./helpers.deletions"
import { processFilesAndPrepareUpserts } from "./helpers.processing"
import { executeBatchUpsertOperations } from "./helpers.upserts"

export async function processBatch(
	eventsToProcess: Map<string, { uri: vscode.Uri; type: "create" | "change" | "delete" }>,
	batchContext: BatchContext,
	onBatchProgressUpdate: vscode.EventEmitter<{
		processedInBatch: number
		totalInBatch: number
		currentFile?: string
	}>,
	onDidFinishBatchProcessing: vscode.EventEmitter<BatchProcessingSummary>,
	accumulatedEvents: Map<string, { uri: vscode.Uri; type: "create" | "change" | "delete" }>,
): Promise<void> {
	const batchResults: FileProcessingResult[] = []
	let processedCountInBatch = 0
	const totalFilesInBatch = eventsToProcess.size
	let overallBatchError: Error | undefined

	onBatchProgressUpdate.fire({
		processedInBatch: 0,
		totalInBatch: totalFilesInBatch,
		currentFile: undefined,
	})

	const pathsToExplicitlyDelete: string[] = []
	const filesToUpsertDetails: Array<{ path: string; uri: vscode.Uri; originalType: "create" | "change" }> = []

	for (const event of eventsToProcess.values()) {
		if (event.type === "delete") {
			pathsToExplicitlyDelete.push(event.uri.fsPath)
		} else {
			filesToUpsertDetails.push({
				path: event.uri.fsPath,
				uri: event.uri,
				originalType: event.type,
			})
		}
	}

	const { overallBatchError: deletionError, processedCount: deletionCount } = await handleBatchDeletions(
		batchContext,
		batchResults,
		processedCountInBatch,
		totalFilesInBatch,
		pathsToExplicitlyDelete,
		filesToUpsertDetails,
	)
	overallBatchError = deletionError
	processedCountInBatch = deletionCount

	const {
		pointsForBatchUpsert,
		successfullyProcessedForUpsert,
		processedCount: upsertCount,
	} = await processFilesAndPrepareUpserts(
		batchContext,
		filesToUpsertDetails,
		batchResults,
		processedCountInBatch,
		totalFilesInBatch,
		pathsToExplicitlyDelete,
	)
	processedCountInBatch = upsertCount

	overallBatchError = await executeBatchUpsertOperations(
		batchContext,
		pointsForBatchUpsert,
		successfullyProcessedForUpsert,
		batchResults,
		overallBatchError,
	)

	onDidFinishBatchProcessing.fire({
		processedFiles: batchResults,
		batchError: overallBatchError,
	})
	onBatchProgressUpdate.fire({
		processedInBatch: totalFilesInBatch,
		totalInBatch: totalFilesInBatch,
	})

	if (accumulatedEvents.size === 0) {
		onBatchProgressUpdate.fire({
			processedInBatch: 0,
			totalInBatch: 0,
			currentFile: undefined,
		})
	}
}

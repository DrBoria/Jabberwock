import * as path from "path"

import type { DisposableLike } from "@jabberwock/types"
import type { BatchProcessingSummary } from "@services/code-index/interfaces"
import { getTelemetryService } from "@jabberwock/telemetry"
import { TelemetryEventName } from "@jabberwock/types"
import { t } from "@i18n"
import {
	isAbortError,
	extractErrorMessage,
	extractErrorStack,
	handleIndexingCleanupError,
	createScanCallbacks,
	validateScanResult,
	type OrchestratorContext,
} from "./orchestrator.helpers"

export async function handleIndexingError(
	error: unknown,
	indexingStarted: boolean,
	signal: AbortSignal,
	ctx: OrchestratorContext,
	stopWatcher: () => void,
): Promise<void> {
	if (isAbortError(error, signal)) {
		console.log("[CodeIndexOrchestrator] Indexing aborted by user.")
		await ctx.cacheManager.flush()
		stopWatcher()
		ctx.stateManager.setSystemState("Standby", t("embeddings:orchestrator.indexingStopped"))
		return
	}

	console.error("[jabberwock] [CodeIndexOrchestrator] Error during indexing:", error)
	const errorMessage = extractErrorMessage(error)
	const errorStack = extractErrorStack(error)

	getTelemetryService().captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
		error: errorMessage,
		stack: errorStack,
		location: "startIndexing",
	})

	if (indexingStarted) {
		try {
			await ctx.vectorStore.clearCollection()
		} catch (cleanupError) {
			handleIndexingCleanupError(cleanupError)
		}
		await ctx.cacheManager.clearCacheFile()
		console.log("[CodeIndexOrchestrator] Indexing failed after starting. Clearing cache to avoid inconsistency.")
	} else {
		console.log(
			"[CodeIndexOrchestrator] Failed to connect to Qdrant. Preserving cache for future incremental scan.",
		)
	}

	ctx.stateManager.setSystemState(
		"Error",
		t("embeddings:orchestrator.failedDuringInitialScan", {
			errorMessage: errorMessage || t("embeddings:orchestrator.unknownError"),
		}),
	)
	stopWatcher()
}

export async function startWatcher(ctx: OrchestratorContext): Promise<DisposableLike[]> {
	if (!ctx.configManager.isFeatureConfigured) {
		throw new Error("Cannot start watcher: Service not configured.")
	}

	ctx.stateManager.setSystemState("Indexing", "Initializing file watcher...")

	try {
		await ctx.fileWatcher.initialize()

		const subscriptions = [
			ctx.fileWatcher.onDidStartBatchProcessing((_filePaths: string[]) => {}),
			ctx.fileWatcher.onBatchProgressUpdate(({ processedInBatch, totalInBatch, currentFile }) => {
				if (totalInBatch > 0 && ctx.stateManager.state !== "Indexing") {
					ctx.stateManager.setSystemState("Indexing", "Processing file changes...")
				}
				ctx.stateManager.reportFileQueueProgress(
					processedInBatch,
					totalInBatch,
					currentFile ? path.basename(currentFile) : undefined,
				)
				if (processedInBatch === totalInBatch) {
					if (totalInBatch > 0) {
						ctx.stateManager.setSystemState("Indexed", "File changes processed. Index up-to-date.")
					} else {
						if (ctx.stateManager.state === "Indexing") {
							ctx.stateManager.setSystemState("Indexed", "Index up-to-date. File queue empty.")
						}
					}
				}
			}),
			ctx.fileWatcher.onDidFinishBatchProcessing((summary: BatchProcessingSummary) => {
				if (summary.batchError) {
					console.error(`[jabberwock] [CodeIndexOrchestrator] Batch processing failed:`, summary.batchError)
				}
			}),
		]

		return subscriptions
	} catch (error) {
		console.error("[jabberwock] [CodeIndexOrchestrator] Failed to start file watcher:", error)
		getTelemetryService().captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
			location: "_startWatcher",
		})
		throw error
	}
}

export async function handleScanAbort(ctx: OrchestratorContext, stopWatcher: () => void): Promise<void> {
	await ctx.cacheManager.flush()
	stopWatcher()
	ctx.stateManager.setSystemState("Standby", t("embeddings:orchestrator.indexingStopped"))
}

export async function runFullScan(
	signal: AbortSignal,
	ctx: OrchestratorContext,
	stopWatcher: () => void,
): Promise<void> {
	ctx.stateManager.setSystemState("Indexing", "Services ready. Starting workspace scan...")
	await ctx.vectorStore.markIndexingIncomplete()

	const callbacks = createScanCallbacks(ctx.stateManager)

	const result = await ctx.scanner.scanDirectory(
		ctx.workspacePath,
		callbacks.handleBatchError,
		callbacks.handleBlocksIndexed,
		callbacks.handleFileParsed,
		signal,
	)

	if (signal.aborted) {
		await handleScanAbort(ctx, stopWatcher)
		return
	}

	if (!result) {
		throw new Error("Scan failed, is scanner initialized?")
	}

	validateScanResult(callbacks.cumulativeBlocksIndexed, callbacks.cumulativeBlocksFoundSoFar, callbacks.batchErrors)

	await startWatcher(ctx)
	await ctx.vectorStore.markIndexingComplete()
	ctx.stateManager.setSystemState("Indexed", t("embeddings:orchestrator.fileWatcherStarted"))
}

export async function runIncrementalScan(
	signal: AbortSignal,
	ctx: OrchestratorContext,
	stopWatcher: () => void,
): Promise<void> {
	console.log("[CodeIndexOrchestrator] Collection already has indexed data. Running incremental scan...")
	ctx.stateManager.setSystemState("Indexing", "Checking for new or modified files...")
	await ctx.vectorStore.markIndexingIncomplete()

	const callbacks = createScanCallbacks(ctx.stateManager)

	const result = await ctx.scanner.scanDirectory(
		ctx.workspacePath,
		callbacks.handleBatchError,
		callbacks.handleBlocksIndexed,
		callbacks.handleFileParsed,
		signal,
	)

	if (signal.aborted) {
		await handleScanAbort(ctx, stopWatcher)
		return
	}

	if (!result) {
		throw new Error("Incremental scan failed, is scanner initialized?")
	}

	if (callbacks.cumulativeBlocksFoundSoFar > 0) {
		console.log(
			`[CodeIndexOrchestrator] Incremental scan completed: ${callbacks.cumulativeBlocksIndexed} blocks indexed`,
		)
	} else {
		console.log("[CodeIndexOrchestrator] No new or changed files found")
	}

	await startWatcher(ctx)
	await ctx.vectorStore.markIndexingComplete()
	ctx.stateManager.setSystemState("Indexed", t("embeddings:orchestrator.fileWatcherStarted"))
}

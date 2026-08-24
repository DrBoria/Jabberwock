import * as vscode from "vscode"

import type { IFileWatcher, IVectorStore } from "@services/code-index/interfaces"
import type { CodeIndexConfigManager } from "@services/code-index/config/manager"
import type { CodeIndexStateManager } from "@services/code-index/state-manager"
import type { DirectoryScanner } from "@services/code-index/processors"
import type { CacheManager } from "@services/code-index/cache-manager"
import { t } from "@i18n"

export interface OrchestratorContext {
	configManager: CodeIndexConfigManager
	stateManager: CodeIndexStateManager
	workspacePath: string
	cacheManager: CacheManager
	vectorStore: IVectorStore
	scanner: DirectoryScanner
	fileWatcher: IFileWatcher
}

export function canStartIndexing(
	configManager: CodeIndexConfigManager,
	stateManager: CodeIndexStateManager,
	isProcessing: boolean,
): boolean {
	if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
		stateManager.setSystemState("Error", t("embeddings:orchestrator.indexingRequiresWorkspace"))
		console.warn("[jabberwock] [CodeIndexOrchestrator] Start rejected: No workspace folder open.")
		return false
	}

	if (!configManager.isFeatureConfigured) {
		stateManager.setSystemState("Standby", "Missing configuration. Save your settings to start indexing.")
		console.warn("[jabberwock] [CodeIndexOrchestrator] Start rejected: Missing configuration.")
		return false
	}

	const isAlreadyActive =
		isProcessing ||
		(stateManager.state !== "Standby" && stateManager.state !== "Error" && stateManager.state !== "Indexed")

	if (isAlreadyActive) {
		console.warn(`[CodeIndexOrchestrator] Start rejected: Already processing or in state ${stateManager.state}.`)
		return false
	}

	return true
}

export interface ScanCallbacks {
	cumulativeBlocksIndexed: number
	cumulativeBlocksFoundSoFar: number
	batchErrors: Error[]
	handleFileParsed: (fileBlockCount: number) => void
	handleBlocksIndexed: (indexedCount: number) => void
	handleBatchError: (batchError: Error) => void
}

export function createScanCallbacks(stateManager: CodeIndexStateManager): ScanCallbacks {
	let cumulativeBlocksIndexed = 0
	let cumulativeBlocksFoundSoFar = 0
	const batchErrors: Error[] = []

	const handleFileParsed = (fileBlockCount: number) => {
		cumulativeBlocksFoundSoFar += fileBlockCount
		stateManager.reportBlockIndexingProgress(cumulativeBlocksIndexed, cumulativeBlocksFoundSoFar)
	}

	const handleBlocksIndexed = (indexedCount: number) => {
		cumulativeBlocksIndexed += indexedCount
		stateManager.reportBlockIndexingProgress(cumulativeBlocksIndexed, cumulativeBlocksFoundSoFar)
	}

	const handleBatchError = (batchError: Error) => {
		console.error(`[CodeIndexOrchestrator] Error during scan batch: ${batchError.message}`, batchError)
		batchErrors.push(batchError)
	}

	return {
		cumulativeBlocksIndexed,
		cumulativeBlocksFoundSoFar,
		batchErrors,
		handleFileParsed,
		handleBlocksIndexed,
		handleBatchError,
	}
}

export function validateScanResult(
	cumulativeBlocksIndexed: number,
	cumulativeBlocksFoundSoFar: number,
	batchErrors: Error[],
): void {
	if (cumulativeBlocksIndexed === 0 && cumulativeBlocksFoundSoFar > 0) {
		if (batchErrors.length > 0) {
			throw new Error(`Indexing failed: ${batchErrors[0].message}`)
		}
		throw new Error(t("embeddings:orchestrator.indexingFailedNoBlocks"))
	}

	const failureRate = (cumulativeBlocksFoundSoFar - cumulativeBlocksIndexed) / cumulativeBlocksFoundSoFar

	if (batchErrors.length > 0 && failureRate > 0.1) {
		throw new Error(
			`Indexing partially failed: Only ${cumulativeBlocksIndexed} of ${cumulativeBlocksFoundSoFar} blocks were indexed. ${batchErrors[0].message}`,
		)
	}

	if (batchErrors.length > 0 && cumulativeBlocksIndexed === 0) {
		throw new Error(`Indexing failed completely: ${batchErrors[0].message}`)
	}

	if (cumulativeBlocksFoundSoFar > 0 && cumulativeBlocksIndexed === 0) {
		throw new Error(t("embeddings:orchestrator.indexingFailedCritical"))
	}
}

export function isAbortError(error: unknown, signal: AbortSignal): boolean {
	return (error as Record<string, unknown>)?.name === "AbortError" || signal.aborted
}

export function extractErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

export function extractErrorStack(error: unknown): string | undefined {
	return error instanceof Error ? error.stack : undefined
}

export function handleIndexingCleanupError(cleanupError: unknown): void {
	console.error("[jabberwock] [CodeIndexOrchestrator] Failed to clean up after error:", cleanupError)
}

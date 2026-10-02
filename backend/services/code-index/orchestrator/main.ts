import type { DisposableLike } from "@jabberwock/types"
import type { IndexingState } from "@services/code-index/state-manager"
import type { CodeIndexConfigManager } from "@services/code-index/config/manager"
import type { CodeIndexStateManager } from "@services/code-index/state-manager"
import type { IFileWatcher, IVectorStore } from "@services/code-index/interfaces"
import type { DirectoryScanner } from "@services/code-index/processors"
import type { CacheManager } from "@services/code-index/cache-manager"
import { t } from "@i18n"
import { canStartIndexing, type OrchestratorContext } from "./helpers"
import { handleIndexingError, runFullScan, runIncrementalScan } from "./scan"

export function CodeIndexOrchestrator(
	configManager: CodeIndexConfigManager,
	stateManager: CodeIndexStateManager,
	workspacePath: string,
	cacheManager: CacheManager,
	vectorStore: IVectorStore,
	scanner: DirectoryScanner,
	fileWatcher: IFileWatcher,
) {
	const handler = {
		get _ctx(): OrchestratorContext {
			return {
				configManager: this.configManager,
				stateManager: this.stateManager,
				workspacePath: this.workspacePath,
				cacheManager: this.cacheManager,
				vectorStore: this.vectorStore,
				scanner: this.scanner,
				fileWatcher: this.fileWatcher,
			}
		},

		get state(): IndexingState {
			return this.stateManager.state
		},
		_fileWatcherSubscriptions: [] as DisposableLike[],
		_isProcessing: false as boolean,
		_abortController: null as AbortController | null,
		configManager,
		stateManager,
		workspacePath,
		cacheManager,
		vectorStore,
		scanner,
		fileWatcher,
		async startIndexing(): Promise<void> {
			if (!canStartIndexing(handler.configManager, handler.stateManager, handler._isProcessing)) {
				return
			}
			handler._isProcessing = true
			handler._abortController = new AbortController()
			const signal = handler._abortController.signal
			handler.stateManager.setSystemState("Indexing", "Initializing services...")
			let indexingStarted = false
			try {
				const collectionCreated = await handler.vectorStore.initialize()
				indexingStarted = true
				if (collectionCreated) {
					await handler.cacheManager.clearCacheFile()
				}
				const hasExistingData = await handler.vectorStore.hasIndexedData()
				if (hasExistingData && !collectionCreated) {
					await runIncrementalScan(signal, handler._ctx, () => handler.stopWatcher())
				} else {
					await runFullScan(signal, handler._ctx, () => handler.stopWatcher())
				}
			} catch (error) {
				await handleIndexingError(error, indexingStarted, signal, handler._ctx, () => handler.stopWatcher())
				return
			} finally {
				handler._isProcessing = false
				handler._abortController = null
			}
		},
		stopIndexing(): void {
			if (handler._abortController) {
				handler.stateManager.setSystemState("Stopping", t("embeddings:orchestrator.indexingStoppedPartial"))
				handler._abortController.abort()
				handler._abortController = null
			}
			handler.stopWatcher()
		},
		stopWatcher(): void {
			handler.fileWatcher.dispose()
			handler._fileWatcherSubscriptions.forEach((sub) => sub.dispose())
			handler._fileWatcherSubscriptions = []
			if (handler.stateManager.state !== "Error" && handler.stateManager.state !== "Stopping") {
				handler.stateManager.setSystemState("Standby", t("embeddings:orchestrator.fileWatcherStopped"))
			}
			handler._isProcessing = false
		},
		async clearIndexData(): Promise<void> {
			handler._isProcessing = true
			try {
				handler.stopWatcher()
				try {
					if (handler.configManager.isFeatureConfigured) {
						await handler.vectorStore.deleteCollection()
					} else {
						console.warn(
							"[jabberwock] [CodeIndexOrchestrator] Service not configured, skipping vector collection clear.",
						)
					}
				} catch (error) {
					console.error("[jabberwock] [CodeIndexOrchestrator] Failed to clear vector collection:", error)
					handler.stateManager.setSystemState(
						"Error",
						`Failed to clear vector collection: ${(error as Record<string, unknown>).message as string}`,
					)
				}
				await handler.cacheManager.clearCacheFile()
				if (handler.stateManager.state !== "Error") {
					handler.stateManager.setSystemState("Standby", "Index data cleared successfully.")
				}
			} finally {
				handler._isProcessing = false
			}
		},
	}
	return handler
}
export type CodeIndexOrchestrator = ReturnType<typeof CodeIndexOrchestrator>

import * as vscode from "vscode"

import type { IndexingState } from "@services/code-index/state-manager"
import type { CodeIndexConfigManager } from "@services/code-index/config/manager"
import type { CodeIndexStateManager } from "@services/code-index/state-manager"
import type { IFileWatcher, IVectorStore } from "@services/code-index/interfaces"
import type { DirectoryScanner } from "@services/code-index/processors"
import type { CacheManager } from "@services/code-index/cache-manager"
import { t } from "@i18n"
import { canStartIndexing, type OrchestratorContext } from "./orchestrator.helpers"
import { handleIndexingError, runFullScan, runIncrementalScan } from "./orchestrator.scan"

export class CodeIndexOrchestrator {
	private _fileWatcherSubscriptions: vscode.Disposable[] = []
	private _isProcessing: boolean = false
	private _abortController: AbortController | null = null

	private get _ctx(): OrchestratorContext {
		return {
			configManager: this.configManager,
			stateManager: this.stateManager,
			workspacePath: this.workspacePath,
			cacheManager: this.cacheManager,
			vectorStore: this.vectorStore,
			scanner: this.scanner,
			fileWatcher: this.fileWatcher,
		}
	}

	constructor(
		private readonly configManager: CodeIndexConfigManager,
		private readonly stateManager: CodeIndexStateManager,
		private readonly workspacePath: string,
		private readonly cacheManager: CacheManager,
		private readonly vectorStore: IVectorStore,
		private readonly scanner: DirectoryScanner,
		private readonly fileWatcher: IFileWatcher,
	) {}

	public async startIndexing(): Promise<void> {
		if (!canStartIndexing(this.configManager, this.stateManager, this._isProcessing)) {
			return
		}

		this._isProcessing = true
		this._abortController = new AbortController()
		const signal = this._abortController.signal
		this.stateManager.setSystemState("Indexing", "Initializing services...")

		let indexingStarted = false

		try {
			const collectionCreated = await this.vectorStore.initialize()
			indexingStarted = true

			if (collectionCreated) {
				await this.cacheManager.clearCacheFile()
			}

			const hasExistingData = await this.vectorStore.hasIndexedData()

			if (hasExistingData && !collectionCreated) {
				await runIncrementalScan(signal, this._ctx, () => this.stopWatcher())
			} else {
				await runFullScan(signal, this._ctx, () => this.stopWatcher())
			}
		} catch (error) {
			await handleIndexingError(error, indexingStarted, signal, this._ctx, () => this.stopWatcher())
			return
		} finally {
			this._isProcessing = false
			this._abortController = null
		}
	}

	public stopIndexing(): void {
		if (this._abortController) {
			this.stateManager.setSystemState("Stopping", t("embeddings:orchestrator.indexingStoppedPartial"))
			this._abortController.abort()
			this._abortController = null
		}
		this.stopWatcher()
	}

	public stopWatcher(): void {
		this.fileWatcher.dispose()
		this._fileWatcherSubscriptions.forEach((sub) => sub.dispose())
		this._fileWatcherSubscriptions = []

		if (this.stateManager.state !== "Error" && this.stateManager.state !== "Stopping") {
			this.stateManager.setSystemState("Standby", t("embeddings:orchestrator.fileWatcherStopped"))
		}
		this._isProcessing = false
	}

	public async clearIndexData(): Promise<void> {
		this._isProcessing = true

		try {
			this.stopWatcher()

			try {
				if (this.configManager.isFeatureConfigured) {
					await this.vectorStore.deleteCollection()
				} else {
					console.warn(
						"[jabberwock] [CodeIndexOrchestrator] Service not configured, skipping vector collection clear.",
					)
				}
			} catch (error) {
				console.error("[jabberwock] [CodeIndexOrchestrator] Failed to clear vector collection:", error)
				this.stateManager.setSystemState(
					"Error",
					`Failed to clear vector collection: ${(error as Record<string, unknown>).message as string}`,
				)
			}

			await this.cacheManager.clearCacheFile()

			if (this.stateManager.state !== "Error") {
				this.stateManager.setSystemState("Standby", "Index data cleared successfully.")
			}
		} finally {
			this._isProcessing = false
		}
	}

	public get state(): IndexingState {
		return this.stateManager.state
	}
}

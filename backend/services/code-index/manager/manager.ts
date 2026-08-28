import type { IExtensionContextView, VscodeContextAccess } from "@features/foundation/vscode/context"
import { VectorStoreSearchResult } from "@services/code-index/interfaces"
import { IndexingState } from "@services/code-index/interfaces/manager"
import { CodeIndexConfigManager } from "@services/code-index/config/manager"
import { CodeIndexStateManager } from "@services/code-index/state-manager"
import { CodeIndexServiceFactory } from "@services/code-index/service-factory"
import { CodeIndexSearchService } from "@services/code-index/search-service"
import { CodeIndexOrchestrator } from "@services/code-index/orchestrator/orchestrator"
import { CacheManager } from "@services/code-index/cache-manager"

import { recreateManagerServices } from "./manager.services"
import { handleSettingsChange } from "./manager.settings"
import { WorkspaceSettings } from "./manager.workspace"
import { shouldSkipInitialization, shouldStartOrRestartIndexing, getOrCreateConfigManager } from "./manager.init"
import { recoverManagerFromError, disposeManager } from "./manager.recovery"

export class CodeIndexManager {
	private _configManager: CodeIndexConfigManager | undefined
	private readonly _stateManager: CodeIndexStateManager
	private readonly _workspaceSettings: WorkspaceSettings
	private _serviceFactory: CodeIndexServiceFactory | undefined
	private _orchestrator: CodeIndexOrchestrator | undefined
	private _searchService: CodeIndexSearchService | undefined
	private _cacheManager: CacheManager | undefined
	private _isRecoveringFromError = false

	private readonly workspacePath: string
	/** v4 B2 (L3): structural context view — real host contexts satisfy it structurally. */
	private readonly context: IExtensionContextView

	constructor(workspacePath: string, context: IExtensionContextView) {
		this.workspacePath = workspacePath
		this.context = context
		this._stateManager = new CodeIndexStateManager()
		// v4 B2 (L14): plain path instead of vscode.Uri — WorkspaceSettings replicates the Uri serialization for memento-key identity.
		this._workspaceSettings = new WorkspaceSettings(workspacePath, context)
	}

	public get isWorkspaceEnabled(): boolean {
		return this._workspaceSettings.isWorkspaceEnabled
	}
	public async setWorkspaceEnabled(enabled: boolean): Promise<void> {
		await this._workspaceSettings.setWorkspaceEnabled(enabled)
	}
	public get autoEnableDefault(): boolean {
		return this._workspaceSettings.autoEnableDefault
	}
	public async setAutoEnableDefault(enabled: boolean): Promise<void> {
		await this._workspaceSettings.setAutoEnableDefault(enabled)
	}
	public get onProgressUpdate() {
		return this._stateManager.onProgressUpdate
	}

	private assertInitialized(): void {
		if (!this._configManager || !this._orchestrator || !this._searchService || !this._cacheManager) {
			throw new Error("CodeIndexManager not initialized. Call initialize() first.")
		}
	}

	public get state(): IndexingState {
		if (!this.isFeatureEnabled) {
			return "Standby"
		}
		this.assertInitialized()
		return this._orchestrator!.state
	}

	public get isFeatureEnabled(): boolean {
		return this._configManager?.isFeatureEnabled ?? false
	}

	public get isFeatureConfigured(): boolean {
		return this._configManager?.isFeatureConfigured ?? false
	}

	public get isInitialized(): boolean {
		try {
			this.assertInitialized()
			return true
		} catch {
			return false
		}
	}

	public async initialize(contextProxy: VscodeContextAccess): Promise<{ requiresRestart: boolean }> {
		this._configManager = getOrCreateConfigManager(this._configManager, contextProxy)
		const { requiresRestart } = await this._configManager.loadConfiguration()

		if (
			shouldSkipInitialization(
				this.isFeatureEnabled,
				this._orchestrator,
				this.workspacePath,
				this.isWorkspaceEnabled,
				this._stateManager,
			)
		) {
			return { requiresRestart }
		}

		if (!this._cacheManager) {
			this._cacheManager = new CacheManager(this.context, this.workspacePath)
			await this._cacheManager.initialize()
		}

		const needsServiceRecreation = !this._serviceFactory || requiresRestart

		if (needsServiceRecreation) {
			await this._recreateServices()
		}

		if (shouldStartOrRestartIndexing(requiresRestart, needsServiceRecreation, this._orchestrator)) {
			this._orchestrator?.startIndexing()
		}

		return { requiresRestart }
	}

	public async startIndexing(): Promise<void> {
		if (!this.isFeatureEnabled || !this.isWorkspaceEnabled) {
			return
		}

		const currentStatus = this.getCurrentStatus()
		if (currentStatus.systemStatus === "Error") {
			await this.recoverFromError()
			return
		}

		this.assertInitialized()
		await this._orchestrator!.startIndexing()
	}

	public stopIndexing(): void {
		if (this._orchestrator) {
			this._orchestrator.stopIndexing()
		}
	}

	public stopWatcher(): void {
		if (this.isFeatureEnabled && this._orchestrator) {
			this._orchestrator.stopWatcher()
		}
	}

	public async recoverFromError(): Promise<void> {
		if (this._isRecoveringFromError) return
		this._isRecoveringFromError = true
		try {
			await recoverManagerFromError(this._stateManager)
		} finally {
			this._configManager = undefined
			this._serviceFactory = undefined
			this._orchestrator = undefined
			this._searchService = undefined
			this._isRecoveringFromError = false
		}
	}
	public dispose(): void {
		disposeManager(() => this.stopIndexing(), this._stateManager)
	}

	public async clearIndexData(): Promise<void> {
		if (!this.isFeatureEnabled) return
		this.assertInitialized()
		await this._orchestrator!.clearIndexData()
		await this._cacheManager!.clearCacheFile()
	}

	public getCurrentStatus() {
		const status = this._stateManager.getCurrentStatus()
		return {
			...status,
			workspacePath: this.workspacePath,
			workspaceEnabled: this.isWorkspaceEnabled,
			autoEnableDefault: this.autoEnableDefault,
		}
	}

	public async searchIndex(query: string, directoryPrefix?: string): Promise<VectorStoreSearchResult[]> {
		if (!this.isFeatureEnabled) {
			return []
		}
		this.assertInitialized()
		return this._searchService!.searchIndex(query, directoryPrefix)
	}

	private async _recreateServices(): Promise<void> {
		if (this._orchestrator) {
			this.stopWatcher()
		}
		this._orchestrator = undefined
		this._searchService = undefined

		const services = await recreateManagerServices(
			this._configManager!,
			this._stateManager,
			this._cacheManager!,
			this.workspacePath,
			this.context,
			() => this.stopWatcher(),
		)

		this._serviceFactory = services.serviceFactory
		this._orchestrator = services.orchestrator
		this._searchService = services.searchService
	}

	public async handleSettingsChange(): Promise<void> {
		await handleSettingsChange(
			this._configManager,
			this._stateManager,
			this.context,
			this.workspacePath,
			this._serviceFactory,
			this._orchestrator,
			this._searchService,
			this._cacheManager,
			() => this.stopIndexing(),
			({ serviceFactory, orchestrator, searchService, cacheManager }) => {
				this._serviceFactory = serviceFactory
				this._orchestrator = orchestrator
				this._searchService = searchService
				this._cacheManager = cacheManager
			},
		)
	}
}

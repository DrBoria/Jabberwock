import type { IExtensionContextView, IHostEnvironment } from "@features/foundation/host-context/context"
import { VectorStoreSearchResult } from "@services/code-index/interfaces"
import { IndexingState } from "@services/code-index/interfaces/manager"
import { CodeIndexConfigManager } from "@services/code-index/config/manager"
import { CodeIndexStateManager } from "@services/code-index/state-manager"
import { CodeIndexServiceFactory } from "@services/code-index/service-factory"
import { CodeIndexSearchService } from "@services/code-index/search-service"
import { CodeIndexOrchestrator } from "@services/code-index/orchestrator/main"
import { CacheManager } from "@services/code-index/cache-manager"

import { recreateManagerServices } from "./services"
import { handleSettingsChange } from "./settings"
import { WorkspaceSettings } from "./workspace"
import { shouldSkipInitialization, shouldStartOrRestartIndexing, getOrCreateConfigManager } from "./init"
import { recoverManagerFromError, disposeManager } from "./recovery"

export function CodeIndexManager(workspacePath: string, context: IExtensionContextView) {
	const _stateManager = CodeIndexStateManager()
	// v4 B2 (L14): plain path instead of vscode.Uri — WorkspaceSettings replicates the Uri serialization for memento-key identity.
	const _workspaceSettings = WorkspaceSettings(workspacePath, context)

	const handler = {
		get isWorkspaceEnabled(): boolean {
			return this._workspaceSettings.isWorkspaceEnabled
		},

		get autoEnableDefault(): boolean {
			return this._workspaceSettings.autoEnableDefault
		},

		get state(): IndexingState {
			if (!this.isFeatureEnabled) {
				return "Standby"
			}
			this.assertInitialized()
			return this._orchestrator!.state
		},

		get isFeatureEnabled(): boolean {
			return this._configManager?.isFeatureEnabled ?? false
		},

		get isFeatureConfigured(): boolean {
			return this._configManager?.isFeatureConfigured ?? false
		},

		get isInitialized(): boolean {
			try {
				this.assertInitialized()
				return true
			} catch {
				return false
			}
		},
		_configManager: undefined as CodeIndexConfigManager | undefined,
		_stateManager: _stateManager,
		_workspaceSettings: _workspaceSettings,
		_serviceFactory: undefined as CodeIndexServiceFactory | undefined,
		_orchestrator: undefined as CodeIndexOrchestrator | undefined,
		_searchService: undefined as CodeIndexSearchService | undefined,
		_cacheManager: undefined as CacheManager | undefined,
		_isRecoveringFromError: false,
		workspacePath,
		context,
		async setWorkspaceEnabled(enabled: boolean): Promise<void> {
			await handler._workspaceSettings.setWorkspaceEnabled(enabled)
		},
		async setAutoEnableDefault(enabled: boolean): Promise<void> {
			await handler._workspaceSettings.setAutoEnableDefault(enabled)
		},
		assertInitialized(): void {
			if (
				!handler._configManager ||
				!handler._orchestrator ||
				!handler._searchService ||
				!handler._cacheManager
			) {
				throw new Error("CodeIndexManager not initialized. Call initialize() first.")
			}
		},
		async initialize(contextProxy: IHostEnvironment): Promise<{
			requiresRestart: boolean
		}> {
			handler._configManager = getOrCreateConfigManager(handler._configManager, contextProxy)
			const { requiresRestart } = await handler._configManager.loadConfiguration()
			if (
				shouldSkipInitialization(
					handler.isFeatureEnabled,
					handler._orchestrator,
					handler.workspacePath,
					handler.isWorkspaceEnabled,
					handler._stateManager,
				)
			) {
				return { requiresRestart }
			}
			if (!handler._cacheManager) {
				handler._cacheManager = CacheManager(handler.context, handler.workspacePath)
				await handler._cacheManager.initialize()
			}
			const needsServiceRecreation = !handler._serviceFactory || requiresRestart
			if (needsServiceRecreation) {
				await handler._recreateServices()
			}
			if (shouldStartOrRestartIndexing(requiresRestart, needsServiceRecreation, handler._orchestrator)) {
				handler._orchestrator?.startIndexing()
			}
			return { requiresRestart }
		},
		async startIndexing(): Promise<void> {
			if (!handler.isFeatureEnabled || !handler.isWorkspaceEnabled) {
				return
			}
			const currentStatus = handler.getCurrentStatus()
			if (currentStatus.systemStatus === "Error") {
				await handler.recoverFromError()
				return
			}
			handler.assertInitialized()
			await handler._orchestrator!.startIndexing()
		},
		stopIndexing(): void {
			if (handler._orchestrator) {
				handler._orchestrator.stopIndexing()
			}
		},
		stopWatcher(): void {
			if (handler.isFeatureEnabled && handler._orchestrator) {
				handler._orchestrator.stopWatcher()
			}
		},
		async recoverFromError(): Promise<void> {
			if (handler._isRecoveringFromError) return
			handler._isRecoveringFromError = true
			try {
				await recoverManagerFromError(handler._stateManager)
			} finally {
				handler._configManager = undefined
				handler._serviceFactory = undefined
				handler._orchestrator = undefined
				handler._searchService = undefined
				handler._isRecoveringFromError = false
			}
		},
		dispose(): void {
			disposeManager(() => handler.stopIndexing(), handler._stateManager)
		},
		async clearIndexData(): Promise<void> {
			if (!handler.isFeatureEnabled) return
			handler.assertInitialized()
			await handler._orchestrator!.clearIndexData()
			await handler._cacheManager!.clearCacheFile()
		},
		getCurrentStatus() {
			const status = handler._stateManager.getCurrentStatus()
			return {
				...status,
				workspacePath: handler.workspacePath,
				workspaceEnabled: handler.isWorkspaceEnabled,
				autoEnableDefault: handler.autoEnableDefault,
			}
		},
		async searchIndex(query: string, directoryPrefix?: string): Promise<VectorStoreSearchResult[]> {
			if (!handler.isFeatureEnabled) {
				return []
			}
			handler.assertInitialized()
			return handler._searchService!.searchIndex(query, directoryPrefix)
		},
		async _recreateServices(): Promise<void> {
			if (handler._orchestrator) {
				handler.stopWatcher()
			}
			handler._orchestrator = undefined
			handler._searchService = undefined
			const services = await recreateManagerServices(
				handler._configManager!,
				handler._stateManager,
				handler._cacheManager!,
				handler.workspacePath,
				handler.context,
				() => handler.stopWatcher(),
			)
			handler._serviceFactory = services.serviceFactory
			handler._orchestrator = services.orchestrator
			handler._searchService = services.searchService
		},
		async handleSettingsChange(): Promise<void> {
			await handleSettingsChange(
				handler._configManager,
				handler._stateManager,
				handler.context,
				handler.workspacePath,
				handler._serviceFactory,
				handler._orchestrator,
				handler._searchService,
				handler._cacheManager,
				() => handler.stopIndexing(),
				({ serviceFactory, orchestrator, searchService, cacheManager }) => {
					handler._serviceFactory = serviceFactory
					handler._orchestrator = orchestrator
					handler._searchService = searchService
					handler._cacheManager = cacheManager
				},
			)
		},
	}
	return handler
}
export type CodeIndexManager = ReturnType<typeof CodeIndexManager>

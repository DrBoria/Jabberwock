import type { HistoryItem } from "../../task/history.ts"
import type { ProviderSettingsEntry } from "../../settings/provider/schemas.ts"
import type { RouterModels, ModelRecord } from "../../models/model.ts"
import type { PromptComponent, ModeConfig } from "../../models/mode.ts"
import type { WebviewMessage } from "../../webview/message.ts"
import type { ProviderSettings } from "../../settings/provider/combined-schemas.ts"

export interface FoundationAgentStateBackendToWebview {
	listApiConfig: { listApiConfig?: ProviderSettingsEntry[] }
	routerModels: { routerModels?: RouterModels }
	openAiModels: { openAiModels?: string[] }
	ollamaModels: { ollamaModels?: ModelRecord }
	lmStudioModels: { lmStudioModels?: ModelRecord }
	vsCodeLmModels: { vsCodeLmModels?: { vendor?: string; family?: string; version?: string; id?: string }[] }
	vsCodeLmApiAvailable: object
	singleRouterModelFetchResponse: { text?: string }
	updatePrompt: { slug?: string; customPrompt?: PromptComponent }
	systemPrompt: { text?: string }
	autoApprovalEnabled: { bool?: boolean }
	updateCustomMode: { customMode?: ModeConfig }
	deleteCustomMode: { slug?: string }
	deleteCustomModeCheck: { slug?: string; checkOnly?: boolean }
	exportModeResult: { success?: boolean; text?: string }
	importModeResult: { success?: boolean }
	checkRulesDirectoryResult: { hasContent?: boolean; rulesFolderPath?: string }
	indexingStatusUpdate: { text?: string }
	indexCleared: object
	codebaseIndexConfig: { context?: string }
	codeIndexSettingsSaved: object
	codeIndexSecretStatus: { error?: string }
}

export interface FoundationAgentStateWebviewToBackend {
	currentApiConfigName: { text?: string }
	saveApiConfiguration: { apiConfiguration?: ProviderSettings }
	upsertApiConfiguration: { apiConfiguration?: ProviderSettings }
	deleteApiConfiguration: { text?: string }
	loadApiConfiguration: { text?: string }
	loadApiConfigurationById: { text?: string }
	renameApiConfiguration: { text?: string; slug?: string }
	getListApiConfiguration: object
	customInstructions: { text?: string; bool?: boolean }
	flushRouterModels: object
	requestRouterModels: object
	requestOpenAiModels: object
	requestOllamaModels: object
	requestLmStudioModels: object
	requestRooModels: object
	requestRooCreditBalance: object
	requestVsCodeLmModels: object
	updateVSCodeSetting: { setting?: string; value?: unknown }
	getVSCodeSetting: { setting?: string }
	vsCodeSetting: { setting?: string; value?: unknown }
	updatePrompt: { slug?: string; customPrompt?: PromptComponent }
	getSystemPrompt: { slug?: string }
	copySystemPrompt: { slug?: string }
	systemPrompt: { slug?: string }
	autoApprovalEnabled: { bool?: boolean }
	updateCustomMode: { slug?: string; modeConfig?: ModeConfig }
	deleteCustomMode: { slug?: string; checkOnly?: boolean }
	exportMode: { slug?: string }
	importMode: object
	checkRulesDirectory: object
	setopenAiCustomModelInfo: { value?: number }
	openCustomModesSettings: object
	codebaseIndexEnabled: { bool?: boolean }
	requestIndexingStatus: object
	startIndexing: object
	stopIndexing: object
	clearIndexData: object
	indexingStatusUpdate: object
	indexCleared: object
	toggleWorkspaceIndexing: { bool?: boolean }
	setAutoEnableDefault: { bool?: boolean }
	saveCodeIndexSettingsAtomic: { codeIndexSettings?: unknown }
	requestCodeIndexSecretStatus: object
	hasOpenedModeSelector: { bool?: boolean }
	lockApiConfigAcrossModes: { bool?: boolean }
	updateSystemPromptTemplate: { slug?: string; systemPromptTemplate?: string; systemPromptTemplateKey?: string }
	updateCondensingPrompt: { text?: string }
	enhancementApiConfigId: { text?: string }
	debugSetting: { bool?: boolean }
}

export interface FoundationWindowManagerBackendToWebview {
	taskWithAggregatedCosts: {
		aggregatedCosts?: { totalCost: number; ownCost: number; childrenCost: number }
		historyItem?: HistoryItem
	}
	showInteractiveApp: object
	interactionRequired: object
	setHistoryPreviewCollapsed: { historyPreviewCollapsed?: boolean }
}

export interface FoundationWindowManagerWebviewToBackend {
	focusPanelRequest: object
	switchTab: { tab?: string }
	activePageResponse: { activePage?: string }
	getTaskWithAggregatedCosts: { taskId?: string }
	showTaskWithId: { taskId?: string }
	deleteTaskWithId: { taskId?: string }
	exportTaskWithId: { taskId?: string }
	exportCurrentTask: object
	deleteMultipleTasksWithIds: { ids?: string[] }
}

export interface FoundationMstBackendToWebview {
	mstSnapshotBatch: { payload: unknown }
}

export interface FoundationMstWebviewToBackend {
	mstPatch: { payload?: WebviewMessage }
}

export interface FoundationBackendToWebview {
	"agent-state": FoundationAgentStateBackendToWebview
	"window-manager": FoundationWindowManagerBackendToWebview
	mst: FoundationMstBackendToWebview
}

export interface FoundationWebviewToBackend {
	"agent-state": FoundationAgentStateWebviewToBackend
	"window-manager": FoundationWindowManagerWebviewToBackend
	mst: FoundationMstWebviewToBackend
}

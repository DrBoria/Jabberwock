/**
 * Event Registry — single source of truth for all Jabberwock event types.
 *
 * This file defines the nested interface hierarchy for all three event directions:
 *   1. BackendToWebview — Extension → Webview (postMessage)
 *   2. WebviewToBackend — Webview → Extension (postMessage)
 *   3. BackendInternalEvents — Backend EventEmitter events (JabberwockEventName)
 *
 * Backward-compatible flat union types (ExtensionMessage, WebviewMessage) are
 * derived from these nested interfaces and remain available from the main exports.
 */

import { JabberwockEventName } from "./events.ts"
import type { Notification } from "./notification.ts"
import type { ChatMessage, QueuedMessage, TokenUsage } from "./message.ts"
import type { ExtensionState, Command } from "./vscode-extension-host.ts"
import type { ToolUsage, ToolName } from "./tool.ts"
import type { ModelInfo } from "./model.ts"
import type { HistoryItem } from "./history.ts"
import type { McpServer } from "./mcp.ts"
import type { GitCommit } from "./git.ts"
import type { CloudUserInfo, ShareVisibility } from "./cloud.ts"
import type { GlobalSettings } from "./global-settings.ts"
import type { SkillMetadata } from "./skills.ts"
import type { MarketplaceItem, MarketplaceInstalledMetadata, InstallMarketplaceItemOptions } from "./marketplace.ts"
import type { SerializedCustomToolDefinition } from "./custom-tool.ts"
import type { WorktreeIncludeStatus } from "./worktree.ts"
import type { DiagnosticSnapshot, MstPatch } from "./diagnostics.ts"
import type { PromptComponent, ModeConfig } from "./mode.ts"
import type { ModelRecord, RouterModels } from "./model.ts"
import type { ProviderSettings, ProviderSettingsEntry } from "./provider-settings.ts"
import type { OpenAiCodexRateLimitInfo } from "./providers/openai-codex-rate-limits.ts"

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED EVENT VALUE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/** Possible values for the "askResponse" event — buttons clicked by user in webview */
export type AskResponseValue = "yesButtonClicked" | "noButtonClicked" | "messageResponse" | "objectResponse"

// ═══════════════════════════════════════════════════════════════════════════════
// PER-FEATURE EVENT INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Chat / Messages List ─────────────────────────────────────────────────

export interface ChatMessagesListBackendToWebview {
	chatTreeSnapshot: { snapshot: unknown }
	chatTreePatch: { patch: MstPatch[] }
	messageUpdated: { message?: Notification; chatMessage?: ChatMessage }
	showEditMessageDialog: object
	showDeleteMessageDialog: object
}

export interface ChatMessagesListWebviewToBackend {
	askResponse: { askResponse: AskResponseValue; text?: string; images?: string[] }
	deleteMessage: { messageTs?: number }
	deleteMessageConfirm: { messageTs?: number }
	submitEditedMessage: { editedMessageContent?: string; messageTs?: number }
	editMessageConfirm: { editedMessageContent?: string; messageTs?: number }
}

// ─── Chat / Notifications ─────────────────────────────────────────────────

export interface ChatNotificationsBackendToWebview {
	currentCheckpointUpdated: { hasCheckpoint?: boolean }
	checkpointInitWarning: { checkpointWarning?: { type: "WAIT_TIMEOUT" | "INIT_TIMEOUT"; timeout: number } }
	ttsStart: object
	ttsStop: object
	commandExecutionStatus: { text?: string }
	mcpExecutionStatus: { text?: string }
}

export interface ChatNotificationsWebviewToBackend {
	checkpointDiff: object
	checkpointRestore: { restoreCheckpoint?: boolean }
	playSound: object
	playTts: object
	stopTts: object
	ttsEnabled: { bool?: boolean }
	ttsSpeed: { value?: number }
	queueMessage: { text?: string }
	removeQueuedMessage: { messageTs?: number }
	editQueuedMessage: { editedMessageContent?: string; messageTs?: number }
	elicitationResponse: { text?: string }
}

// ─── Chat / Task ──────────────────────────────────────────────────────────

export interface ChatTaskBackendToWebview {
	action: { action?: string }
	state: { state?: Partial<ExtensionState>; text?: string }
	condenseTaskContextStarted: object
	condenseTaskContextResponse: { text?: string }
	acceptInput: object
}

export interface ChatTaskWebviewToBackend {
	newTask: { text: string; images?: string[] }
	cancelTask: object
	clearTask: object
	taskSyncEnabled: { bool?: boolean }
	condenseTaskContextRequest: object
	webviewDidLaunch: object
}

// ─── Chat / Text Area ─────────────────────────────────────────────────────

export interface ChatTextAreaBackendToWebview {
	enhancedPrompt: { promptText?: string }
	fileSearchResults: { results?: { path: string; type: "file" | "folder"; label?: string }[] }
	insertTextIntoTextarea: { text?: string }
}

export interface ChatTextAreaWebviewToBackend {
	enhancePrompt: { text?: string; customPrompt?: PromptComponent }
	draggedImages: { images?: string[] }
	selectImages: object
	searchFiles: { query?: string }
}

// ─── Chat / Topic ─────────────────────────────────────────────────────────

export interface ChatTopicBackendToWebview {
	taskHistoryUpdated: { taskHistory?: HistoryItem[] }
	taskHistoryItemUpdated: { historyItem?: HistoryItem }
	commands: { commands?: Command[] }
	modes: { modes?: { slug: string; name: string }[] }
	mode: { mode?: string }
}

export interface ChatTopicWebviewToBackend {
	mode: { mode?: string; promptMode?: string | "enhance" }
	requestCommands: object
	switchMode: { mode?: string }
	updateTodoList: { text?: string }
}

// ─── Chat Aggregator ──────────────────────────────────────────────────────

export interface ChatBackendToWebview {
	messages: ChatMessagesListBackendToWebview
	notifications: ChatNotificationsBackendToWebview
	task: ChatTaskBackendToWebview
	"text-area": ChatTextAreaBackendToWebview
	topic: ChatTopicBackendToWebview
}

export interface ChatWebviewToBackend {
	messages: ChatMessagesListWebviewToBackend
	notifications: ChatNotificationsWebviewToBackend
	task: ChatTaskWebviewToBackend
	"text-area": ChatTextAreaWebviewToBackend
	topic: ChatTopicWebviewToBackend
}

// ─── Cloud ────────────────────────────────────────────────────────────────

export interface CloudBackendToWebview {
	authenticatedUser: { userInfo?: CloudUserInfo }
	organizationSwitchResult: { organizationId?: string | null }
	shareTaskSuccess: { visibility?: ShareVisibility }
	rooCreditBalance: { value?: number }
}

export interface CloudWebviewToBackend {
	cloudButtonClicked: object
	jabberwockCloudSignIn: { useProviderSignup?: boolean }
	cloudLandingPageSignIn: object
	jabberwockCloudSignOut: object
	jabberwockCloudManualUrl: { url?: string }
	openAiCodexSignIn: object
	openAiCodexSignOut: object
	switchOrganization: { organizationId?: string | null }
	clearCloudAuthSkipModel: object
}

// ─── Diagnostics ──────────────────────────────────────────────────────────

export interface DiagnosticsBackendToWebview {
	diagnostics: { diagnostics?: DiagnosticSnapshot }
}

export interface DiagnosticsWebviewToBackend {
	clearDiagnostics: object
	downloadErrorDiagnostics: object
}

// ─── Foundation / Agent State ─────────────────────────────────────────────

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

// ─── Foundation / Window Manager ──────────────────────────────────────────

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

// ─── Foundation / MST ──────────────────────────────────────────────────────

export interface FoundationMstBackendToWebview {
	mstSnapshotBatch: { payload: unknown }
}

export interface FoundationMstWebviewToBackend {
	mstPatch: { payload?: WebviewMessage }
}

// ─── Foundation Aggregator ────────────────────────────────────────────────

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

// ─── History ──────────────────────────────────────────────────────────────

export interface HistoryBackendToWebview {
	commitSearchResults: { commits?: GitCommit[] }
	workspaceUpdated: {
		uri?: string
		filePaths?: string[]
		openedTabs?: Array<{ label: string; isActive: boolean; path?: string }>
	}
}

export interface HistoryWebviewToBackend {
	searchCommits: { query?: string }
	importSettings: object
	exportSettings: object
	resetState: object
	historyButtonClicked: object
}
// ─── Marketplace ──────────────────────────────────────────────────────────

export interface MarketplaceBackendToWebview {
	marketplaceData: {
		marketplaceItems?: MarketplaceItem[]
		organizationMcps?: MarketplaceItem[]
		marketplaceInstalledMetadata?: MarketplaceInstalledMetadata
	}
	marketplaceInstallResult: { success?: boolean; error?: string }
	marketplaceRemoveResult: { success?: boolean; error?: string }
	customToolsResult: { tools?: SerializedCustomToolDefinition[] }
	skills: { skills?: SkillMetadata[] }
}

export interface MarketplaceWebviewToBackend {
	marketplaceButtonClicked: object
	filterMarketplaceItems: { filters?: { type?: string; search?: string; tags?: string[] } }
	installMarketplaceItem: { mpItem?: MarketplaceItem; mpInstallOptions?: InstallMarketplaceItemOptions }
	installMarketplaceItemWithParameters: { mpItem?: MarketplaceItem; config?: Record<string, unknown> }
	cancelMarketplaceInstall: object
	removeInstalledMarketplaceItem: { mpItem?: MarketplaceItem }
	marketplaceInstallResult: object
	fetchMarketplaceData: object
	refreshCustomTools: object
	requestSkills: object
	createSkill: { skillName?: string; skillDescription?: string; skillModeSlugs?: string[] }
	deleteSkill: { skillName?: string }
	moveSkill: { skillName?: string; newSkillModeSlugs?: string[] }
	updateSkillModes: { skillName?: string; skillModeSlugs?: string[] }
	openSkillFile: { skillName?: string }
}

// ─── Settings ─────────────────────────────────────────────────────────────

export interface SettingsBackendToWebview {
	mcpServers: { mcpServers?: McpServer[] }
	theme: { text?: string }
	selectedImages: { images?: string[] }
	invoke: { invoke?: string }
	toggleApiConfigPin: { slug?: string }
	openAiCodexRateLimits: { values?: OpenAiCodexRateLimitInfo; error?: string }
	worktreeList: {
		worktrees?: unknown[]
		isGitRepo?: boolean
		isMultiRoot?: boolean
		isSubfolder?: boolean
		gitRootPath?: string
	}
	worktreeResult: { worktreeResult?: unknown }
	worktreeCopyProgress: {
		copyProgressBytesCopied?: number
		copyProgressTotalBytes?: number
		copyProgressItemName?: string
	}
	branchList: {
		localBranches?: string[]
		remoteBranches?: string[]
		currentBranch?: string
		suggestedBranch?: string
		suggestedPath?: string
	}
	worktreeDefaults: { suggestedPath?: string }
	worktreeIncludeStatus: {
		worktreeIncludeExists?: boolean
		worktreeIncludeStatus?: WorktreeIncludeStatus
		hasGitignore?: boolean
		gitignoreContent?: string
	}
	branchWorktreeIncludeResult: { branch?: string; hasWorktreeInclude?: boolean }
	folderSelected: { path?: string }
	fileContent: { fileContent?: { path: string; content: string | null; error?: string } }
	fetchUrlResponse: { text?: string; error?: string }
}

export interface SettingsWebviewToBackend {
	updateSettings: { updatedSettings?: GlobalSettings }
	didShowAnnouncement: { bool?: boolean }
	getDismissedUpsells: object
	dismissUpsell: { upsellId?: string }
	openImage: { path?: string }
	saveImage: { dataUri?: string }
	openFile: { path?: string }
	readFileContent: { path?: string }
	openMention: { text?: string; uri?: string }
	openExternal: { url?: string }
	openKeyboardShortcuts: object
	openMcpSettings: object
	openProjectMcpSettings: object
	restartMcpServer: { serverName?: string }
	refreshAllMcpServers: object
	toggleToolAlwaysAllow: { toolName?: string; alwaysAllow?: boolean }
	toggleToolEnabledForPrompt: { toolName?: string; isEnabled?: boolean }
	toggleMcpServer: { serverName?: string; disabled?: boolean }
	updateMcpTimeout: { serverName?: string; timeout?: number }
	deleteMcpServer: { serverName?: string }
	setApiConfigPassword: { text?: string }
	telemetrySetting: { bool?: boolean }
	toggleApiConfigPin: { slug?: string }
	listWorktrees: object
	createWorktree: {
		worktreePath?: string
		worktreeBranch?: string
		worktreeBaseBranch?: string
		worktreeCreateNewBranch?: boolean
		worktreeForce?: boolean
		worktreeNewWindow?: boolean
	}
	deleteWorktree: { worktreePath?: string }
	switchWorktree: { worktreePath?: string }
	getAvailableBranches: { worktreePath?: string }
	getWorktreeDefaults: object
	getWorktreeIncludeStatus: object
	checkBranchWorktreeInclude: { branch?: string }
	createWorktreeInclude: { worktreeIncludeContent?: string }
	checkoutBranch: { branch?: string }
	browseForWorktreePath: object
	webviewLog: { text?: string }
	devtoolStatus: { bool?: boolean }
	locatorTarget: { locatorPayload?: { filePath: string; line: number; column: number } }
	domResponse: { text?: string }
	webviewError: { text?: string }
	fetchUrl: { url?: string }
	allowedCommands: { commands?: string[] }
	deniedCommands: { commands?: string[] }
	openDebugApiHistory: object
	openDebugUiHistory: object
	requestOpenAiCodexRateLimits: object
	requestModes: object
	imageGenerationSettings: { bool?: boolean }
	openMarkdownPreview: { text?: string }
	openCommandFile: { text?: string }
	deleteCommand: { text?: string }
	createCommand: { text?: string }
	insertTextIntoTextarea: { text?: string }
	showMdmAuthRequiredNotification: object
	terminalOperation: { terminalOperation?: "continue" | "abort" }
	LOCATOR_OPEN_FILE: { locatorPayload?: { filePath: string; line: number; column: number } }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT AGGREGATORS
// ═══════════════════════════════════════════════════════════════════════════════

export interface BackendToWebview {
	chat: ChatBackendToWebview
	cloud: CloudBackendToWebview
	diagnostics: DiagnosticsBackendToWebview
	foundation: FoundationBackendToWebview
	history: HistoryBackendToWebview
	marketplace: MarketplaceBackendToWebview
	settings: SettingsBackendToWebview
}

export interface WebviewToBackend {
	chat: ChatWebviewToBackend
	cloud: CloudWebviewToBackend
	diagnostics: DiagnosticsWebviewToBackend
	foundation: FoundationWebviewToBackend
	history: HistoryWebviewToBackend
	marketplace: MarketplaceWebviewToBackend
	settings: SettingsWebviewToBackend
}

export interface BackendInternalEvents {
	chat: {
		task: {
			[JabberwockEventName.TaskCreated]: { taskId: string }
			[JabberwockEventName.TaskStarted]: { taskId: string }
			[JabberwockEventName.TaskCompleted]: {
				taskId: string
				tokenUsage: TokenUsage
				toolUsage: ToolUsage
				isSubtask: boolean
			}
			[JabberwockEventName.TaskAborted]: { taskId: string }
			[JabberwockEventName.TaskFocused]: { taskId: string }
			[JabberwockEventName.TaskUnfocused]: { taskId: string }
			[JabberwockEventName.TaskActive]: { taskId: string }
			[JabberwockEventName.TaskInteractive]: { taskId: string }
			[JabberwockEventName.TaskResumable]: { taskId: string }
			[JabberwockEventName.TaskIdle]: { taskId: string }
			[JabberwockEventName.TaskPaused]: { taskId: string }
			[JabberwockEventName.TaskUnpaused]: { taskId: string }
			[JabberwockEventName.TaskSpawned]: { parentTaskId: string; childTaskId: string }
			[JabberwockEventName.TaskDelegated]: { parentTaskId: string; childTaskId: string }
			[JabberwockEventName.TaskDelegationCompleted]: {
				parentTaskId: string
				childTaskId: string
				completionResultSummary: string
			}
			[JabberwockEventName.TaskDelegationResumed]: { parentTaskId: string; childTaskId: string }
			[JabberwockEventName.Message]: {
				taskId: string
				action: "created" | "updated"
				message: Notification
				chatMessage?: ChatMessage
			}
			[JabberwockEventName.TaskModeSwitched]: { taskId: string; newMode: string }
			[JabberwockEventName.TaskAskResponded]: { taskId: string }
			[JabberwockEventName.TaskUserMessage]: { taskId: string }
			[JabberwockEventName.QueuedMessagesUpdated]: { taskId: string; queuedMessages: QueuedMessage[] }
			[JabberwockEventName.TaskTokenUsageUpdated]: {
				taskId: string
				tokenUsage: TokenUsage
				toolUsage: ToolUsage
			}
			[JabberwockEventName.TaskToolFailed]: { taskId: string; toolName: ToolName; error: string }
		}
	}
	diagnostics: {
		[JabberwockEventName.EvalPass]: { taskId: number }
		[JabberwockEventName.EvalFail]: { taskId: number }
	}
	foundation: {
		[JabberwockEventName.CommandsResponse]: { commands: Command[] }
		[JabberwockEventName.ModesResponse]: { modes: { slug: string; name: string }[] }
		[JabberwockEventName.ModelsResponse]: { models: Record<string, ModelInfo> }
	}
	settings: {
		[JabberwockEventName.ModeChanged]: { mode: string }
		[JabberwockEventName.ProviderProfileChanged]: { name: string; provider: string }
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// RUNTIME SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

export const jabberwockDirections = ["backend→webview", "webview→backend", "internal"] as const

// ═══════════════════════════════════════════════════════════════════════════════
// BACKWARD-COMPATIBLE FLAT UNION TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Helper type: flattens a nested feature interface into a discriminated union.
 * Each key becomes a `{ type: K } & Payload` member of the union.
 */
type FlattenLeaf<T> = {
	[K in keyof T]: { type: K } & T[K]
}[keyof T]

/**
 * Flatten a 2-level nested interface (feature → subfeature → events)
 * into a flat discriminated union.
 */
type FlattenNested<T> = {
	[Feature in keyof T]: {
		[Subfeature in keyof T[Feature]]: FlattenLeaf<T[Feature][Subfeature]>
	}[keyof T[Feature]]
}[keyof T]

/**
 * Backward-compatible ExtensionMessage — derived from the nested hierarchy.
 * This is a flat discriminated union matching the original interface shape.
 */
export type ExtensionMessage = FlattenNested<BackendToWebview>

/**
 * Backward-compatible WebviewMessage — derived from the nested hierarchy.
 * This is a flat discriminated union matching the original interface shape.
 */
export type WebviewMessage = FlattenNested<WebviewToBackend>

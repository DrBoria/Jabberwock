import { types, Instance, onAction } from "mobx-state-tree"

import { vscode } from "@jabberwock/devtool/webview"
import type { WebviewMessage, ExtensionMessage } from "@jabberwock/types"
import { ORGANIZATION_ALLOW_ALL, eventConstants } from "@jabberwock/types"
import type {
	ExtensionState,
	ProviderSettings,
	ProviderSettingsEntry,
	Command,
	CustomModePrompts,
	ModeConfig,
	TelemetrySetting,
} from "@jabberwock/types"
import { Mode, defaultModeSlug, defaultPrompts } from "@shared/modes"
import type { CustomSupportPrompts } from "@shared/support-prompt"
import { experimentDefault } from "@shared/experiments"
import { jabberwockLog } from "../utils/jabberwock-logger"
import { IntentConstants } from "@intentConstants"

import { ChatStore } from "./chat/store"
import { SettingsStore } from "./settings/store"
import { MarketplaceStore } from "./marketplace/store"
import { CloudStore } from "./cloud/store"
import { TaskHistoryStore } from "./history/store"
import { WindowManagerStore } from "./foundation/window-manager/store"
import { IntentStoreModel, setupIntents } from "./intents"
import { McpExecutionStore } from "./chat/task/notifications/mcp/store"
import { SkillsStore } from "./settings/skills/store"
import { AgentStateStore } from "./settings/agents/store"

// ─── Action log entry type ──────────────────────────────────────────
export interface FrontendActionLogEntry {
	name: string
	path: string
	args: unknown[]
	timestamp: number
}

/**
 * Extended window interface for devtool access.
 * Allows setting __JABBERWOCK_GET_STATE__ without casting to unknown.
 */
interface WindowWithDevtool extends Window {
	__JABBERWOCK_GET_STATE__?: () => Record<string, unknown>
}

// ── Dispatch map: ExtensionMessage.type → IntentConstants.* ──────────
const handleExtensionMessageDispatchMap: Record<string, string> = {
	showInteractiveApp: IntentConstants.foundation.SHOW_INTERACTIVE_APP,
	state: IntentConstants.task.STATE_RECEIVED,
	action: IntentConstants.task.ACTION_RECEIVED,
	theme: IntentConstants.settings.THEME_UPDATED,
	workspaceUpdated: IntentConstants.foundation.WORKSPACE_UPDATED,
	commands: IntentConstants.foundation.COMMANDS_UPDATED,
	messageUpdated: IntentConstants.task.MESSAGES_UPDATED,
	skills: IntentConstants.settings.SKILLS,
	mcpServers: IntentConstants.settings.MCP_SERVERS,
	currentCheckpointUpdated: IntentConstants.task.CHECKPOINT_UPDATED,
	listApiConfig: IntentConstants.settings.LIST_API_CONFIG,
	routerModels: IntentConstants.settings.ROUTER_MODELS,
	marketplaceData: IntentConstants.marketplace.DATA_RECEIVED,
	taskHistoryUpdated: IntentConstants.history.UPDATED,
	taskHistoryItemUpdated: IntentConstants.history.ITEM_UPDATED,
	diagnostics: IntentConstants.diagnostics.RECEIVED,
	invoke: IntentConstants.chat.INVOKE_RECEIVED,
	selectedImages: IntentConstants.task.SELECTED_IMAGES,
	condenseTaskContextStarted: IntentConstants.task.CONDENSE_STARTED,
	condenseTaskContextResponse: IntentConstants.task.CONDENSE_RESPONSE,
	checkpointInitWarning: IntentConstants.task.CHECKPOINT_INIT_WARNING,
	interactionRequired: IntentConstants.chat.INTERACTION_REQUIRED,
	taskWithAggregatedCosts: IntentConstants.task.TASK_WITH_AGGREGATED_COSTS,
}

/**
 * RootStore — central MST root store composing all feature stores.
 * Acts as the single entry point for the entire webview UI state.
 */
export const RootStore = types
	.model("RootStore", {
		// ── App-wide fundamental state ──────────────────────────────────
		extensionState: types.optional(
			types.frozen<ExtensionState>(),
			() =>
				({
					apiConfiguration: {},
					version: "",
					messages: [],
					taskHistory: [],
					shouldShowAnnouncement: false,
					allowedCommands: [],
					deniedCommands: [],
					soundEnabled: false,
					soundVolume: 0.5,
					ttsEnabled: false,
					ttsSpeed: 1.0,
					enableCheckpoints: true,
					checkpointTimeout: 15,
					language: "en",

					writeDelayMs: 1000,
					terminalShellIntegrationTimeout: 4000,
					mcpEnabled: true,
					taskSyncEnabled: false,
					currentApiConfigName: "default",
					listApiConfigMeta: [],
					mode: defaultModeSlug,
					customModePrompts: defaultPrompts,
					customSupportPrompts: {},
					experiments: experimentDefault,
					enhancementApiConfigId: "",
					hasOpenedModeSelector: false,
					autoApprovalEnabled: false,
					customModes: [],
					maxOpenTabsContext: 20,
					maxWorkspaceFiles: 200,
					cwd: "",
					telemetrySetting: "unset",
					showJabberwockIgnoredFiles: true,
					enableSubfolderRules: false,
					renderContext: "sidebar",
					maxReadFileLine: -1,
					maxImageFileSize: 5,
					maxTotalImageSize: 20,
					pinnedApiConfigs: {},
					terminalZshOhMy: false,
					terminalZshP10k: false,
					terminalZdotdir: false,
					historyPreviewCollapsed: false,
					reasoningBlockCollapsed: true,
					enterBehavior: "send",
					cloudUserInfo: null,
					cloudIsAuthenticated: false,
					cloudOrganizations: [],
					sharingEnabled: false,
					publicSharingEnabled: false,
					organizationAllowList: ORGANIZATION_ALLOW_ALL,
					organizationSettingsVersion: -1,
					autoCondenseContext: true,
					autoCondenseContextPercent: 100,
					profileThresholds: {},
					locatorTarget: "code",
					codebaseIndexConfig: {
						codebaseIndexEnabled: true,
						codebaseIndexQdrantUrl: "http://localhost:6333",
						codebaseIndexEmbedderProvider: "openai",
						codebaseIndexEmbedderBaseUrl: "",
						codebaseIndexEmbedderModelId: "",
						codebaseIndexSearchMaxResults: undefined,
						codebaseIndexSearchMinScore: undefined,
					},
					codebaseIndexModels: { ollama: {}, openai: {} },
					includeDiagnosticMessages: true,
					maxDiagnosticMessages: 50,
					openRouterImageApiKey: "",
					openRouterImageGenerationSelectedModel: "",
					includeCurrentTime: true,
					includeCurrentCost: true,
					lockApiConfigAcrossModes: false,
					devtoolEnabled: false,
				}) as ExtensionState,
		),

		// ── App lifecycle state ─────────────────────────────────────────
		didHydrateState: types.boolean,
		showWelcome: types.boolean,
		_welcomeDismissed: types.boolean,

		// ── Display / workspace state ───────────────────────────────────
		theme: types.frozen(),
		filePaths: types.frozen<string[]>(),
		openedTabs: types.frozen<Array<{ label: string; isActive: boolean; path?: string }>>(),
		extensionCommands: types.frozen<Command[]>(),
		interactiveAppUri: types.string,
		currentCheckpoint: types.string,

		// ── Feature sub-stores ──────────────────────────────────────────
		chat: types.optional(ChatStore, () => ChatStore.create({})),
		settings: types.optional(SettingsStore, () =>
			SettingsStore.create({
				activeTab: "",
				searchQuery: "",
				theme: {},
				fontSize: 14,
				mcpServers: [],
				routerModels: {
					openrouter: {},
					"vercel-ai-gateway": {},
					litellm: {},
					requesty: {},
					jabberwock: {},
					unbound: {},
					ollama: {},
					lmstudio: {},
				},
				profileThresholds: {},
				alwaysAllowFollowupQuestions: true,
				followupAutoApproveTimeoutMs: 30000,
				hasOpenedModeSelector: false,
				includeTaskHistoryInEnhance: true,
				includeCurrentTime: true,
				includeCurrentCost: true,
				organizationAllowList: { allowAll: true, providers: {} },
				organizationSettingsVersion: 0,
			}),
		),
		marketplace: types.optional(MarketplaceStore, () =>
			MarketplaceStore.create({ marketplaceInstalledMetadata: { project: {}, global: {} } }),
		),
		cloud: types.optional(CloudStore, () =>
			CloudStore.create({
				cloudIsAuthenticated: false,
				cloudOrganizations: [],
				sharingEnabled: false,
				publicSharingEnabled: false,
				prevCloudIsAuthenticated: false,
			}),
		),
		history: types.optional(TaskHistoryStore, () => TaskHistoryStore.create({ items: [] })),
		windowManager: types.optional(WindowManagerStore, () =>
			WindowManagerStore.create({ activeWindows: [{ type: "chat", props: {} }] }),
		),

		// ── Sub-feature stores (formerly module-level singletons) ─────────────
		mcpExecution: types.optional(McpExecutionStore, () => McpExecutionStore.create({})),
		skills: types.optional(SkillsStore, () => SkillsStore.create({})),
		agentState: types.optional(AgentStateStore, () => AgentStateStore.create({})),

		// ── Intent store ─────────────────────────────────────────────────────
		intentStore: types.optional(IntentStoreModel, () => IntentStoreModel.create({})),
	})
	// ── Block 1: mergeExtensionState ─────────────────────────────────────
	.actions((self) => ({
		mergeExtensionState(newState: Partial<ExtensionState>) {
			const prev = self.extensionState

			// Log incoming messages at the central reception point
			const incomingMessages = newState.messages
			if (incomingMessages && incomingMessages.length > 0) {
				const lastMessage = incomingMessages[incomingMessages.length - 1]
				const lastMessageType = `${lastMessage.type}:${lastMessage.say ?? lastMessage.ask ?? "unknown"}`
				jabberwockLog.log("state:messages", {
					count: incomingMessages.length,
					lastMessageType,
					hasPendingAsks: incomingMessages.some((m) => m.type === "ask"),
				})
			}

			const { customModePrompts: prevCustomModePrompts, experiments: prevExperiments, ...prevRest } = prev
			const {
				apiConfiguration,
				customModePrompts: newCustomModePrompts,
				customSupportPrompts,
				experiments: newExperiments,
				...newRest
			} = newState

			const customModePrompts = { ...prevCustomModePrompts, ...(newCustomModePrompts ?? {}) }
			const experiments = { ...prevExperiments, ...(newExperiments ?? {}) }
			const rest = { ...prevRest, ...newRest }

			// Protect messages from stale state pushes using sequence numbering
			if (
				newState.messagesSeq !== undefined &&
				prev.messagesSeq !== undefined &&
				newState.messagesSeq <= prev.messagesSeq &&
				newState.messages !== undefined
			) {
				rest.messages = prev.messages
				rest.messagesSeq = prev.messagesSeq
			}

			self.extensionState = {
				...rest,
				apiConfiguration: apiConfiguration ?? prev.apiConfiguration,
				customModePrompts,
				customSupportPrompts: customSupportPrompts ?? prev.customSupportPrompts,
				experiments,
			} as ExtensionState
		},
	}))
	// ── Block 2: Extension state actions ─────────────────────────────────
	.actions((self) => ({
		// ── Welcome dismiss tracking ────────────────────────────────
		setShowWelcome(value: boolean) {
			if (!value) {
				self._welcomeDismissed = true
			}
			self.showWelcome = value
		},

		// ── Local state setters (RootStore-owned) ───────────────────
		setInteractiveAppUri(uri: string) {
			self.interactiveAppUri = uri
		},
		setCurrentCheckpoint(text: string) {
			self.currentCheckpoint = text
		},

		// ── Local state setters (routed to SettingsStore) ───────────
		setHasOpenedModeSelector(value: boolean) {
			self.settings.setHasOpenedModeSelector(value)
		},
		setAlwaysAllowFollowupQuestions(value: boolean) {
			self.settings.setAlwaysAllowFollowupQuestions(value)
		},
		setFollowupAutoApproveTimeoutMs(value: number) {
			self.settings.setFollowupAutoApproveTimeoutMs(value)
		},
		setProfileThresholds(value: Record<string, number>) {
			self.settings.setProfileThresholds(value)
		},
		setIncludeTaskHistoryInEnhance(value: boolean) {
			self.settings.setIncludeTaskHistoryInEnhance(value)
		},
		setIncludeCurrentTime(value: boolean) {
			self.settings.setIncludeCurrentTime(value)
		},
		setIncludeCurrentCost(value: boolean) {
			self.settings.setIncludeCurrentCost(value)
		},

		// ── Extension state setters (self.extensionState mutations) ─
		setApiConfiguration(config: ProviderSettings) {
			self.extensionState = {
				...self.extensionState,
				apiConfiguration: { ...self.extensionState.apiConfiguration, ...config },
			}
		},
		setCustomInstructions(value?: string) {
			self.extensionState = { ...self.extensionState, customInstructions: value }
		},
		setAlwaysAllowReadOnly(value: boolean) {
			self.extensionState = { ...self.extensionState, alwaysAllowReadOnly: value }
		},
		setAlwaysAllowReadOnlyOutsideWorkspace(value: boolean) {
			self.extensionState = { ...self.extensionState, alwaysAllowReadOnlyOutsideWorkspace: value }
		},
		setAlwaysAllowWrite(value: boolean) {
			self.extensionState = { ...self.extensionState, alwaysAllowWrite: value }
		},
		setAlwaysAllowWriteOutsideWorkspace(value: boolean) {
			self.extensionState = { ...self.extensionState, alwaysAllowWriteOutsideWorkspace: value }
		},
		setAlwaysAllowExecute(value: boolean) {
			self.extensionState = { ...self.extensionState, alwaysAllowExecute: value }
		},
		setAlwaysAllowMcp(value: boolean) {
			self.extensionState = { ...self.extensionState, alwaysAllowMcp: value }
		},
		setAlwaysAllowModeSwitch(value: boolean) {
			self.extensionState = { ...self.extensionState, alwaysAllowModeSwitch: value }
		},
		setAlwaysAllowSubtasks(value: boolean) {
			self.extensionState = { ...self.extensionState, alwaysAllowSubtasks: value }
		},
		setShowAnnouncement(value: boolean) {
			self.extensionState = { ...self.extensionState, shouldShowAnnouncement: value }
		},
		setAllowedCommands(value: string[]) {
			self.extensionState = { ...self.extensionState, allowedCommands: value }
		},
		setDeniedCommands(value: string[]) {
			self.extensionState = { ...self.extensionState, deniedCommands: value }
		},
		setAllowedMaxRequests(value: number | undefined) {
			self.extensionState = { ...self.extensionState, allowedMaxRequests: value }
		},
		setAllowedMaxCost(value: number | undefined) {
			self.extensionState = { ...self.extensionState, allowedMaxCost: value }
		},
		setSoundEnabled(value: boolean) {
			self.extensionState = { ...self.extensionState, soundEnabled: value }
		},
		setSoundVolume(value: number) {
			self.extensionState = { ...self.extensionState, soundVolume: value }
		},
		setTtsEnabled(value: boolean) {
			self.extensionState = { ...self.extensionState, ttsEnabled: value }
		},
		setTtsSpeed(value: number) {
			self.extensionState = { ...self.extensionState, ttsSpeed: value }
		},
		setEnableCheckpoints(value: boolean) {
			self.extensionState = { ...self.extensionState, enableCheckpoints: value }
		},
		setCheckpointTimeout(value: number) {
			self.extensionState = { ...self.extensionState, checkpointTimeout: value }
		},
		setWriteDelayMs(value: number) {
			self.extensionState = { ...self.extensionState, writeDelayMs: value }
		},
		setTerminalOutputPreviewSize(value: "small" | "medium" | "large") {
			self.extensionState = { ...self.extensionState, terminalOutputPreviewSize: value }
		},
		setTerminalShellIntegrationTimeout(value: number) {
			self.extensionState = { ...self.extensionState, terminalShellIntegrationTimeout: value }
		},
		setTerminalShellIntegrationDisabled(value: boolean) {
			self.extensionState = { ...self.extensionState, terminalShellIntegrationDisabled: value }
		},
		setTerminalZdotdir(value: boolean) {
			self.extensionState = { ...self.extensionState, terminalZdotdir: value }
		},
		setMcpEnabled(value: boolean) {
			self.extensionState = { ...self.extensionState, mcpEnabled: value }
		},
		setTaskSyncEnabled(value: boolean) {
			self.extensionState = { ...self.extensionState, taskSyncEnabled: value }
		},
		setCurrentApiConfigName(value: string) {
			self.extensionState = { ...self.extensionState, currentApiConfigName: value }
		},
		setListApiConfigMeta(value: ProviderSettingsEntry[]) {
			self.extensionState = { ...self.extensionState, listApiConfigMeta: value }
		},
		setMode(value: Mode) {
			self.extensionState = { ...self.extensionState, mode: value }
		},
		setCustomModePrompts(value: CustomModePrompts) {
			self.extensionState = { ...self.extensionState, customModePrompts: value }
		},
		setCustomSupportPrompts(value: CustomSupportPrompts) {
			self.extensionState = { ...self.extensionState, customSupportPrompts: value }
		},
		setSystemPromptTemplates(value: Record<string, string>) {
			self.extensionState = { ...self.extensionState, systemPromptTemplates: value }
		},
		setCustomModes(value: ModeConfig[]) {
			self.extensionState = { ...self.extensionState, customModes: value }
		},
		setMaxOpenTabsContext(value: number) {
			self.extensionState = { ...self.extensionState, maxOpenTabsContext: value }
		},
		setMaxWorkspaceFiles(value: number) {
			self.extensionState = { ...self.extensionState, maxWorkspaceFiles: value }
		},
		setTelemetrySetting(value: TelemetrySetting) {
			self.extensionState = { ...self.extensionState, telemetrySetting: value }
		},
		setShowRooIgnoredFiles(value: boolean) {
			self.extensionState = { ...self.extensionState, showJabberwockIgnoredFiles: value }
		},
		setEnableSubfolderRules(value: boolean) {
			self.extensionState = { ...self.extensionState, enableSubfolderRules: value }
		},
		setAwsUsePromptCache(value: boolean) {
			self.extensionState = {
				...self.extensionState,
				apiConfiguration: { ...self.extensionState.apiConfiguration, awsUsePromptCache: value },
			}
		},
		setMaxImageFileSize(value: number) {
			self.extensionState = { ...self.extensionState, maxImageFileSize: value }
		},
		setMaxTotalImageSize(value: number) {
			self.extensionState = { ...self.extensionState, maxTotalImageSize: value }
		},
		setPinnedApiConfigs(value: Record<string, boolean>) {
			self.extensionState = { ...self.extensionState, pinnedApiConfigs: value }
		},
		togglePinnedApiConfig(configId: string) {
			const currentPinned = self.extensionState.pinnedApiConfigs || {}
			const newPinned = { ...currentPinned, [configId]: !currentPinned[configId] }
			if (!newPinned[configId]) {
				delete newPinned[configId]
			}
			self.extensionState = { ...self.extensionState, pinnedApiConfigs: newPinned }
		},
		setHistoryPreviewCollapsed(value: boolean) {
			self.extensionState = { ...self.extensionState, historyPreviewCollapsed: value }
		},
		setReasoningBlockCollapsed(value: boolean) {
			self.extensionState = { ...self.extensionState, reasoningBlockCollapsed: value }
		},
		setEnterBehavior(value: "send" | "newline") {
			self.extensionState = { ...self.extensionState, enterBehavior: value }
		},
		setAutoCondenseContext(value: boolean) {
			self.extensionState = { ...self.extensionState, autoCondenseContext: value }
		},
		setAutoCondenseContextPercent(value: number) {
			self.extensionState = { ...self.extensionState, autoCondenseContextPercent: value }
		},
		setIncludeDiagnosticMessages(value: boolean) {
			self.extensionState = { ...self.extensionState, includeDiagnosticMessages: value }
		},
		setMaxDiagnosticMessages(value: number) {
			self.extensionState = { ...self.extensionState, maxDiagnosticMessages: value }
		},
		setShowWorktreesInHomeScreen(value: boolean) {
			self.extensionState = { ...self.extensionState, showWorktreesInHomeScreen: value }
		},
		setLocatorTarget(value: string) {
			self.extensionState = { ...self.extensionState, locatorTarget: value }
		},
		setExperimentEnabled(id: string, enabled: boolean) {
			self.extensionState = {
				...self.extensionState,
				experiments: { ...self.extensionState.experiments, [id]: enabled },
			}
		},

		setEnhancementApiConfigId(value: string) {
			self.extensionState = { ...self.extensionState, enhancementApiConfigId: value }
		},
		setAutoApprovalEnabled(value: boolean) {
			self.extensionState = { ...self.extensionState, autoApprovalEnabled: value }
		},

		// ── DevTool: expose state on window ─────────────────────────
		updateDevtoolState() {
			if (self.extensionState.devtoolEnabled) {
				;(window as WindowWithDevtool).__JABBERWOCK_GET_STATE__ = () => ({ ...self.extensionState })
			} else {
				delete (window as WindowWithDevtool).__JABBERWOCK_GET_STATE__
			}
		},

		// ── Cloud auth watch: request models when auth changes ──────
		checkCloudAuthChange() {
			const currentAuth = self.cloud.cloudIsAuthenticated ?? false
			const currentProvider = self.extensionState.apiConfiguration?.apiProvider
			if (!self.cloud.prevCloudIsAuthenticated && currentAuth && currentProvider === "jabberwock") {
				vscode.postMessage({ type: eventConstants.AGENT_STATE.REQUEST_ROUTER_MODELS } satisfies WebviewMessage)
			}
			self.cloud.setPrevCloudIsAuthenticated(currentAuth)
		},
	}))
	// ── Block 3: Message handler (routes extension messages to IntentBus) ──
	.actions((self) => ({
		handleExtensionMessage(event: MessageEvent) {
			const message: ExtensionMessage = event.data

			console.log(`[jabberwock] [DEBUG:WEBVIEW-MSG] got message type="${message.type}"`)

			// Handle DOM operations inline (not through IntentBus)
			if (message.type === "action") {
				if (message.action === "didBecomeVisible") {
					if (!self.chat.sendingDisabled && !self.chat.enableButtons) {
						document.querySelector<HTMLTextAreaElement>("textarea")?.focus()
					}
					return
				}
				if (message.action === "focusInput") {
					document.querySelector<HTMLTextAreaElement>("textarea")?.focus()
					return
				}
			}

			// Dispatch to IntentBus for all other message types
			const intentType = handleExtensionMessageDispatchMap[message.type]
			if (intentType) {
				self.intentStore.createIntent({
					id: crypto.randomUUID(),
					type: intentType,
					payload: { ...message } as Record<string, unknown>,
					createdAt: Date.now(),
				})
			}
		},
	}))
	// ── Block 4: initMessageListener ─────────────────────────────────────
	.actions((self) => ({
		initMessageListener() {
			window.addEventListener("message", self.handleExtensionMessage)
		},
	}))

export type IRootStore = Instance<typeof RootStore>

// ─── Singleton + onAction buffer ───────────────────────────────────
let _rootStore: IRootStore | null = null
const _actionBuffer: FrontendActionLogEntry[] = []
/** Dispose function for the IntentBus reaction, called on unmount. */
let _disposeIntentBus: (() => void) | null = null

export function createRootStore(): IRootStore {
	if (_rootStore) return _rootStore

	_rootStore = RootStore.create({
		didHydrateState: false,
		showWelcome: false,
		_welcomeDismissed: false,
		filePaths: [],
		openedTabs: [],
		extensionCommands: [],
		interactiveAppUri: "",
		currentCheckpoint: "",
	})

	onAction(_rootStore, (call: { name: string; path?: string; args?: unknown[] }) => {
		_actionBuffer.push({
			name: call.name,
			path: call.path ?? "",
			args: call.args ?? [],
			timestamp: Date.now(),
		})
		if (_actionBuffer.length > 500) _actionBuffer.shift()
	})

	// Start the IntentBus reaction — feature handlers register via bus.register()
	const { dispose } = setupIntents(_rootStore)
	_disposeIntentBus = dispose

	return _rootStore
}

export function getRootStore(): IRootStore {
	if (!_rootStore) throw new Error("RootStore not initialized. Call createRootStore() first.")
	return _rootStore
}

export function getFrontendActionBuffer(): FrontendActionLogEntry[] {
	return _actionBuffer
}

/**
 * Dispose the IntentBus reaction.
 * Call this when the webview unmounts to prevent memory leaks.
 */
export function disposeIntentBus(): void {
	if (_disposeIntentBus) {
		_disposeIntentBus()
		_disposeIntentBus = null
	}
}

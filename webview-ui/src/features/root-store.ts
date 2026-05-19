import { types, Instance, onAction } from "mobx-state-tree"

import { vscode } from "@jabberwock/devtool/react"
import type { WebviewMessage, ExtensionMessage, HistoryItem } from "@jabberwock/types"
import {
	ORGANIZATION_ALLOW_ALL,
	AGENT_STATE_AUTO_APPROVAL_ENABLED,
	AGENT_STATE_REQUEST_ROUTER_MODELS,
} from "@jabberwock/types"
import type {
	ExtensionState,
	ProviderSettings,
	ProviderSettingsEntry,
	Command,
	MarketplaceInstalledMetadata,
	CustomModePrompts,
	ModeConfig,
	TelemetrySetting,
} from "@jabberwock/types"
import { Mode } from "@shared/modes"
import type { CustomSupportPrompts } from "@shared/support-prompt"
import { experimentDefault } from "@shared/experiments"
import { jabberwockLog } from "../utils/jabberwock-logger"
import { findLastIndex } from "@shared/array"
import { checkExistKey } from "@shared/checkExistApiConfig"
import { convertTextMateToHljs } from "@src/utils/convertTextMateToHljs"

import { ChatStore } from "./chat/store"
import { SettingsStore } from "./settings/store"
import { MarketplaceStore } from "./marketplace/store"
import { CloudStore } from "./cloud/store"
import { TaskHistoryStore } from "./history/store"
import { WindowManagerStore } from "./foundation/window-manager/store"

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
					clineMessages: [],
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
	})
	// ── Block 1: mergeExtensionState ─────────────────────────────────────
	.actions((self) => ({
		mergeExtensionState(newState: Partial<ExtensionState>) {
			const prev = self.extensionState

			// Log incoming clineMessages at the central reception point
			const incomingMessages = newState.clineMessages
			if (incomingMessages && incomingMessages.length > 0) {
				const lastMessage = incomingMessages[incomingMessages.length - 1]
				const lastMessageType = `${lastMessage.type}:${lastMessage.say ?? lastMessage.ask ?? "unknown"}`
				jabberwockLog.log("state:clineMessages", {
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

			// Protect clineMessages from stale state pushes using sequence numbering
			if (
				newState.clineMessagesSeq !== undefined &&
				prev.clineMessagesSeq !== undefined &&
				newState.clineMessagesSeq <= prev.clineMessagesSeq &&
				newState.clineMessages !== undefined
			) {
				rest.clineMessages = prev.clineMessages
				rest.clineMessagesSeq = prev.clineMessagesSeq
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
				vscode.postMessage({ type: AGENT_STATE_REQUEST_ROUTER_MODELS } satisfies WebviewMessage)
			}
			self.cloud.setPrevCloudIsAuthenticated(currentAuth)
		},
	}))
	// ── Block 3: Message handler (routes extension messages to sub-stores) ──
	.actions((self) => ({
		handleExtensionMessage(event: MessageEvent) {
			const message: ExtensionMessage = event.data
			switch (message.type) {
				case "showInteractiveApp": {
					self.interactiveAppUri = message.uri ?? ""
					break
				}
				case "state": {
					const newState = message.state ?? {}
					const hasApiConfig = "apiConfiguration" in newState
					self.mergeExtensionState(newState)
					if (!self._welcomeDismissed && hasApiConfig) {
						const showWelcomeValue = !checkExistKey(newState.apiConfiguration)
						self.showWelcome = showWelcomeValue
					}
					self.didHydrateState = true

					// Route state fields to SettingsStore
					if (newState.alwaysAllowFollowupQuestions !== undefined) {
						self.settings.setAlwaysAllowFollowupQuestions(newState.alwaysAllowFollowupQuestions)
					}
					if (newState.followupAutoApproveTimeoutMs !== undefined) {
						self.settings.setFollowupAutoApproveTimeoutMs(newState.followupAutoApproveTimeoutMs)
					}
					if (newState.includeTaskHistoryInEnhance !== undefined) {
						self.settings.setIncludeTaskHistoryInEnhance(newState.includeTaskHistoryInEnhance)
					}
					if (newState.includeCurrentTime !== undefined) {
						self.settings.setIncludeCurrentTime(newState.includeCurrentTime)
					}
					if (newState.includeCurrentCost !== undefined) {
						self.settings.setIncludeCurrentCost(newState.includeCurrentCost)
					}
					if (newState.hasOpenedModeSelector !== undefined) {
						self.settings.setHasOpenedModeSelector(newState.hasOpenedModeSelector)
					}
					if (newState.profileThresholds !== undefined) {
						self.settings.setProfileThresholds(newState.profileThresholds)
					}
					if (newState.mcpServers !== undefined) {
						self.settings.setMcpServers(newState.mcpServers)
					}
					if (newState.routerModels !== undefined) {
						self.settings.setRouterModels(newState.routerModels)
					}
					if (newState.organizationAllowList !== undefined) {
						self.settings.setOrganizationAllowList(newState.organizationAllowList)
					}
					if (newState.organizationSettingsVersion !== undefined) {
						self.settings.setOrganizationSettingsVersion(newState.organizationSettingsVersion)
					}

					// Route locatorTarget on extensionState
					if (newState.locatorTarget !== undefined) {
						self.extensionState = { ...self.extensionState, locatorTarget: newState.locatorTarget }
					}

					// Route state fields to MarketplaceStore
					if (newState.marketplaceItems !== undefined) {
						self.marketplace.setMarketplaceData(
							newState.marketplaceItems,
							newState.marketplaceInstalledMetadata as MarketplaceInstalledMetadata | undefined,
						)
					}
					if (newState.skills !== undefined) {
						self.marketplace.setSkills(newState.skills)
					}

					// Route state fields to CloudStore
					if (newState.cloudIsAuthenticated !== undefined) {
						self.cloud.setCloudIsAuthenticated(newState.cloudIsAuthenticated)
					}
					if (newState.cloudOrganizations !== undefined) {
						self.cloud.setCloudOrganizations(newState.cloudOrganizations)
					}
					if (newState.sharingEnabled !== undefined) {
						self.cloud.setSharingEnabled(newState.sharingEnabled)
					}
					if (newState.publicSharingEnabled !== undefined) {
						self.cloud.setPublicSharingEnabled(newState.publicSharingEnabled)
					}
					break
				}
				case "action": {
					if (message.action === "toggleAutoApprove") {
						const newValue = !(self.extensionState.autoApprovalEnabled ?? false)
						self.extensionState = { ...self.extensionState, autoApprovalEnabled: newValue }
						vscode.postMessage({ type: AGENT_STATE_AUTO_APPROVAL_ENABLED, bool: newValue })
					} else if (message.action === "didBecomeVisible") {
						if (!self.chat.ui.sendingDisabled && !self.chat.ui.enableButtons) {
							document.querySelector<HTMLTextAreaElement>("textarea")?.focus()
						}
					} else if (message.action === "focusInput") {
						document.querySelector<HTMLTextAreaElement>("textarea")?.focus()
					}
					break
				}
				case "theme": {
					if (message.text) {
						self.theme = convertTextMateToHljs(JSON.parse(message.text))
					}
					break
				}
				case "workspaceUpdated": {
					const paths = message.filePaths ?? []
					const tabs = message.openedTabs ?? []
					const uri = message.uri
					self.filePaths = paths
					self.openedTabs = tabs as Array<{ label: string; isActive: boolean; path?: string }>
					if (uri) {
						self.extensionState = { ...self.extensionState, cwd: uri }
					}
					break
				}
				case "commands": {
					self.extensionCommands = message.commands ?? []
					break
				}
				case "messageUpdated": {
					const clineMessage = message.clineMessage!
					const currentMessages = self.extensionState.clineMessages
					const lastIndex = findLastIndex(currentMessages, (msg: ClineMessage) => msg.ts === clineMessage.ts)
					let newMessages: ClineMessage[]
					if (lastIndex !== -1) {
						newMessages = [...currentMessages]
						newMessages[lastIndex] = clineMessage
					} else {
						newMessages = [...currentMessages, clineMessage]
					}
					self.extensionState = { ...self.extensionState, clineMessages: newMessages }
					break
				}
				case "skills": {
					if (message.skills) {
						self.marketplace.setSkills(message.skills)
					}
					break
				}
				case "mcpServers": {
					self.settings.setMcpServers(message.mcpServers ?? [])
					break
				}
				case "currentCheckpointUpdated": {
					self.currentCheckpoint = message.text ?? ""
					break
				}
				case "listApiConfig": {
					self.extensionState = { ...self.extensionState, listApiConfigMeta: message.listApiConfig ?? [] }
					break
				}
				case "routerModels": {
					self.settings.setRouterModels(message.routerModels!)
					break
				}
				case "marketplaceData": {
					if (message.marketplaceItems !== undefined) {
						self.marketplace.setMarketplaceData(
							message.marketplaceItems,
							message.marketplaceInstalledMetadata as MarketplaceInstalledMetadata | undefined,
						)
					}
					break
				}
				case "taskHistoryUpdated": {
					if (message.taskHistory !== undefined) {
						self.extensionState = { ...self.extensionState, taskHistory: message.taskHistory }
					}
					break
				}
				case "taskHistoryItemUpdated": {
					const item = message.historyItem
					if (!item) break
					const currentHistory = self.extensionState.taskHistory
					const existingIndex = currentHistory.findIndex((h: HistoryItem) => h.id === item.id)
					let nextHistory: HistoryItem[]
					if (existingIndex === -1) {
						nextHistory = [item, ...currentHistory]
					} else {
						nextHistory = [...currentHistory]
						nextHistory[existingIndex] = item
					}
					nextHistory.sort((a: HistoryItem, b: HistoryItem) => b.ts - a.ts)
					const currentTaskItem =
						!self.extensionState.currentTaskItem || self.extensionState.currentTaskItem.id === item.id
							? item
							: self.extensionState.currentTaskItem
					self.extensionState = { ...self.extensionState, taskHistory: nextHistory, currentTaskItem }
					break
				}
				case "diagnostics": {
					if (message.diagnostics) {
						self.extensionState = { ...self.extensionState, diagnostics: message.diagnostics }
					}
					break
				}

				// ── Event-dispatch merged cases ──────────────────────
				case "invoke": {
					const invoke = message.invoke
					if (invoke === "newChat") {
						self.chat.ui.clearInput()
						self.chat.ui.setSendingDisabled(false)
					} else if (invoke === "sendMessage") {
						self.chat.sendMessage(message.text ?? "", message.images ?? [])
					} else if (invoke === "setChatBoxMessage") {
						self.chat.ui.setInputValue(
							self.chat.ui.inputValue !== ""
								? self.chat.ui.inputValue + " " + (message.text ?? "")
								: (message.text ?? ""),
						)
						self.chat.ui.appendSelectedImages(message.images ?? [])
					} else if (invoke === "primaryButtonClick") {
						// Route command_output to SettingsStore before delegating to ChatStore
						const primaryClineAsk = self.chat.ui.clineAsk
						if (primaryClineAsk === "command_output") {
							self.settings.terminalOperation("continue")
						}
						self.chat.handlePrimaryButtonClick(
							undefined,
							undefined,
							[],
							message.text ?? "",
							message.images ?? [],
						)
					} else if (invoke === "secondaryButtonClick") {
						// Route command_output to SettingsStore before delegating to ChatStore
						if (self.chat.ui.isStreaming) {
							self.chat.cancelTask()
						} else {
							const secondaryClineAsk = self.chat.ui.clineAsk
							if (secondaryClineAsk === "command_output") {
								self.settings.terminalOperation("abort")
							}
							self.chat.handleSecondaryButtonClick(
								undefined,
								false,
								message.text ?? "",
								message.images ?? [],
							)
						}
					} else if (invoke === "approveTodoPlan") {
						if (message.values) {
							self.chat.elicitResponse(message.values)
						} else {
							document
								.querySelectorAll("iframe")
								.forEach((iframe) =>
									iframe.contentWindow?.postMessage({ type: "mcp-force-accept" }, "*"),
								)
						}
					}
					break
				}
				case "selectedImages": {
					if (message.context !== "edit" && message.images) {
						self.chat.ui.appendSelectedImages(message.images.slice(0, 20))
					}
					break
				}
				case "condenseTaskContextStarted": {
					if (message.text) self.chat.ui.setIsCondensing(true)
					break
				}
				case "condenseTaskContextResponse": {
					if (message.text) {
						if (self.chat.ui.isCondensing && self.chat.ui.sendingDisabled)
							self.chat.ui.setSendingDisabled(false)
						self.chat.ui.setIsCondensing(false)
					}
					break
				}
				case "checkpointInitWarning": {
					self.chat.ui.setCheckpointWarning(message.checkpointWarning ?? undefined)
					break
				}
				case "interactionRequired": {
					break
				}
				case "taskWithAggregatedCosts": {
					if (message.text && message.aggregatedCosts) {
						self.chat.ui.updateAggregatedCosts(message.text, message.aggregatedCosts)
					}
					break
				}
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

	return _rootStore
}

export function getRootStore(): IRootStore {
	if (!_rootStore) throw new Error("RootStore not initialized. Call createRootStore() first.")
	return _rootStore
}

export function getFrontendActionBuffer(): FrontendActionLogEntry[] {
	return _actionBuffer
}

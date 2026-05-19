import { vscode } from "@jabberwock/devtool/react"
import type {
	WebviewMessage,
	ExtensionState,
	ProviderSettings,
	CustomModePrompts,
	ModeConfig,
	TelemetrySetting,
	ProviderSettingsEntry,
} from "@jabberwock/types"
import { AGENT_STATE_REQUEST_ROUTER_MODELS } from "@jabberwock/types"
import { Mode } from "@shared/modes"
import { CustomSupportPrompts } from "@shared/support-prompt"

// ── ChatStore-compatible action factory (to be spread into ChatStore's .actions()) ──

interface ExtensionStateSelf {
	_welcomeDismissed: boolean
	showWelcome: boolean
	interactiveAppUri?: string
	currentCheckpoint?: string
	hasOpenedModeSelector: boolean
	alwaysAllowFollowupQuestions: boolean
	followupAutoApproveTimeoutMs: number
	profileThresholds: Record<string, number>
	includeTaskHistoryInEnhance: boolean
	includeCurrentTime: boolean
	includeCurrentCost: boolean
	extensionState: ExtensionState
	prevCloudIsAuthenticated: boolean
	cloudIsAuthenticated: boolean
}

export function createExtensionStateActions(self: ExtensionStateSelf) {
	return {
		// ── Welcome dismiss tracking ────────────────────────────────
		setShowWelcome(value: boolean) {
			if (!value) {
				self._welcomeDismissed = true
			}
			self.showWelcome = value
		},

		// ── Local state setters (mirroring ExtensionStateContext) ────
		setInteractiveAppUri(uri?: string) {
			self.interactiveAppUri = uri
		},
		setCurrentCheckpoint(text?: string) {
			self.currentCheckpoint = text
		},
		setHasOpenedModeSelector(value: boolean) {
			self.hasOpenedModeSelector = value
		},
		setAlwaysAllowFollowupQuestions(value: boolean) {
			self.alwaysAllowFollowupQuestions = value
		},
		setFollowupAutoApproveTimeoutMs(value: number) {
			self.followupAutoApproveTimeoutMs = value
		},
		setProfileThresholds(value: Record<string, number>) {
			self.profileThresholds = value
		},
		setIncludeTaskHistoryInEnhance(value: boolean) {
			self.includeTaskHistoryInEnhance = value
		},
		setIncludeCurrentTime(value: boolean) {
			self.includeCurrentTime = value
		},
		setIncludeCurrentCost(value: boolean) {
			self.includeCurrentCost = value
		},

		// ── Extension state setters (update local state only) ────────
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

		// ── DevTool: expose state on window ─────────────────────────
		updateDevtoolState() {
			if (self.extensionState.devtoolEnabled) {
				window.__JABBERWOCK_GET_STATE__ = () => ({ ...self.extensionState })
			} else {
				delete window.__JABBERWOCK_GET_STATE__
			}
		},

		// ── Cloud auth watch: request models when auth changes ──────
		checkCloudAuthChange() {
			const currentAuth = self.extensionState.cloudIsAuthenticated ?? false
			const currentProvider = self.extensionState.apiConfiguration?.apiProvider
			if (!self.prevCloudIsAuthenticated && currentAuth && currentProvider === "jabberwock") {
				vscode.postMessage({ type: AGENT_STATE_REQUEST_ROUTER_MODELS } satisfies WebviewMessage)
			}
			self.prevCloudIsAuthenticated = currentAuth
		},
	}
}

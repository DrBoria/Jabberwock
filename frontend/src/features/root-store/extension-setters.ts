import type { ProviderSettings } from "@jabberwock/types"

import { setExtensionStateField } from "./helpers"
import type { RootStoreSelf } from "./types"

export function createExtensionSetters(self: RootStoreSelf) {
	return {
		setShowWelcome(v: boolean) {
			if (!v) self._welcomeDismissed = true
			self.showWelcome = v
		},
		setInteractiveAppUri(u: string) {
			self.interactiveAppUri = u
		},
		setCurrentCheckpoint(t: string) {
			self.currentCheckpoint = t
		},
		setHasOpenedModeSelector(v: boolean) {
			self.settings.setHasOpenedModeSelector(v)
		},
		setAlwaysAllowFollowupQuestions(v: boolean) {
			self.extensionState = { ...self.extensionState, alwaysAllowFollowupQuestions: v }
			self.settings.setAlwaysAllowFollowupQuestions(v)
		},
		setFollowupAutoApproveTimeoutMs(v: number) {
			self.settings.setFollowupAutoApproveTimeoutMs(v)
		},
		setProfileThresholds(v: Record<string, number>) {
			self.settings.setProfileThresholds(v)
		},
		setIncludeTaskHistoryInEnhance(v: boolean) {
			self.settings.setIncludeTaskHistoryInEnhance(v)
		},
		setIncludeCurrentTime(v: boolean) {
			self.settings.setIncludeCurrentTime(v)
		},
		setIncludeCurrentCost(v: boolean) {
			self.settings.setIncludeCurrentCost(v)
		},
		setApiConfiguration(c: ProviderSettings) {
			self.extensionState = {
				...self.extensionState,
				apiConfiguration: { ...self.extensionState.apiConfiguration, ...c },
			}
		},
		setCustomInstructions(v?: string) {
			self.extensionState = { ...self.extensionState, customInstructions: v }
		},
		setAlwaysAllowReadOnly: setExtensionStateField(self, "alwaysAllowReadOnly"),
		setAlwaysAllowReadOnlyOutsideWorkspace: setExtensionStateField(self, "alwaysAllowReadOnlyOutsideWorkspace"),
		setAlwaysAllowWrite: setExtensionStateField(self, "alwaysAllowWrite"),
		setAlwaysAllowWriteOutsideWorkspace: setExtensionStateField(self, "alwaysAllowWriteOutsideWorkspace"),
		setAlwaysAllowExecute: setExtensionStateField(self, "alwaysAllowExecute"),
		setAlwaysAllowMcp: setExtensionStateField(self, "alwaysAllowMcp"),
		setAlwaysAllowModeSwitch: setExtensionStateField(self, "alwaysAllowModeSwitch"),
		setAlwaysAllowSubtasks: setExtensionStateField(self, "alwaysAllowSubtasks"),
		setShowAnnouncement: setExtensionStateField(self, "shouldShowAnnouncement"),
		setAllowedCommands: setExtensionStateField(self, "allowedCommands"),
		setDeniedCommands: setExtensionStateField(self, "deniedCommands"),
		setAllowedMaxRequests: setExtensionStateField(self, "allowedMaxRequests"),
		setAllowedMaxCost: setExtensionStateField(self, "allowedMaxCost"),
		setSoundEnabled: setExtensionStateField(self, "soundEnabled"),
		setSoundVolume: setExtensionStateField(self, "soundVolume"),
		setTtsEnabled: setExtensionStateField(self, "ttsEnabled"),
		setTtsSpeed: setExtensionStateField(self, "ttsSpeed"),
		setEnableCheckpoints: setExtensionStateField(self, "enableCheckpoints"),
		setCheckpointTimeout: setExtensionStateField(self, "checkpointTimeout"),
		setWriteDelayMs: setExtensionStateField(self, "writeDelayMs"),
		setTerminalOutputPreviewSize: setExtensionStateField(self, "terminalOutputPreviewSize"),
		setTerminalShellIntegrationTimeout: setExtensionStateField(self, "terminalShellIntegrationTimeout"),
		setTerminalShellIntegrationDisabled: setExtensionStateField(self, "terminalShellIntegrationDisabled"),
		setTerminalZdotdir: setExtensionStateField(self, "terminalZdotdir"),
		setMcpEnabled: setExtensionStateField(self, "mcpEnabled"),
		setTaskSyncEnabled: setExtensionStateField(self, "taskSyncEnabled"),
		setCurrentApiConfigName: setExtensionStateField(self, "currentApiConfigName"),
		setListApiConfigMeta: setExtensionStateField(self, "listApiConfigMeta"),
		setMode: setExtensionStateField(self, "mode"),
		setCustomModePrompts: setExtensionStateField(self, "customModePrompts"),
		setCustomSupportPrompts: setExtensionStateField(self, "customSupportPrompts"),
		setSystemPromptTemplates: setExtensionStateField(self, "systemPromptTemplates"),
		setCustomModes: setExtensionStateField(self, "customModes"),
		setMaxOpenTabsContext: setExtensionStateField(self, "maxOpenTabsContext"),
		setMaxWorkspaceFiles: setExtensionStateField(self, "maxWorkspaceFiles"),
		setTelemetrySetting: setExtensionStateField(self, "telemetrySetting"),
		setShowRooIgnoredFiles: setExtensionStateField(self, "showJabberwockIgnoredFiles"),
		setEnableSubfolderRules: setExtensionStateField(self, "enableSubfolderRules"),
		setAwsUsePromptCache(v: boolean) {
			self.extensionState = {
				...self.extensionState,
				apiConfiguration: { ...self.extensionState.apiConfiguration, awsUsePromptCache: v },
			}
		},
		setMaxImageFileSize: setExtensionStateField(self, "maxImageFileSize"),
		setMaxTotalImageSize: setExtensionStateField(self, "maxTotalImageSize"),
		setPinnedApiConfigs: setExtensionStateField(self, "pinnedApiConfigs"),
		togglePinnedApiConfig(id: string) {
			const p = self.extensionState.pinnedApiConfigs || {}
			const n = { ...p, [id]: !p[id] }
			if (!n[id]) delete n[id]
			self.extensionState = { ...self.extensionState, pinnedApiConfigs: n }
		},
		setHistoryPreviewCollapsed: setExtensionStateField(self, "historyPreviewCollapsed"),
		setReasoningBlockCollapsed: setExtensionStateField(self, "reasoningBlockCollapsed"),
		setEnterBehavior: setExtensionStateField(self, "enterBehavior"),
		setAutoCondenseContext: setExtensionStateField(self, "autoCondenseContext"),
		setAutoCondenseContextPercent: setExtensionStateField(self, "autoCondenseContextPercent"),
		setIncludeDiagnosticMessages: setExtensionStateField(self, "includeDiagnosticMessages"),
		setMaxDiagnosticMessages: setExtensionStateField(self, "maxDiagnosticMessages"),
		setShowWorktreesInHomeScreen: setExtensionStateField(self, "showWorktreesInHomeScreen"),
		setLocatorTarget: setExtensionStateField(self, "locatorTarget"),
		setExperimentEnabled(id: string, enabled: boolean) {
			self.extensionState = {
				...self.extensionState,
				experiments: { ...self.extensionState.experiments, [id]: enabled },
			}
		},
		setEnhancementApiConfigId: setExtensionStateField(self, "enhancementApiConfigId"),
		setAutoApprovalEnabled: setExtensionStateField(self, "autoApprovalEnabled"),
	}
}

import type { ProviderSettings } from "@jabberwock/types"
import type { RootStoreSelf } from "./types"

export function createExtensionSettersPart1(self: RootStoreSelf) {
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
		setAlwaysAllowReadOnly(v: boolean) {
			self.extensionState = { ...self.extensionState, alwaysAllowReadOnly: v }
		},
		setAlwaysAllowReadOnlyOutsideWorkspace(v: boolean) {
			self.extensionState = { ...self.extensionState, alwaysAllowReadOnlyOutsideWorkspace: v }
		},
		setAlwaysAllowWrite(v: boolean) {
			self.extensionState = { ...self.extensionState, alwaysAllowWrite: v }
		},
		setAlwaysAllowWriteOutsideWorkspace(v: boolean) {
			self.extensionState = { ...self.extensionState, alwaysAllowWriteOutsideWorkspace: v }
		},
		setAlwaysAllowExecute(v: boolean) {
			self.extensionState = { ...self.extensionState, alwaysAllowExecute: v }
		},
		setAlwaysAllowMcp(v: boolean) {
			self.extensionState = { ...self.extensionState, alwaysAllowMcp: v }
		},
		setAlwaysAllowModeSwitch(v: boolean) {
			self.extensionState = { ...self.extensionState, alwaysAllowModeSwitch: v }
		},
		setAlwaysAllowSubtasks(v: boolean) {
			self.extensionState = { ...self.extensionState, alwaysAllowSubtasks: v }
		},
		setShowAnnouncement(v: boolean) {
			self.extensionState = { ...self.extensionState, shouldShowAnnouncement: v }
		},
		setAllowedCommands(v: string[]) {
			self.extensionState = { ...self.extensionState, allowedCommands: v }
		},
		setDeniedCommands(v: string[]) {
			self.extensionState = { ...self.extensionState, deniedCommands: v }
		},
		setAllowedMaxRequests(v: number | undefined) {
			self.extensionState = { ...self.extensionState, allowedMaxRequests: v }
		},
		setAllowedMaxCost(v: number | undefined) {
			self.extensionState = { ...self.extensionState, allowedMaxCost: v }
		},
		setSoundEnabled(v: boolean) {
			self.extensionState = { ...self.extensionState, soundEnabled: v }
		},
		setSoundVolume(v: number) {
			self.extensionState = { ...self.extensionState, soundVolume: v }
		},
		setTtsEnabled(v: boolean) {
			self.extensionState = { ...self.extensionState, ttsEnabled: v }
		},
		setTtsSpeed(v: number) {
			self.extensionState = { ...self.extensionState, ttsSpeed: v }
		},
		setEnableCheckpoints(v: boolean) {
			self.extensionState = { ...self.extensionState, enableCheckpoints: v }
		},
		setCheckpointTimeout(v: number) {
			self.extensionState = { ...self.extensionState, checkpointTimeout: v }
		},
		setWriteDelayMs(v: number) {
			self.extensionState = { ...self.extensionState, writeDelayMs: v }
		},
		setTerminalOutputPreviewSize(v: "small" | "medium" | "large") {
			self.extensionState = { ...self.extensionState, terminalOutputPreviewSize: v }
		},
		setTerminalShellIntegrationTimeout(v: number) {
			self.extensionState = { ...self.extensionState, terminalShellIntegrationTimeout: v }
		},
		setTerminalShellIntegrationDisabled(v: boolean) {
			self.extensionState = { ...self.extensionState, terminalShellIntegrationDisabled: v }
		},
		setTerminalZdotdir(v: boolean) {
			self.extensionState = { ...self.extensionState, terminalZdotdir: v }
		},
		setMcpEnabled(v: boolean) {
			self.extensionState = { ...self.extensionState, mcpEnabled: v }
		},
	}
}

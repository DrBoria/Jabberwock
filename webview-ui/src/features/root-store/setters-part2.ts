import type { ProviderSettingsEntry, CustomModePrompts, ModeConfig, TelemetrySetting } from "@jabberwock/types"
import type { Mode } from "@shared/modes"
import type { CustomSupportPrompts } from "@shared/support-prompt"
import type { RootStoreSelf } from "./types"

export function createExtensionSettersPart2(self: RootStoreSelf) {
	return {
		setTaskSyncEnabled(v: boolean) {
			self.extensionState = { ...self.extensionState, taskSyncEnabled: v }
		},
		setCurrentApiConfigName(v: string) {
			self.extensionState = { ...self.extensionState, currentApiConfigName: v }
		},
		setListApiConfigMeta(v: ProviderSettingsEntry[]) {
			self.extensionState = { ...self.extensionState, listApiConfigMeta: v }
		},
		setMode(v: Mode) {
			self.extensionState = { ...self.extensionState, mode: v }
		},
		setCustomModePrompts(v: CustomModePrompts) {
			self.extensionState = { ...self.extensionState, customModePrompts: v }
		},
		setCustomSupportPrompts(v: CustomSupportPrompts) {
			self.extensionState = { ...self.extensionState, customSupportPrompts: v }
		},
		setSystemPromptTemplates(v: Record<string, string>) {
			self.extensionState = { ...self.extensionState, systemPromptTemplates: v }
		},
		setCustomModes(v: ModeConfig[]) {
			self.extensionState = { ...self.extensionState, customModes: v }
		},
		setMaxOpenTabsContext(v: number) {
			self.extensionState = { ...self.extensionState, maxOpenTabsContext: v }
		},
		setMaxWorkspaceFiles(v: number) {
			self.extensionState = { ...self.extensionState, maxWorkspaceFiles: v }
		},
		setTelemetrySetting(v: TelemetrySetting) {
			self.extensionState = { ...self.extensionState, telemetrySetting: v }
		},
		setShowRooIgnoredFiles(v: boolean) {
			self.extensionState = { ...self.extensionState, showJabberwockIgnoredFiles: v }
		},
		setEnableSubfolderRules(v: boolean) {
			self.extensionState = { ...self.extensionState, enableSubfolderRules: v }
		},
		setAwsUsePromptCache(v: boolean) {
			self.extensionState = {
				...self.extensionState,
				apiConfiguration: { ...self.extensionState.apiConfiguration, awsUsePromptCache: v },
			}
		},
		setMaxImageFileSize(v: number) {
			self.extensionState = { ...self.extensionState, maxImageFileSize: v }
		},
		setMaxTotalImageSize(v: number) {
			self.extensionState = { ...self.extensionState, maxTotalImageSize: v }
		},
		setPinnedApiConfigs(v: Record<string, boolean>) {
			self.extensionState = { ...self.extensionState, pinnedApiConfigs: v }
		},
		togglePinnedApiConfig(id: string) {
			const p = self.extensionState.pinnedApiConfigs || {}
			const n = { ...p, [id]: !p[id] }
			if (!n[id]) delete n[id]
			self.extensionState = { ...self.extensionState, pinnedApiConfigs: n }
		},
		setHistoryPreviewCollapsed(v: boolean) {
			self.extensionState = { ...self.extensionState, historyPreviewCollapsed: v }
		},
		setReasoningBlockCollapsed(v: boolean) {
			self.extensionState = { ...self.extensionState, reasoningBlockCollapsed: v }
		},
		setEnterBehavior(v: "send" | "newline") {
			self.extensionState = { ...self.extensionState, enterBehavior: v }
		},
		setAutoCondenseContext(v: boolean) {
			self.extensionState = { ...self.extensionState, autoCondenseContext: v }
		},
		setAutoCondenseContextPercent(v: number) {
			self.extensionState = { ...self.extensionState, autoCondenseContextPercent: v }
		},
		setIncludeDiagnosticMessages(v: boolean) {
			self.extensionState = { ...self.extensionState, includeDiagnosticMessages: v }
		},
		setMaxDiagnosticMessages(v: number) {
			self.extensionState = { ...self.extensionState, maxDiagnosticMessages: v }
		},
		setShowWorktreesInHomeScreen(v: boolean) {
			self.extensionState = { ...self.extensionState, showWorktreesInHomeScreen: v }
		},
		setLocatorTarget(v: string) {
			self.extensionState = { ...self.extensionState, locatorTarget: v }
		},
		setExperimentEnabled(id: string, enabled: boolean) {
			self.extensionState = {
				...self.extensionState,
				experiments: { ...self.extensionState.experiments, [id]: enabled },
			}
		},
		setEnhancementApiConfigId(v: string) {
			self.extensionState = { ...self.extensionState, enhancementApiConfigId: v }
		},
		setAutoApprovalEnabled(v: boolean) {
			self.extensionState = { ...self.extensionState, autoApprovalEnabled: v }
		},
	}
}

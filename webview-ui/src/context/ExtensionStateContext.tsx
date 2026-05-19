import type {
	ExtensionState,
	ProviderSettings,
	ProviderSettingsEntry,
	CustomModePrompts,
	ModeConfig,
	ExperimentId,
	TelemetrySetting,
	OrganizationAllowList,
	CloudOrganizationMembership,
	MarketplaceItem,
	MarketplaceInstalledMetadata,
	SkillMetadata,
	Command,
	McpServer,
	RouterModels,
	TodoItem,
} from "@jabberwock/types"

import { Mode } from "@shared/modes"
import { CustomSupportPrompts } from "@shared/support-prompt"

import React from "react"

import { rootStore } from "@src/features/store"

/**
 * Compatibility interface that mirrors the shape of ExtensionStateContextType
 * for components that have not yet been migrated to use rootStore directly.
 *
 * @deprecated Migrate to using `rootStore` from `@src/features/store` directly.
 *   Components should wrap with `observer()` from mobx-react-lite and read
 *   state from `rootStore.extensionState.*` or `rootStore.*` for local state.
 */
export interface ExtensionStateContextType extends ExtensionState {
	historyPreviewCollapsed?: boolean
	didHydrateState: boolean
	showWelcome: boolean
	setShowWelcome: (value: boolean) => void
	theme: Record<string, string> | undefined
	mcpServers: McpServer[]
	interactiveAppUri?: string
	setInteractiveAppUri: (uri: string) => void
	currentCheckpoint?: string
	currentTaskTodos?: TodoItem[]
	filePaths: string[]
	openedTabs: Array<{ label: string; isActive: boolean; path?: string }>
	commands: Command[]
	organizationAllowList: OrganizationAllowList
	organizationSettingsVersion: number
	cloudIsAuthenticated: boolean
	cloudOrganizations?: CloudOrganizationMembership[]
	sharingEnabled: boolean
	publicSharingEnabled: boolean
	mdmCompliant?: boolean
	hasOpenedModeSelector: boolean
	setHasOpenedModeSelector: (value: boolean) => void
	alwaysAllowFollowupQuestions: boolean
	setAlwaysAllowFollowupQuestions: (value: boolean) => void
	followupAutoApproveTimeoutMs: number | undefined
	setFollowupAutoApproveTimeoutMs: (value: number) => void
	marketplaceItems?: MarketplaceItem[]
	marketplaceInstalledMetadata?: MarketplaceInstalledMetadata
	profileThresholds: Record<string, number>
	setProfileThresholds: (value: Record<string, number>) => void
	setApiConfiguration: (config: ProviderSettings) => void
	setCustomInstructions: (value?: string) => void
	setAlwaysAllowReadOnly: (value: boolean) => void
	setAlwaysAllowReadOnlyOutsideWorkspace: (value: boolean) => void
	setAlwaysAllowWrite: (value: boolean) => void
	setAlwaysAllowWriteOutsideWorkspace: (value: boolean) => void
	setAlwaysAllowExecute: (value: boolean) => void
	setAlwaysAllowMcp: (value: boolean) => void
	setAlwaysAllowModeSwitch: (value: boolean) => void
	setAlwaysAllowSubtasks: (value: boolean) => void
	setShowRooIgnoredFiles: (value: boolean) => void
	setEnableSubfolderRules: (value: boolean) => void
	setShowAnnouncement: (value: boolean) => void
	setAllowedCommands: (value: string[]) => void
	setDeniedCommands: (value: string[]) => void
	setAllowedMaxRequests: (value: number | undefined) => void
	setAllowedMaxCost: (value: number | undefined) => void
	setSoundEnabled: (value: boolean) => void
	setSoundVolume: (value: number) => void
	terminalShellIntegrationTimeout?: number
	setTerminalShellIntegrationTimeout: (value: number) => void
	terminalShellIntegrationDisabled?: boolean
	setTerminalShellIntegrationDisabled: (value: boolean) => void
	terminalZdotdir?: boolean
	setTerminalZdotdir: (value: boolean) => void
	setTtsEnabled: (value: boolean) => void
	setTtsSpeed: (value: number) => void
	setEnableCheckpoints: (value: boolean) => void
	checkpointTimeout: number
	setCheckpointTimeout: (value: number) => void
	setWriteDelayMs: (value: number) => void
	terminalOutputPreviewSize?: "small" | "medium" | "large"
	setTerminalOutputPreviewSize: (value: "small" | "medium" | "large") => void
	mcpEnabled: boolean
	setMcpEnabled: (value: boolean) => void
	taskSyncEnabled: boolean
	setTaskSyncEnabled: (value: boolean) => void
	setCurrentApiConfigName: (value: string) => void
	setListApiConfigMeta: (value: ProviderSettingsEntry[]) => void
	mode: Mode
	setMode: (value: Mode) => void
	setCustomModePrompts: (value: CustomModePrompts) => void
	setCustomSupportPrompts: (value: CustomSupportPrompts) => void
	systemPromptTemplates?: Record<string, string>
	setSystemPromptTemplates: (value: Record<string, string>) => void
	enhancementApiConfigId?: string
	setEnhancementApiConfigId: (value: string) => void
	setExperimentEnabled: (id: ExperimentId, enabled: boolean) => void
	setAutoApprovalEnabled: (value: boolean) => void
	customModes: ModeConfig[]
	setCustomModes: (value: ModeConfig[]) => void
	setMaxOpenTabsContext: (value: number) => void
	maxWorkspaceFiles: number
	setMaxWorkspaceFiles: (value: number) => void
	setTelemetrySetting: (value: TelemetrySetting) => void
	awsUsePromptCache?: boolean
	setAwsUsePromptCache: (value: boolean) => void
	maxImageFileSize: number
	setMaxImageFileSize: (value: number) => void
	maxTotalImageSize: number
	setMaxTotalImageSize: (value: number) => void
	machineId?: string
	pinnedApiConfigs?: Record<string, boolean>
	setPinnedApiConfigs: (value: Record<string, boolean>) => void
	togglePinnedApiConfig: (configName: string) => void
	setHistoryPreviewCollapsed: (value: boolean) => void
	setReasoningBlockCollapsed: (value: boolean) => void
	enterBehavior?: "send" | "newline"
	setEnterBehavior: (value: "send" | "newline") => void
	autoCondenseContext: boolean
	setAutoCondenseContext: (value: boolean) => void
	autoCondenseContextPercent: number
	setAutoCondenseContextPercent: (value: number) => void
	routerModels?: RouterModels
	includeDiagnosticMessages?: boolean
	setIncludeDiagnosticMessages: (value: boolean) => void
	maxDiagnosticMessages?: number
	setMaxDiagnosticMessages: (value: number) => void
	includeTaskHistoryInEnhance?: boolean
	setIncludeTaskHistoryInEnhance: (value: boolean) => void
	includeCurrentTime?: boolean
	setIncludeCurrentTime: (value: boolean) => void
	includeCurrentCost?: boolean
	setIncludeCurrentCost: (value: boolean) => void
	showWorktreesInHomeScreen: boolean
	setShowWorktreesInHomeScreen: (value: boolean) => void
	locatorTarget?: string
	setLocatorTarget: (value: string) => void
	skills?: SkillMetadata[]
}

/**
 * Reads the current extension state from the RootStore.
 * Components using this hook should be wrapped with `observer()` from mobx-react-lite
 * to reactively re-render when state changes.
 *
 * @deprecated Use `rootStore` directly from `@src/features/store` instead.
 */
export const useExtensionState = (): ExtensionStateContextType => {
	const s = rootStore.extensionState
	return {
		...s,
		historyPreviewCollapsed: s.historyPreviewCollapsed,
		didHydrateState: rootStore.didHydrateState,
		showWelcome: rootStore.showWelcome,
		setShowWelcome: (value: boolean) => rootStore.setShowWelcome(value),
		theme: rootStore.theme,
		mcpServers: rootStore.settings.mcpServers,
		interactiveAppUri: rootStore.interactiveAppUri,
		setInteractiveAppUri: (uri: string) => rootStore.setInteractiveAppUri(uri),
		currentCheckpoint: rootStore.currentCheckpoint,
		filePaths: rootStore.filePaths,
		openedTabs: rootStore.openedTabs,
		commands: rootStore.extensionCommands,
		organizationAllowList: rootStore.settings.organizationAllowList,
		organizationSettingsVersion: rootStore.settings.organizationSettingsVersion,
		cloudIsAuthenticated: rootStore.cloud.cloudIsAuthenticated,
		cloudOrganizations: rootStore.cloud.cloudOrganizations,
		sharingEnabled: rootStore.cloud.sharingEnabled,
		publicSharingEnabled: rootStore.cloud.publicSharingEnabled,
		hasOpenedModeSelector: rootStore.settings.hasOpenedModeSelector,
		setHasOpenedModeSelector: (value: boolean) => rootStore.setHasOpenedModeSelector(value),
		alwaysAllowFollowupQuestions: rootStore.settings.alwaysAllowFollowupQuestions,
		setAlwaysAllowFollowupQuestions: (value: boolean) => rootStore.setAlwaysAllowFollowupQuestions(value),
		followupAutoApproveTimeoutMs: rootStore.settings.followupAutoApproveTimeoutMs,
		setFollowupAutoApproveTimeoutMs: (value: number) => rootStore.setFollowupAutoApproveTimeoutMs(value),
		marketplaceItems: rootStore.marketplace.marketplaceItems,
		marketplaceInstalledMetadata: rootStore.marketplace.marketplaceInstalledMetadata,
		profileThresholds: rootStore.settings.profileThresholds,
		setProfileThresholds: (value: Record<string, number>) => rootStore.setProfileThresholds(value),
		setApiConfiguration: (config: ProviderSettings) => rootStore.setApiConfiguration(config),
		setCustomInstructions: (value?: string) => rootStore.setCustomInstructions(value),
		setAlwaysAllowReadOnly: (value: boolean) => rootStore.setAlwaysAllowReadOnly(value),
		setAlwaysAllowReadOnlyOutsideWorkspace: (value: boolean) =>
			rootStore.setAlwaysAllowReadOnlyOutsideWorkspace(value),
		setAlwaysAllowWrite: (value: boolean) => rootStore.setAlwaysAllowWrite(value),
		setAlwaysAllowWriteOutsideWorkspace: (value: boolean) => rootStore.setAlwaysAllowWriteOutsideWorkspace(value),
		setAlwaysAllowExecute: (value: boolean) => rootStore.setAlwaysAllowExecute(value),
		setAlwaysAllowMcp: (value: boolean) => rootStore.setAlwaysAllowMcp(value),
		setAlwaysAllowModeSwitch: (value: boolean) => rootStore.setAlwaysAllowModeSwitch(value),
		setAlwaysAllowSubtasks: (value: boolean) => rootStore.setAlwaysAllowSubtasks(value),
		setShowRooIgnoredFiles: (value: boolean) => rootStore.setShowRooIgnoredFiles(value),
		setEnableSubfolderRules: (value: boolean) => rootStore.setEnableSubfolderRules(value),
		setShowAnnouncement: (value: boolean) => rootStore.setShowAnnouncement(value),
		setAllowedCommands: (value: string[]) => rootStore.setAllowedCommands(value),
		setDeniedCommands: (value: string[]) => rootStore.setDeniedCommands(value),
		setAllowedMaxRequests: (value: number | undefined) => rootStore.setAllowedMaxRequests(value),
		setAllowedMaxCost: (value: number | undefined) => rootStore.setAllowedMaxCost(value),
		setSoundEnabled: (value: boolean) => rootStore.setSoundEnabled(value),
		setSoundVolume: (value: number) => rootStore.setSoundVolume(value),
		terminalShellIntegrationTimeout: s.terminalShellIntegrationTimeout,
		setTerminalShellIntegrationTimeout: (value: number) => rootStore.setTerminalShellIntegrationTimeout(value),
		terminalShellIntegrationDisabled: s.terminalShellIntegrationDisabled,
		setTerminalShellIntegrationDisabled: (value: boolean) => rootStore.setTerminalShellIntegrationDisabled(value),
		terminalZdotdir: s.terminalZdotdir,
		setTerminalZdotdir: (value: boolean) => rootStore.setTerminalZdotdir(value),
		setTtsEnabled: (value: boolean) => rootStore.setTtsEnabled(value),
		setTtsSpeed: (value: number) => rootStore.setTtsSpeed(value),
		setEnableCheckpoints: (value: boolean) => rootStore.setEnableCheckpoints(value),
		checkpointTimeout: s.checkpointTimeout,
		setCheckpointTimeout: (value: number) => rootStore.setCheckpointTimeout(value),
		setWriteDelayMs: (value: number) => rootStore.setWriteDelayMs(value),
		terminalOutputPreviewSize: s.terminalOutputPreviewSize,
		setTerminalOutputPreviewSize: (value: "small" | "medium" | "large") =>
			rootStore.setTerminalOutputPreviewSize(value),
		mcpEnabled: s.mcpEnabled,
		setMcpEnabled: (value: boolean) => rootStore.setMcpEnabled(value),
		taskSyncEnabled: s.taskSyncEnabled,
		setTaskSyncEnabled: (value: boolean) => rootStore.setTaskSyncEnabled(value),
		setCurrentApiConfigName: (value: string) => rootStore.setCurrentApiConfigName(value),
		setListApiConfigMeta: (value: ProviderSettingsEntry[]) => rootStore.setListApiConfigMeta(value),
		mode: s.mode as Mode,
		setMode: (value: Mode) => rootStore.setMode(value),
		setCustomModePrompts: (value: CustomModePrompts) => rootStore.setCustomModePrompts(value),
		setCustomSupportPrompts: (value: CustomSupportPrompts) => rootStore.setCustomSupportPrompts(value),
		systemPromptTemplates: s.systemPromptTemplates,
		setSystemPromptTemplates: (value: Record<string, string>) => rootStore.setSystemPromptTemplates(value),
		enhancementApiConfigId: s.enhancementApiConfigId,
		setEnhancementApiConfigId: (value: string) => rootStore.setEnhancementApiConfigId(value),
		setExperimentEnabled: (id: ExperimentId, enabled: boolean) => rootStore.setExperimentEnabled(id, enabled),
		setAutoApprovalEnabled: (value: boolean) => rootStore.setAutoApprovalEnabled(value),
		customModes: s.customModes,
		setCustomModes: (value: ModeConfig[]) => rootStore.setCustomModes(value),
		setMaxOpenTabsContext: (value: number) => rootStore.setMaxOpenTabsContext(value),
		maxWorkspaceFiles: s.maxWorkspaceFiles,
		setMaxWorkspaceFiles: (value: number) => rootStore.setMaxWorkspaceFiles(value),
		setTelemetrySetting: (value: TelemetrySetting) => rootStore.setTelemetrySetting(value),
		awsUsePromptCache: s.apiConfiguration?.awsUsePromptCache,
		setAwsUsePromptCache: (value: boolean) => rootStore.setAwsUsePromptCache(value),
		maxImageFileSize: s.maxImageFileSize,
		setMaxImageFileSize: (value: number) => rootStore.setMaxImageFileSize(value),
		maxTotalImageSize: s.maxTotalImageSize,
		setMaxTotalImageSize: (value: number) => rootStore.setMaxTotalImageSize(value),
		machineId: s.machineId,
		pinnedApiConfigs: s.pinnedApiConfigs,
		setPinnedApiConfigs: (value: Record<string, boolean>) => rootStore.setPinnedApiConfigs(value),
		togglePinnedApiConfig: (configName: string) => rootStore.togglePinnedApiConfig(configName),
		setHistoryPreviewCollapsed: (value: boolean) => rootStore.setHistoryPreviewCollapsed(value),
		setReasoningBlockCollapsed: (value: boolean) => rootStore.setReasoningBlockCollapsed(value),
		enterBehavior: s.enterBehavior,
		setEnterBehavior: (value: "send" | "newline") => rootStore.setEnterBehavior(value),
		autoCondenseContext: s.autoCondenseContext,
		setAutoCondenseContext: (value: boolean) => rootStore.setAutoCondenseContext(value),
		autoCondenseContextPercent: s.autoCondenseContextPercent,
		setAutoCondenseContextPercent: (value: number) => rootStore.setAutoCondenseContextPercent(value),
		routerModels: rootStore.settings.routerModels,
		includeDiagnosticMessages: s.includeDiagnosticMessages,
		setIncludeDiagnosticMessages: (value: boolean) => rootStore.setIncludeDiagnosticMessages(value),
		maxDiagnosticMessages: s.maxDiagnosticMessages,
		setMaxDiagnosticMessages: (value: number) => rootStore.setMaxDiagnosticMessages(value),
		includeTaskHistoryInEnhance: rootStore.settings.includeTaskHistoryInEnhance,
		setIncludeTaskHistoryInEnhance: (value: boolean) => rootStore.setIncludeTaskHistoryInEnhance(value),
		includeCurrentTime: rootStore.settings.includeCurrentTime,
		setIncludeCurrentTime: (value: boolean) => rootStore.setIncludeCurrentTime(value),
		includeCurrentCost: rootStore.settings.includeCurrentCost,
		setIncludeCurrentCost: (value: boolean) => rootStore.setIncludeCurrentCost(value),
		showWorktreesInHomeScreen: s.showWorktreesInHomeScreen ?? true,
		setShowWorktreesInHomeScreen: (value: boolean) => rootStore.setShowWorktreesInHomeScreen(value),
		locatorTarget: s.locatorTarget ?? "code",
		setLocatorTarget: (value: string) => rootStore.setLocatorTarget(value),
		skills: rootStore.marketplace.skills,
	}
}

/**
 * Deprecated React Context for backward compatibility.
 * @deprecated Use useExtensionState() hook or rootStore directly from @src/features/store.
 */
export const ExtensionStateContext = React.createContext<ExtensionStateContextType | undefined>(undefined)

/**
 * No-op provider for backward compatibility.
 * Components no longer need to be wrapped in this provider since state
 * is read directly from the RootStore singleton.
 *
 * @deprecated Remove from component tree. All state is read from rootStore directly.
 */
export const ExtensionStateContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	return <>{children}</>
}

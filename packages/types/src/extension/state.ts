import type { GlobalSettings } from "../settings/global/schema.ts"
import type { ProviderSettings } from "../settings/provider/combined-schemas.ts"
import type { HistoryItem } from "../task/history.ts"
import type { ChatMessage } from "../messages/types.ts"
import type { Notification } from "../messages/notification.ts"
import type { TodoItem } from "../todo.ts"
import type { Experiments } from "../features/experiment.ts"
import type { TelemetrySetting } from "../telemetry/properties.ts"
import type { ModeConfig } from "../models/mode.ts"
import type { CloudUserInfo, CloudOrganizationMembership, OrganizationAllowList } from "../cloud/organization.ts"
import type { RouterModels } from "../models/model.ts"
import type { SkillMetadata } from "../features/skills.ts"
import type { MarketplaceItem } from "../features/marketplace.ts"
import type { QueuedMessage } from "../messages/types.ts"
import type { McpServer } from "../mcp/mcp.ts"
import type { DiagnosticSnapshot } from "../utils/diagnostics.ts"

export interface Command {
	name: string
	source: "global" | "project" | "built-in"
	filePath?: string
	description?: string
	argumentHint?: string
}

export type ExtensionState = Pick<
	GlobalSettings,
	| "currentApiConfigName"
	| "listApiConfigMeta"
	| "pinnedApiConfigs"
	| "customInstructions"
	| "dismissedUpsells"
	| "autoApprovalEnabled"
	| "alwaysAllowReadOnly"
	| "alwaysAllowReadOnlyOutsideWorkspace"
	| "alwaysAllowWrite"
	| "alwaysAllowWriteOutsideWorkspace"
	| "alwaysAllowWriteProtected"
	| "alwaysAllowMcp"
	| "alwaysAllowModeSwitch"
	| "alwaysAllowSubtasks"
	| "alwaysAllowFollowupQuestions"
	| "alwaysAllowExecute"
	| "followupAutoApproveTimeoutMs"
	| "allowedCommands"
	| "deniedCommands"
	| "allowedMaxRequests"
	| "allowedMaxCost"
	| "ttsEnabled"
	| "ttsSpeed"
	| "soundEnabled"
	| "soundVolume"
	| "terminalOutputPreviewSize"
	| "terminalShellIntegrationTimeout"
	| "terminalShellIntegrationDisabled"
	| "terminalCommandDelay"
	| "terminalPowershellCounter"
	| "terminalZshClearEolMark"
	| "terminalZshOhMy"
	| "terminalZshP10k"
	| "terminalZdotdir"
	| "execaShellPath"
	| "diagnosticsEnabled"
	| "language"
	| "modeApiConfigs"
	| "customModePrompts"
	| "customSupportPrompts"
	| "systemPromptTemplates"
	| "enhancementApiConfigId"
	| "customCondensingPrompt"
	| "codebaseIndexConfig"
	| "codebaseIndexModels"
	| "profileThresholds"
	| "includeDiagnosticMessages"
	| "maxDiagnosticMessages"
	| "imageGenerationProvider"
	| "openRouterImageGenerationSelectedModel"
	| "includeTaskHistoryInEnhance"
	| "reasoningBlockCollapsed"
	| "enterBehavior"
	| "includeCurrentTime"
	| "includeCurrentCost"
	| "maxGitStatusFiles"
	| "requestDelaySeconds"
	| "showWorktreesInHomeScreen"
	| "disabledTools"
	| "locatorTarget"
> & {
	lockApiConfigAcrossModes?: boolean
	version: string
	/** @deprecated Use `chatMessages` instead. Migrating to ChatMessage discriminated union types. */
	messages: Notification[]
	/** Chat messages in the new discriminated union format. Replaces Notification[] with "say" type. */
	chatMessages?: ChatMessage[]
	currentTaskId?: string
	currentTaskItem?: HistoryItem
	isRunning?: boolean
	currentTaskTodos?: TodoItem[] // Initial todos for the current task
	/** Data for ALL tasks in the taskStack, enabling per-window rendering.
	 *  Each entry contains the taskId, history item, messages, and todos for one task.
	 *  Used by WindowManager to render each window layer with its own content. */
	taskStackData?: Array<{
		taskId: string
		taskItem?: HistoryItem
		/** @deprecated Use `chatMessages` instead. */
		messages: Notification[]
		/** Chat messages in the new discriminated union format. */
		chatMessages?: ChatMessage[]
		todos: TodoItem[]
	}>
	apiConfiguration: ProviderSettings
	uriScheme?: string
	shouldShowAnnouncement: boolean

	taskHistory: HistoryItem[]

	writeDelayMs: number

	enableCheckpoints: boolean
	checkpointTimeout: number // Timeout for checkpoint initialization in seconds (default: 15)
	maxOpenTabsContext: number // Maximum number of VSCode open tabs to include in context (0-500)
	maxWorkspaceFiles: number // Maximum number of files to include in current working directory details (0-500)
	showJabberwockIgnoredFiles: boolean // Whether to show .jabberwockignore'd files in listings
	enableSubfolderRules: boolean // Whether to load rules from subdirectories
	maxReadFileLine?: number // Maximum line limit for read_file tool (-1 for default)
	maxImageFileSize: number // Maximum size of image files to process in MB
	maxTotalImageSize: number // Maximum total size for all images in a single read operation in MB

	experiments: Experiments // Map of experiment IDs to their enabled state

	mcpEnabled: boolean

	mode: string
	customModes: ModeConfig[]
	toolRequirements?: Record<string, boolean> // Map of tool names to their requirements (e.g. {"apply_diff": true})

	cwd?: string // Current working directory
	telemetrySetting: TelemetrySetting
	telemetryKey?: string
	machineId?: string

	renderContext: "sidebar" | "editor"
	settingsImportedAt?: number
	historyPreviewCollapsed?: boolean

	cloudUserInfo: CloudUserInfo | null
	cloudIsAuthenticated: boolean
	cloudAuthSkipModel?: boolean // Flag indicating auth completed without model selection (user should pick 3rd-party provider)
	cloudApiUrl?: string
	cloudOrganizations?: CloudOrganizationMembership[]
	sharingEnabled: boolean
	publicSharingEnabled: boolean
	organizationAllowList: OrganizationAllowList
	organizationSettingsVersion?: number

	autoCondenseContext: boolean
	autoCondenseContextPercent: number
	routerModels?: RouterModels
	skills?: SkillMetadata[]
	marketplaceItems?: MarketplaceItem[]
	marketplaceInstalledMetadata?: { project: Record<string, unknown>; global: Record<string, unknown> }
	profileThresholds: Record<string, number>
	hasOpenedModeSelector: boolean
	openRouterImageApiKey?: string
	messageQueue?: QueuedMessage[]
	lastShownAnnouncementId?: string
	apiModelId?: string
	mcpServers?: McpServer[]
	mdmCompliant?: boolean
	taskSyncEnabled: boolean
	openAiCodexIsAuthenticated?: boolean
	debug?: boolean

	/**
	 * Monotonically increasing sequence number for messages state pushes.
	 * When present, the frontend should only apply messages from a state push
	 * if its seq is greater than the last applied seq. This prevents stale state
	 * (captured during async getStateToPostToWebview) from overwriting newer messages.
	 */
	messagesSeq?: number
	diagnostics?: DiagnosticSnapshot
	devtoolEnabled: boolean
}

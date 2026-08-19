import type { ExtensionMessageType } from "./message-types.ts"
import type { DiagnosticSnapshot } from "../utils/diagnostics.ts"
import type { ExtensionState } from "./state.ts"
import type { Notification } from "../messages/notification.ts"
import type { ChatMessage } from "../messages/types.ts"
import type { RouterModels, ModelRecord } from "../models/model.ts"
import type { McpServer } from "../mcp/mcp.ts"
import type { GitCommit } from "../task/git.ts"
import type { ProviderSettingsEntry } from "../settings/provider/schemas.ts"
import type { ModeConfig } from "../models/mode.ts"
import type { CloudUserInfo, OrganizationAllowList } from "../cloud/organization.ts"
import type { ShareVisibility } from "../cloud/index.ts"
import type { MarketplaceItem, MarketplaceInstalledMetadata } from "../features/marketplace.ts"
import type { SerializedCustomToolDefinition } from "../mcp/custom-tool.ts"
import type { SkillMetadata } from "../features/skills.ts"
import type { HistoryItem } from "../task/history.ts"
import type { WorktreeIncludeStatus } from "../utils/worktree.ts"
import type { QueuedMessage } from "../messages/types.ts"
import type { Command } from "./state.ts"

/**
 * ExtensionMessage
 * Extension -> Webview | CLI
 */
export interface ExtensionMessage {
	type: ExtensionMessageType

	text?: string
	snapshot?: unknown
	/** For fileContent: { path, content, error? } */
	fileContent?: { path: string; content: string | null; error?: string }
	diagnostics?: DiagnosticSnapshot
	payload?: unknown
	checkpointWarning?: {
		type: "WAIT_TIMEOUT" | "INIT_TIMEOUT"
		timeout: number
	}
	action?:
		| "chatButtonClicked"
		| "settingsButtonClicked"
		| "historyButtonClicked"
		| "marketplaceButtonClicked"
		| "cloudButtonClicked"
		| "didBecomeVisible"
		| "focusInput"
		| "switchTab"
		| "toggleAutoApprove"
		| "getActivePage"
	invoke?:
		| "newChat"
		| "sendMessage"
		| "primaryButtonClick"
		| "secondaryButtonClick"
		| "setChatBoxMessage"
		| "approveTodoPlan"
	/**
	 * Partial state updates are allowed to reduce message size (e.g. omit large fields like taskHistory).
	 * The webview is responsible for merging.
	 */
	state?: Partial<ExtensionState>
	images?: string[]
	uri?: string
	filePaths?: string[]
	openedTabs?: Array<{
		label: string
		isActive: boolean
		path?: string
	}>
	/** @deprecated Use `chatMessage` instead. */
	message?: Notification
	/** Chat message in the new discriminated union format. */
	chatMessage?: ChatMessage
	routerModels?: RouterModels
	openAiModels?: string[]
	ollamaModels?: ModelRecord
	lmStudioModels?: ModelRecord
	vsCodeLmModels?: { vendor?: string; family?: string; version?: string; id?: string }[]
	mcpServers?: McpServer[]
	commits?: GitCommit[]
	listApiConfig?: ProviderSettingsEntry[]
	mode?: string
	customMode?: ModeConfig
	slug?: string
	success?: boolean
	/** Generic payload for extension messages that use `values` */
	values?: Record<string, unknown>
	requestId?: string
	promptText?: string
	results?:
		| { path: string; type: "file" | "folder"; label?: string }[]
		| { name: string; description?: string; argumentHint?: string; source: "global" | "project" | "built-in" }[]
	error?: string
	setting?: string
	value?: unknown
	hasContent?: boolean
	items?: MarketplaceItem[]
	userInfo?: CloudUserInfo
	organizationAllowList?: OrganizationAllowList
	tab?: string
	marketplaceItems?: MarketplaceItem[]
	organizationMcps?: MarketplaceItem[]
	marketplaceInstalledMetadata?: MarketplaceInstalledMetadata
	errors?: string[]
	visibility?: ShareVisibility
	rulesFolderPath?: string
	settings?: unknown
	messageTs?: number
	hasCheckpoint?: boolean
	context?: string
	commands?: Command[]
	queuedMessages?: QueuedMessage[]
	list?: string[] // For dismissedUpsells
	organizationId?: string | null // For organizationSwitchResult
	tools?: SerializedCustomToolDefinition[] // For customToolsResult
	skills?: SkillMetadata[] // For skills response
	modes?: { slug: string; name: string }[] // For modes response
	aggregatedCosts?: {
		// For taskWithAggregatedCosts response
		totalCost: number
		ownCost: number
		childrenCost: number
	}
	historyItem?: HistoryItem
	taskHistory?: HistoryItem[] // For taskHistoryUpdated: full sorted task history
	/** For taskHistoryItemUpdated: single updated/added history item */
	taskHistoryItem?: HistoryItem
	// Worktree response properties
	worktrees?: Array<{
		path: string
		branch: string
		commitHash: string
		isCurrent: boolean
		isBare: boolean
		isDetached: boolean
		isLocked: boolean
		lockReason?: string
	}>
	isGitRepo?: boolean
	isMultiRoot?: boolean
	isSubfolder?: boolean
	gitRootPath?: string
	worktreeResult?: {
		success: boolean
		message: string
		worktree?: {
			path: string
			branch: string
			commitHash: string
			isCurrent: boolean
			isBare: boolean
			isDetached: boolean
			isLocked: boolean
			lockReason?: string
		}
	}
	localBranches?: string[]
	remoteBranches?: string[]
	currentBranch?: string
	suggestedBranch?: string
	suggestedPath?: string
	worktreeIncludeExists?: boolean
	worktreeIncludeStatus?: WorktreeIncludeStatus
	hasGitignore?: boolean
	gitignoreContent?: string
	// branchWorktreeIncludeResult
	branch?: string
	hasWorktreeInclude?: boolean
	// worktreeCopyProgress (size-based)
	copyProgressBytesCopied?: number
	copyProgressTotalBytes?: number
	copyProgressItemName?: string
	// folderSelected
	path?: string
	/** Indicates if the message originated from MCP to prevent infinite loops */
	fromMCP?: boolean
}

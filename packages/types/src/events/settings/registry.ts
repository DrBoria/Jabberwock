import type { McpServer } from "../../mcp/mcp.ts"
import type { GlobalSettings } from "../../settings/global/schema.ts"
import type { WorktreeIncludeStatus } from "../../utils/worktree.ts"
import type { OpenAiCodexRateLimitInfo } from "../../providers/openai/codex/rate-limits.ts"

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

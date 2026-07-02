import type { WebviewMessageType, AudioType } from "./message-types.ts"
import type { ProviderSettings } from "../settings/provider/combined-schemas.ts"
import type { AskResponseValue } from "../events/chat/registry.ts"
import type { Goal } from "../task/history.ts"
import type { ModeConfig, PromptComponent } from "../models/mode.ts"
import type { MarketplaceItem, InstallMarketplaceItemOptions } from "../features/marketplace.ts"
import type { JabberwockSettings } from "../settings/global/composed.ts"
import type { WebViewMessagePayload } from "../payload-schemas.ts"

/**
 * WebviewMessage
 * Webview | CLI -> Extension
 */
export interface WebviewMessage {
	type: WebviewMessageType
	text?: string
	taskId?: string
	editedMessageContent?: string
	tab?: "settings" | "history" | "mcp" | "modes" | "chat" | "marketplace" | "cloud"
	disabled?: boolean
	context?: string
	dataUri?: string
	uri?: string
	askResponse?: AskResponseValue
	apiConfiguration?: ProviderSettings
	images?: string[]
	goals?: Goal[]
	bool?: boolean
	value?: number
	stepIndex?: number
	isLaunchAction?: boolean
	forceShow?: boolean
	commands?: string[]
	audioType?: AudioType
	serverName?: string
	toolName?: string
	alwaysAllow?: boolean
	isEnabled?: boolean
	mode?: string
	promptMode?: string | "enhance"
	customPrompt?: PromptComponent
	systemPromptTemplate?: string
	systemPromptTemplateKey?: string
	dataUrls?: string[]
	/** Generic payload for webview messages that use `values` */
	values?: Record<string, unknown>
	query?: string
	setting?: string
	slug?: string
	modeConfig?: ModeConfig
	timeout?: number
	payload?: WebViewMessagePayload
	source?: "global" | "project"
	skillName?: string // For skill operations (createSkill, deleteSkill, moveSkill, openSkillFile)
	/** @deprecated Use skillModeSlugs instead */
	skillMode?: string // For skill operations (current mode restriction)
	/** @deprecated Use newSkillModeSlugs instead */
	newSkillMode?: string // For moveSkill (target mode)
	skillDescription?: string // For createSkill (skill description)
	/** Mode slugs for skill operations. undefined/empty = any mode */
	skillModeSlugs?: string[] // For skill operations (mode restrictions)
	/** Target mode slugs for updateSkillModes */
	newSkillModeSlugs?: string[] // For updateSkillModes (new mode restrictions)
	requestId?: string
	ids?: string[]
	terminalOperation?: "continue" | "abort"
	messageTs?: number
	restoreCheckpoint?: boolean
	historyPreviewCollapsed?: boolean
	filters?: { type?: string; search?: string; tags?: string[] }
	settings?: unknown
	url?: string // For openExternal
	mpItem?: MarketplaceItem
	mpInstallOptions?: InstallMarketplaceItemOptions
	config?: Record<string, unknown> // Add config to the payload
	visibility?: import("../cloud/index.ts").ShareVisibility // For share visibility
	hasContent?: boolean // For checkRulesDirectoryResult
	checkOnly?: boolean // For deleteCustomMode check
	upsellId?: string // For dismissUpsell
	list?: string[] // For dismissedUpsells response
	organizationId?: string | null // For organization switching
	useProviderSignup?: boolean // For jabberwockCloudSignIn to use provider signup flow
	codeIndexSettings?: {
		// Global state settings
		codebaseIndexEnabled: boolean
		codebaseIndexQdrantUrl: string
		codebaseIndexEmbedderProvider:
			| "openai"
			| "ollama"
			| "openai-compatible"
			| "gemini"
			| "mistral"
			| "vercel-ai-gateway"
			| "bedrock"
			| "openrouter"
		codebaseIndexEmbedderBaseUrl?: string
		codebaseIndexEmbedderModelId: string
		codebaseIndexEmbedderModelDimension?: number // Generic dimension for all providers
		codebaseIndexOpenAiCompatibleBaseUrl?: string
		codebaseIndexBedrockRegion?: string
		codebaseIndexBedrockProfile?: string
		codebaseIndexSearchMaxResults?: number
		codebaseIndexSearchMinScore?: number
		codebaseIndexOpenRouterSpecificProvider?: string // OpenRouter provider routing

		// Secret settings
		codeIndexOpenAiKey?: string
		codeIndexQdrantApiKey?: string
		codebaseIndexOpenAiCompatibleApiKey?: string
		codebaseIndexGeminiApiKey?: string
		codebaseIndexMistralApiKey?: string
		codebaseIndexVercelAiGatewayApiKey?: string
		codebaseIndexOpenRouterApiKey?: string
	}
	updatedSettings?: JabberwockSettings
	/** Task configuration applied via `createTask()` when starting a cloud task. */
	taskConfiguration?: JabberwockSettings
	// Worktree properties
	worktreePath?: string
	worktreeBranch?: string
	worktreeBaseBranch?: string
	worktreeCreateNewBranch?: boolean
	worktreeForce?: boolean
	worktreeNewWindow?: boolean
	worktreeIncludeContent?: string
	locatorPayload?: { filePath: string; line: number; column: number }
	/** Indicates if the message originated from MCP to prevent infinite loops */
	fromMCP?: boolean
	/** Response to getActivePage request — the active window type */
	activePage?: string
	/** Response map for batch file operations */
	response?: { [key: string]: boolean }
	/** Goal operation fields */
	id?: string
	fromIndex?: number
	toIndex?: number
	importance?: number
}

import type { GitCommit } from "../../task/git.ts"
import type {
	MarketplaceItem,
	MarketplaceInstalledMetadata,
	InstallMarketplaceItemOptions,
} from "../../features/marketplace.ts"
import type { SerializedCustomToolDefinition } from "../../mcp/custom-tool.ts"
import type { SkillMetadata } from "../../features/skills.ts"

export interface HistoryBackendToWebview {
	commitSearchResults: { commits?: GitCommit[] }
	workspaceUpdated: {
		uri?: string
		filePaths?: string[]
		openedTabs?: Array<{ label: string; isActive: boolean; path?: string }>
	}
}

export interface HistoryWebviewToBackend {
	searchCommits: { query?: string }
	importSettings: object
	exportSettings: object
	resetState: object
	historyButtonClicked: object
}

export interface MarketplaceBackendToWebview {
	marketplaceData: {
		marketplaceItems?: MarketplaceItem[]
		organizationMcps?: MarketplaceItem[]
		marketplaceInstalledMetadata?: MarketplaceInstalledMetadata
	}
	marketplaceInstallResult: { success?: boolean; error?: string }
	marketplaceRemoveResult: { success?: boolean; error?: string }
	customToolsResult: { tools?: SerializedCustomToolDefinition[] }
	skills: { skills?: SkillMetadata[] }
}

export interface MarketplaceWebviewToBackend {
	marketplaceButtonClicked: object
	filterMarketplaceItems: { filters?: { type?: string; search?: string; tags?: string[] } }
	installMarketplaceItem: { mpItem?: MarketplaceItem; mpInstallOptions?: InstallMarketplaceItemOptions }
	installMarketplaceItemWithParameters: { mpItem?: MarketplaceItem; config?: Record<string, unknown> }
	cancelMarketplaceInstall: object
	removeInstalledMarketplaceItem: { mpItem?: MarketplaceItem }
	marketplaceInstallResult: object
	fetchMarketplaceData: object
	refreshCustomTools: object
	requestSkills: object
	createSkill: { skillName?: string; skillDescription?: string; skillModeSlugs?: string[] }
	deleteSkill: { skillName?: string }
	moveSkill: { skillName?: string; newSkillModeSlugs?: string[] }
	updateSkillModes: { skillName?: string; skillModeSlugs?: string[] }
	openSkillFile: { skillName?: string }
}

import { types, cast } from "mobx-state-tree"
import type { McpServer, RouterModels, OrganizationAllowList } from "@jabberwock/types"

export const SettingsModel = types
	.model("SettingsStore", {
		activeTab: types.string,
		searchQuery: types.string,
		theme: types.frozen<Record<string, string>>(),
		fontSize: types.number,
		mcpServers: types.frozen<McpServer[]>(),
		routerModels: types.frozen<RouterModels>(),
		profileThresholds: types.frozen<Record<string, number>>(),
		alwaysAllowFollowupQuestions: types.boolean,
		followupAutoApproveTimeoutMs: types.number,
		hasOpenedModeSelector: types.boolean,
		includeTaskHistoryInEnhance: types.boolean,
		includeCurrentTime: types.boolean,
		includeCurrentCost: types.boolean,
		organizationAllowList: types.frozen<OrganizationAllowList>(),
		organizationSettingsVersion: types.number,
	})
	.actions((self) => ({
		setActiveTab: (tab: string) => {
			self.activeTab = tab
		},
		setSearchQuery: (query: string) => {
			self.searchQuery = query
		},
		setTheme: (theme: Record<string, string>) => {
			self.theme = theme
		},
		setFontSize: (size: number) => {
			self.fontSize = size
		},
		setMcpServers: (servers: McpServer[]) => {
			self.mcpServers = cast(servers)
		},
		setRouterModels: (models: RouterModels) => {
			self.routerModels = cast(models)
		},
		setProfileThresholds: (value: Record<string, number>) => {
			self.profileThresholds = cast(value)
		},
		setAlwaysAllowFollowupQuestions: (value: boolean) => {
			self.alwaysAllowFollowupQuestions = value
		},
		setFollowupAutoApproveTimeoutMs: (value: number) => {
			self.followupAutoApproveTimeoutMs = value
		},
		setHasOpenedModeSelector: (value: boolean) => {
			self.hasOpenedModeSelector = value
		},
		setIncludeTaskHistoryInEnhance: (value: boolean) => {
			self.includeTaskHistoryInEnhance = value
		},
		setIncludeCurrentTime: (value: boolean) => {
			self.includeCurrentTime = value
		},
		setIncludeCurrentCost: (value: boolean) => {
			self.includeCurrentCost = value
		},
		setOrganizationAllowList: (value: OrganizationAllowList) => {
			self.organizationAllowList = cast(value)
		},
		setOrganizationSettingsVersion: (value: number) => {
			self.organizationSettingsVersion = value
		},
	}))

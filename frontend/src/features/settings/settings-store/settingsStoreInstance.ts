import { Instance } from "mobx-state-tree"
import { SettingsStore } from "./actions"

export type ISettingsStore = Instance<typeof SettingsStore>

export const settingsStore = SettingsStore.create({
	activeTab: "",
	searchQuery: "",
	theme: {},
	fontSize: 14,
	mcpServers: [],
	routerModels: {
		openrouter: {},
		"vercel-ai-gateway": {},
		litellm: {},
		requesty: {},
		jabberwock: {},
		unbound: {},
		ollama: {},
		lmstudio: {},
	},
	profileThresholds: {},
	alwaysAllowFollowupQuestions: true,
	followupAutoApproveTimeoutMs: 30000,
	hasOpenedModeSelector: false,
	includeTaskHistoryInEnhance: true,
	includeCurrentTime: true,
	includeCurrentCost: true,
	organizationAllowList: { allowAll: true, providers: {} },
	organizationSettingsVersion: 0,
})

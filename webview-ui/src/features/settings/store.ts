import { types, Instance, cast } from "mobx-state-tree"

import type { McpServer, RouterModels, OrganizationAllowList, ModeConfig, ProviderSettings } from "@jabberwock/types"
import { ORGANIZATION_ALLOW_ALL as _ORGANIZATION_ALLOW_ALL } from "@jabberwock/types"

import { vscode } from "@jabberwock/devtool/webview"
import type { WebviewMessage } from "@jabberwock/types"
import { eventConstants } from "@jabberwock/types"

/**
 * SettingsStore — holds settings UI state and feature-specific data
 * that was previously in ChatStore's locally-managed fields.
 */
export const SettingsStore = types
	.model("SettingsStore", {
		// ── UI state ──
		activeTab: types.string,
		searchQuery: types.string,

		// ── Display preferences ──
		theme: types.frozen<Record<string, string>>(),
		fontSize: types.number,

		// ── MCP servers ──
		mcpServers: types.frozen<McpServer[]>(),

		// ── Router models ──
		routerModels: types.frozen<RouterModels>(),

		// ── Profiles ──
		profileThresholds: types.frozen<Record<string, number>>(),

		// ── Follow-up auto-approve ──
		alwaysAllowFollowupQuestions: types.boolean,
		followupAutoApproveTimeoutMs: types.number,

		// ── Mode selector ──
		hasOpenedModeSelector: types.boolean,

		// ── Enhance prompt settings ──
		includeTaskHistoryInEnhance: types.boolean,
		includeCurrentTime: types.boolean,
		includeCurrentCost: types.boolean,

		// ── Organization ──
		organizationAllowList: types.frozen<OrganizationAllowList>(),
		organizationSettingsVersion: types.number,
	})
	// ── Block 1: UI state setters ──
	.actions((self) => ({
		setActiveTab(tab: string) {
			self.activeTab = tab
		},
		setSearchQuery(query: string) {
			self.searchQuery = query
		},
		setTheme(theme: Record<string, string>) {
			self.theme = theme
		},
		setFontSize(size: number) {
			self.fontSize = size
		},
	}))
	// ── Block 2: Feature data setters ──
	.actions((self) => ({
		setMcpServers(servers: McpServer[]) {
			self.mcpServers = cast(servers)
		},
		setRouterModels(models: RouterModels) {
			self.routerModels = cast(models)
		},
		setProfileThresholds(value: Record<string, number>) {
			self.profileThresholds = cast(value)
		},
		setAlwaysAllowFollowupQuestions(value: boolean) {
			self.alwaysAllowFollowupQuestions = value
		},
		setFollowupAutoApproveTimeoutMs(value: number) {
			self.followupAutoApproveTimeoutMs = value
		},
		setHasOpenedModeSelector(value: boolean) {
			self.hasOpenedModeSelector = value
		},
		setIncludeTaskHistoryInEnhance(value: boolean) {
			self.includeTaskHistoryInEnhance = value
		},
		setIncludeCurrentTime(value: boolean) {
			self.includeCurrentTime = value
		},
		setIncludeCurrentCost(value: boolean) {
			self.includeCurrentCost = value
		},
		setOrganizationAllowList(value: OrganizationAllowList) {
			self.organizationAllowList = cast(value)
		},
		setOrganizationSettingsVersion(value: number) {
			self.organizationSettingsVersion = value
		},
	}))

	// ── Block 3: Settings actions (formerly createSettingsActions factory) ──
	.actions((_self) => ({
		// ── Terminal operations ────────────────────────────────────
		terminalOperation(operation: "continue" | "abort") {
			vscode.postMessage({
				type: eventConstants.SETTINGS.TERMINAL_OPERATION,
				terminalOperation: operation,
			} satisfies WebviewMessage)
		},

		// ── API Config ─────────────────────────────────────────────
		loadApiConfigById(value: string) {
			vscode.postMessage({
				type: eventConstants.AGENT_STATE.LOAD_API_CONFIGURATION_BY_ID,
				text: value,
			} satisfies WebviewMessage)
		},

		lockApiConfigAcrossModes(bool: boolean) {
			vscode.postMessage({
				type: eventConstants.AGENT_STATE.LOCK_API_CONFIG_ACROSS_MODES,
				bool,
			} satisfies WebviewMessage)
		},

		upsertApiConfig(text: string | undefined, apiConfiguration: ProviderSettings) {
			vscode.postMessage({
				type: eventConstants.AGENT_STATE.UPSERT_API_CONFIGURATION,
				text,
				apiConfiguration,
			} satisfies WebviewMessage)
		},

		loadApiConfig(text: string) {
			vscode.postMessage({
				type: eventConstants.AGENT_STATE.LOAD_API_CONFIGURATION,
				text,
			} satisfies WebviewMessage)
		},

		deleteApiConfig(text: string) {
			vscode.postMessage({
				type: eventConstants.AGENT_STATE.DELETE_API_CONFIGURATION,
				text,
			} satisfies WebviewMessage)
		},

		renameApiConfig(values: { oldName: string; newName: string }) {
			vscode.postMessage({
				type: eventConstants.AGENT_STATE.RENAME_API_CONFIGURATION,
				values,
			} satisfies WebviewMessage)
		},

		requestOllamaModels() {
			vscode.postMessage({
				type: eventConstants.AGENT_STATE.REQUEST_OLLAMA_MODELS,
			} satisfies WebviewMessage)
		},

		requestLmStudioModels() {
			vscode.postMessage({
				type: eventConstants.AGENT_STATE.REQUEST_LM_STUDIO_MODELS,
			} satisfies WebviewMessage)
		},

		requestVscodeLmModels() {
			vscode.postMessage({
				type: eventConstants.AGENT_STATE.REQUEST_VS_CODE_LM_MODELS,
			} satisfies WebviewMessage)
		},

		requestRouterModels(values?: Record<string, unknown>) {
			vscode.postMessage({
				type: eventConstants.AGENT_STATE.REQUEST_ROUTER_MODELS,
				...(values !== undefined && { values }),
			} satisfies WebviewMessage)
		},

		requestOpenAiModels(values?: Record<string, unknown>) {
			vscode.postMessage({
				type: eventConstants.AGENT_STATE.REQUEST_OPEN_AI_MODELS,
				...(values !== undefined && { values }),
			} satisfies WebviewMessage)
		},

		requestRooCreditBalance() {
			vscode.postMessage({
				type: eventConstants.AGENT_STATE.REQUEST_ROO_CREDIT_BALANCE,
			} satisfies WebviewMessage)
		},

		setEnhancementApiConfigId(text: string) {
			vscode.postMessage({
				type: eventConstants.AGENT_STATE.ENHANCEMENT_API_CONFIG_ID,
				text,
			} satisfies WebviewMessage)
		},

		toggleApiConfigPin(text: string) {
			vscode.postMessage({
				type: eventConstants.SETTINGS.TOGGLE_API_CONFIG_PIN,
				text,
			} satisfies WebviewMessage)
		},

		// ── DevTool ────────────────────────────────────────────────
		toggleDevtool() {
			vscode.postMessage({
				type: eventConstants.SETTINGS.DEVTOOL_STATUS,
				text: "toggle",
			} satisfies WebviewMessage)
		},

		// ── Announcement ───────────────────────────────────────────
		didShowAnnouncement() {
			vscode.postMessage({
				type: eventConstants.SETTINGS.DID_SHOW_ANNOUNCEMENT,
			} satisfies WebviewMessage)
		},

		// ── Open actions ───────────────────────────────────────────
		openExternal(url: string) {
			vscode.postMessage({
				type: eventConstants.SETTINGS.OPEN_EXTERNAL,
				url,
			} satisfies WebviewMessage)
		},

		openFile(text: string, values?: Record<string, unknown>) {
			vscode.postMessage({
				type: eventConstants.SETTINGS.OPEN_FILE,
				text,
				...(values !== undefined && { values }),
			} satisfies WebviewMessage)
		},

		openMention(part: string) {
			vscode.postMessage({
				type: eventConstants.SETTINGS.OPEN_MENTION,
				text: part,
			} satisfies WebviewMessage)
		},

		openMarkdownPreview(text: string) {
			vscode.postMessage({
				type: eventConstants.SETTINGS.OPEN_MARKDOWN_PREVIEW,
				text,
			} satisfies WebviewMessage)
		},

		openKeyboardShortcuts(text: string) {
			vscode.postMessage({
				type: eventConstants.SETTINGS.OPEN_KEYBOARD_SHORTCUTS,
				text,
			} satisfies WebviewMessage)
		},

		openImage(text: string) {
			vscode.postMessage({
				type: eventConstants.SETTINGS.OPEN_IMAGE,
				text,
			} satisfies WebviewMessage)
		},

		// ── MCP servers ────────────────────────────────────────────
		openMcpSettings() {
			vscode.postMessage({
				type: eventConstants.SETTINGS.OPEN_MCP_SETTINGS,
			} satisfies WebviewMessage)
		},

		openProjectMcpSettings() {
			vscode.postMessage({
				type: eventConstants.SETTINGS.OPEN_PROJECT_MCP_SETTINGS,
			} satisfies WebviewMessage)
		},

		refreshAllMcpServers() {
			vscode.postMessage({
				type: eventConstants.SETTINGS.REFRESH_ALL_MCP_SERVERS,
			} satisfies WebviewMessage)
		},

		restartMcpServer(text: string, source: "global" | "project") {
			vscode.postMessage({
				type: eventConstants.SETTINGS.RESTART_MCP_SERVER,
				text,
				source,
			} satisfies WebviewMessage)
		},

		deleteMcpServer(serverName: string, source: "global" | "project") {
			vscode.postMessage({
				type: eventConstants.SETTINGS.DELETE_MCP_SERVER,
				serverName,
				source,
			} satisfies WebviewMessage)
		},

		toggleMcpServer(serverName: string, source: "global" | "project", disabled: boolean) {
			vscode.postMessage({
				type: eventConstants.SETTINGS.TOGGLE_MCP_SERVER,
				serverName,
				source,
				disabled,
			} satisfies WebviewMessage)
		},

		updateMcpTimeout(serverName: string, source: "global" | "project", timeout: number) {
			vscode.postMessage({
				type: eventConstants.SETTINGS.UPDATE_MCP_TIMEOUT,
				serverName,
				source,
				timeout,
			} satisfies WebviewMessage)
		},

		toggleToolAlwaysAllow(
			serverName: string,
			source: "global" | "project",
			toolName: string,
			alwaysAllow: boolean,
		) {
			vscode.postMessage({
				type: eventConstants.SETTINGS.TOGGLE_TOOL_ALWAYS_ALLOW,
				serverName,
				source,
				toolName,
				alwaysAllow,
			} satisfies WebviewMessage)
		},

		toggleToolEnabledForPrompt(
			serverName: string,
			source: "global" | "project",
			toolName: string,
			isEnabled: boolean,
		) {
			vscode.postMessage({
				type: eventConstants.SETTINGS.TOGGLE_TOOL_ENABLED_FOR_PROMPT,
				serverName,
				source,
				toolName,
				isEnabled,
			} satisfies WebviewMessage)
		},

		// ── Worktrees ──────────────────────────────────────────────
		listWorktrees() {
			vscode.postMessage({
				type: eventConstants.SETTINGS.LIST_WORKTREES,
			} satisfies WebviewMessage)
		},

		switchWorktree(worktreePath: string, worktreeNewWindow?: boolean) {
			vscode.postMessage({
				type: eventConstants.SETTINGS.SWITCH_WORKTREE,
				worktreePath,
				worktreeNewWindow: worktreeNewWindow ?? false,
			} satisfies WebviewMessage)
		},

		browseForWorktreePath() {
			vscode.postMessage({
				type: eventConstants.SETTINGS.BROWSE_FOR_WORKTREE_PATH,
			} satisfies WebviewMessage)
		},

		getWorktreeDefaults() {
			vscode.postMessage({
				type: eventConstants.SETTINGS.GET_WORKTREE_DEFAULTS,
			} satisfies WebviewMessage)
		},

		getAvailableBranches() {
			vscode.postMessage({
				type: eventConstants.SETTINGS.GET_AVAILABLE_BRANCHES,
			} satisfies WebviewMessage)
		},

		getWorktreeIncludeStatus() {
			vscode.postMessage({
				type: eventConstants.SETTINGS.GET_WORKTREE_INCLUDE_STATUS,
			} satisfies WebviewMessage)
		},

		deleteWorktree(worktreePath: string, worktreeForce?: boolean) {
			vscode.postMessage({
				type: eventConstants.SETTINGS.DELETE_WORKTREE,
				worktreePath,
				...(worktreeForce !== undefined && { worktreeForce }),
			} satisfies WebviewMessage)
		},

		createWorktree(
			worktreePath: string,
			worktreeBranch: string,
			worktreeBaseBranch: string,
			worktreeCreateNewBranch: boolean,
		) {
			vscode.postMessage({
				type: eventConstants.SETTINGS.CREATE_WORKTREE,
				worktreePath,
				worktreeBranch,
				worktreeBaseBranch,
				worktreeCreateNewBranch,
			} satisfies WebviewMessage)
		},

		createWorktreeInclude(worktreeIncludeContent: string) {
			vscode.postMessage({
				type: eventConstants.SETTINGS.CREATE_WORKTREE_INCLUDE,
				worktreeIncludeContent,
			} satisfies WebviewMessage)
		},

		// ── Code indexing ──────────────────────────────────────────
		saveCodeIndexSettings(codeIndexSettings: Record<string, unknown>) {
			vscode.postMessage({
				type: eventConstants.AGENT_STATE.SAVE_CODE_INDEX_SETTINGS_ATOMIC,
				codeIndexSettings,
			} as WebviewMessage)
		},

		requestIndexingStatus() {
			vscode.postMessage({
				type: eventConstants.AGENT_STATE.REQUEST_INDEXING_STATUS,
			} satisfies WebviewMessage)
		},

		requestCodeIndexSecretStatus() {
			vscode.postMessage({
				type: eventConstants.AGENT_STATE.REQUEST_CODE_INDEX_SECRET_STATUS,
			} satisfies WebviewMessage)
		},

		setAutoEnableDefault(bool: boolean) {
			vscode.postMessage({
				type: eventConstants.AGENT_STATE.SET_AUTO_ENABLE_DEFAULT,
				bool,
			} satisfies WebviewMessage)
		},

		toggleWorkspaceIndexing(bool: boolean) {
			vscode.postMessage({
				type: eventConstants.AGENT_STATE.TOGGLE_WORKSPACE_INDEXING,
				bool,
			} satisfies WebviewMessage)
		},

		startIndexing() {
			vscode.postMessage({
				type: eventConstants.AGENT_STATE.START_INDEXING,
			} satisfies WebviewMessage)
		},

		stopIndexing() {
			vscode.postMessage({
				type: eventConstants.AGENT_STATE.STOP_INDEXING,
			} satisfies WebviewMessage)
		},

		clearIndexData() {
			vscode.postMessage({
				type: eventConstants.AGENT_STATE.CLEAR_INDEX_DATA,
			} satisfies WebviewMessage)
		},

		// ── General settings ───────────────────────────────────────
		updateSettings(updatedSettings: Record<string, unknown>) {
			vscode.postMessage({
				type: eventConstants.SETTINGS.UPDATE_SETTINGS,
				updatedSettings,
			} satisfies WebviewMessage)
		},

		setAutoApprovalEnabled(bool: boolean) {
			vscode.postMessage({
				type: eventConstants.AGENT_STATE.AUTO_APPROVAL_ENABLED,
				bool,
			} satisfies WebviewMessage)
		},

		setTelemetry(text: string | undefined) {
			vscode.postMessage({
				type: eventConstants.SETTINGS.TELEMETRY_SETTING,
				text,
			} satisfies WebviewMessage)
		},

		setDebugSetting(bool: boolean | undefined) {
			vscode.postMessage({
				type: eventConstants.AGENT_STATE.DEBUG_SETTING,
				bool,
			} satisfies WebviewMessage)
		},

		reportModeSelectorOpened(bool: boolean) {
			vscode.postMessage({
				type: eventConstants.AGENT_STATE.HAS_OPENED_MODE_SELECTOR,
				bool,
			} satisfies WebviewMessage)
		},

		setModeSelectorOpened(bool: boolean) {
			vscode.postMessage({
				type: eventConstants.AGENT_STATE.HAS_OPENED_MODE_SELECTOR,
				bool,
			} satisfies WebviewMessage)
		},

		updateVscodeSetting(setting: string, value: number) {
			vscode.postMessage({
				type: eventConstants.AGENT_STATE.UPDATE_VS_CODE_SETTING,
				setting,
				value,
			} satisfies WebviewMessage)
		},

		getVscodeSetting(setting: string) {
			vscode.postMessage({
				type: eventConstants.AGENT_STATE.GET_VS_CODE_SETTING,
				setting,
			} satisfies WebviewMessage)
		},

		updateSystemPromptTemplate(systemPromptTemplateKey: string, systemPromptTemplate: string) {
			vscode.postMessage({
				type: eventConstants.AGENT_STATE.UPDATE_SYSTEM_PROMPT_TEMPLATE,
				systemPromptTemplateKey,
				systemPromptTemplate,
			} satisfies WebviewMessage)
		},

		readFileContent(text: string) {
			vscode.postMessage({
				type: eventConstants.SETTINGS.READ_FILE_CONTENT,
				text,
			} satisfies WebviewMessage)
		},

		requestOpenaiCodexRateLimits() {
			vscode.postMessage({
				type: eventConstants.SETTINGS.REQUEST_OPEN_AI_CODEX_RATE_LIMITS,
			} satisfies WebviewMessage)
		},

		downloadErrorDiagnostics(values: {
			timestamp: string
			version: string
			provider: string
			model: string
			details: string
		}) {
			vscode.postMessage({
				type: eventConstants.DIAGNOSTICS.DOWNLOAD_ERROR_DIAGNOSTICS,
				values,
			} satisfies WebviewMessage)
		},

		webviewError(text: string) {
			vscode.postMessage({
				type: eventConstants.SETTINGS.WEBVIEW_ERROR,
				text,
			} satisfies WebviewMessage)
		},

		// ── Debug ──────────────────────────────────────────────────
		openDebugApiHistory() {
			vscode.postMessage({
				type: eventConstants.SETTINGS.OPEN_DEBUG_API_HISTORY,
			} satisfies WebviewMessage)
		},

		openDebugUiHistory() {
			vscode.postMessage({
				type: eventConstants.SETTINGS.OPEN_DEBUG_UI_HISTORY,
			} satisfies WebviewMessage)
		},

		// ── Commands (slash commands) ──────────────────────────────
		createCommand(text: string, fileContent?: string) {
			vscode.postMessage({
				type: eventConstants.SETTINGS.CREATE_COMMAND,
				text,
				...(fileContent !== undefined && { fileContent }),
			} satisfies WebviewMessage)
		},

		deleteCommand(text: string) {
			vscode.postMessage({
				type: eventConstants.SETTINGS.DELETE_COMMAND,
				text,
			} satisfies WebviewMessage)
		},

		openCommandFile(text: string) {
			vscode.postMessage({
				type: eventConstants.SETTINGS.OPEN_COMMAND_FILE,
				text,
			} satisfies WebviewMessage)
		},

		// ── Custom Modes ───────────────────────────────────────────
		updateCustomMode(slug: string, modeConfig: ModeConfig) {
			vscode.postMessage({
				type: "updateCustomMode" as const,
				slug,
				modeConfig,
			} satisfies WebviewMessage)
		},

		updatePrompt(promptMode: string, customPrompt: Record<string, unknown>) {
			vscode.postMessage({
				type: "updatePrompt" as const,
				promptMode,
				customPrompt,
			} satisfies WebviewMessage)
		},

		checkRulesDirectory(slug: string) {
			vscode.postMessage({
				type: "checkRulesDirectory" as const,
				slug,
			} satisfies WebviewMessage)
		},

		openCustomModesSettings() {
			vscode.postMessage({
				type: "openCustomModesSettings" as const,
			} satisfies WebviewMessage)
		},

		deleteCustomMode(slug: string, checkOnly?: boolean) {
			vscode.postMessage({
				type: "deleteCustomMode" as const,
				slug,
				...(checkOnly !== undefined && { checkOnly }),
			} satisfies WebviewMessage)
		},

		exportMode(slug: string) {
			vscode.postMessage({
				type: "exportMode" as const,
				slug,
			} satisfies WebviewMessage)
		},

		getSystemPrompt(mode: string) {
			vscode.postMessage({
				type: "getSystemPrompt" as const,
				mode,
			} satisfies WebviewMessage)
		},

		copySystemPrompt(mode: string) {
			vscode.postMessage({
				type: "copySystemPrompt" as const,
				mode,
			} satisfies WebviewMessage)
		},

		customInstructions(text: string | undefined) {
			vscode.postMessage({
				type: "customInstructions" as const,
				text,
			} satisfies WebviewMessage)
		},

		importMode(source: "global" | "project") {
			vscode.postMessage({
				type: "importMode" as const,
				source,
			} satisfies WebviewMessage)
		},
	}))

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

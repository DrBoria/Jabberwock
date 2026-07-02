import type { ProviderSettings, ModeConfig, WebviewMessage } from "@jabberwock/types"
import { eventConstants } from "@jabberwock/types"
import { vscode } from "@jabberwock/devtool/webview"
import { SettingsModel } from "./store"

const pm = (msg: WebviewMessage) => vscode.postMessage(msg)

export const SettingsStore = SettingsModel.actions((_self) => ({
	terminalOperation: (operation: "continue" | "abort") =>
		pm({ type: eventConstants.SETTINGS.TERMINAL_OPERATION, terminalOperation: operation }),
	loadApiConfigById: (value: string) =>
		pm({ type: eventConstants.AGENT_STATE.LOAD_API_CONFIGURATION_BY_ID, text: value }),
	lockApiConfigAcrossModes: (bool: boolean) =>
		pm({ type: eventConstants.AGENT_STATE.LOCK_API_CONFIG_ACROSS_MODES, bool }),
	upsertApiConfig: (text: string | undefined, apiConfiguration: ProviderSettings) =>
		pm({ type: eventConstants.AGENT_STATE.UPSERT_API_CONFIGURATION, text, apiConfiguration }),
	loadApiConfig: (text: string) => pm({ type: eventConstants.AGENT_STATE.LOAD_API_CONFIGURATION, text }),
	deleteApiConfig: (text: string) => pm({ type: eventConstants.AGENT_STATE.DELETE_API_CONFIGURATION, text }),
	renameApiConfig: (values: { oldName: string; newName: string }) =>
		pm({ type: eventConstants.AGENT_STATE.RENAME_API_CONFIGURATION, values }),
	requestOllamaModels: () => pm({ type: eventConstants.AGENT_STATE.REQUEST_OLLAMA_MODELS }),
	requestLmStudioModels: () => pm({ type: eventConstants.AGENT_STATE.REQUEST_LM_STUDIO_MODELS }),
	requestVscodeLmModels: () => pm({ type: eventConstants.AGENT_STATE.REQUEST_VS_CODE_LM_MODELS }),
	requestRouterModels: (values?: Record<string, unknown>) =>
		pm({ type: eventConstants.AGENT_STATE.REQUEST_ROUTER_MODELS, ...(values !== undefined && { values }) }),
	requestOpenAiModels: (values?: Record<string, unknown>) =>
		pm({ type: eventConstants.AGENT_STATE.REQUEST_OPEN_AI_MODELS, ...(values !== undefined && { values }) }),
	requestRooCreditBalance: () => pm({ type: eventConstants.AGENT_STATE.REQUEST_ROO_CREDIT_BALANCE }),
	setEnhancementApiConfigId: (text: string) =>
		pm({ type: eventConstants.AGENT_STATE.ENHANCEMENT_API_CONFIG_ID, text }),
	toggleApiConfigPin: (text: string) => pm({ type: eventConstants.SETTINGS.TOGGLE_API_CONFIG_PIN, text }),
	toggleDevtool: () => pm({ type: eventConstants.SETTINGS.DEVTOOL_STATUS, text: "toggle" }),
	didShowAnnouncement: () => pm({ type: eventConstants.SETTINGS.DID_SHOW_ANNOUNCEMENT }),
	openExternal: (url: string) => pm({ type: eventConstants.SETTINGS.OPEN_EXTERNAL, url }),
	openFile: (text: string, values?: Record<string, unknown>) =>
		pm({ type: eventConstants.SETTINGS.OPEN_FILE, text, ...(values !== undefined && { values }) }),
	openMention: (part: string) => pm({ type: eventConstants.SETTINGS.OPEN_MENTION, text: part }),
	openMarkdownPreview: (text: string) => pm({ type: eventConstants.SETTINGS.OPEN_MARKDOWN_PREVIEW, text }),
	openKeyboardShortcuts: (text: string) => pm({ type: eventConstants.SETTINGS.OPEN_KEYBOARD_SHORTCUTS, text }),
	openImage: (text: string) => pm({ type: eventConstants.SETTINGS.OPEN_IMAGE, text }),
	openMcpSettings: () => pm({ type: eventConstants.SETTINGS.OPEN_MCP_SETTINGS }),
	openProjectMcpSettings: () => pm({ type: eventConstants.SETTINGS.OPEN_PROJECT_MCP_SETTINGS }),
	refreshAllMcpServers: () => pm({ type: eventConstants.SETTINGS.REFRESH_ALL_MCP_SERVERS }),
	restartMcpServer: (text: string, source: "global" | "project") =>
		pm({ type: eventConstants.SETTINGS.RESTART_MCP_SERVER, text, source }),
	deleteMcpServer: (serverName: string, source: "global" | "project") =>
		pm({ type: eventConstants.SETTINGS.DELETE_MCP_SERVER, serverName, source }),
	toggleMcpServer: (serverName: string, source: "global" | "project", disabled: boolean) =>
		pm({ type: eventConstants.SETTINGS.TOGGLE_MCP_SERVER, serverName, source, disabled }),
	updateMcpTimeout: (serverName: string, source: "global" | "project", timeout: number) =>
		pm({ type: eventConstants.SETTINGS.UPDATE_MCP_TIMEOUT, serverName, source, timeout }),
	toggleToolAlwaysAllow: (serverName: string, source: "global" | "project", toolName: string, alwaysAllow: boolean) =>
		pm({ type: eventConstants.SETTINGS.TOGGLE_TOOL_ALWAYS_ALLOW, serverName, source, toolName, alwaysAllow }),
	toggleToolEnabledForPrompt: (
		serverName: string,
		source: "global" | "project",
		toolName: string,
		isEnabled: boolean,
	) =>
		pm({
			type: eventConstants.SETTINGS.TOGGLE_TOOL_ENABLED_FOR_PROMPT,
			serverName,
			source,
			toolName,
			isEnabled,
		}),
	listWorktrees: () => pm({ type: eventConstants.SETTINGS.LIST_WORKTREES }),
	switchWorktree: (worktreePath: string, worktreeNewWindow?: boolean) =>
		pm({
			type: eventConstants.SETTINGS.SWITCH_WORKTREE,
			worktreePath,
			worktreeNewWindow: worktreeNewWindow ?? false,
		}),
	browseForWorktreePath: () => pm({ type: eventConstants.SETTINGS.BROWSE_FOR_WORKTREE_PATH }),
	getWorktreeDefaults: () => pm({ type: eventConstants.SETTINGS.GET_WORKTREE_DEFAULTS }),
	getAvailableBranches: () => pm({ type: eventConstants.SETTINGS.GET_AVAILABLE_BRANCHES }),
	getWorktreeIncludeStatus: () => pm({ type: eventConstants.SETTINGS.GET_WORKTREE_INCLUDE_STATUS }),
	deleteWorktree: (worktreePath: string, worktreeForce?: boolean) =>
		pm({
			type: eventConstants.SETTINGS.DELETE_WORKTREE,
			worktreePath,
			...(worktreeForce !== undefined && { worktreeForce }),
		}),
	createWorktree: (
		worktreePath: string,
		worktreeBranch: string,
		worktreeBaseBranch: string,
		worktreeCreateNewBranch: boolean,
	) =>
		pm({
			type: eventConstants.SETTINGS.CREATE_WORKTREE,
			worktreePath,
			worktreeBranch,
			worktreeBaseBranch,
			worktreeCreateNewBranch,
		}),
	createWorktreeInclude: (worktreeIncludeContent: string) =>
		pm({ type: eventConstants.SETTINGS.CREATE_WORKTREE_INCLUDE, worktreeIncludeContent }),
	saveCodeIndexSettings: (codeIndexSettings: Record<string, unknown>) =>
		pm({
			type: eventConstants.AGENT_STATE.SAVE_CODE_INDEX_SETTINGS_ATOMIC,
			codeIndexSettings,
		} as WebviewMessage),
	requestIndexingStatus: () => pm({ type: eventConstants.AGENT_STATE.REQUEST_INDEXING_STATUS }),
	requestCodeIndexSecretStatus: () => pm({ type: eventConstants.AGENT_STATE.REQUEST_CODE_INDEX_SECRET_STATUS }),
	setAutoEnableDefault: (bool: boolean) => pm({ type: eventConstants.AGENT_STATE.SET_AUTO_ENABLE_DEFAULT, bool }),
	toggleWorkspaceIndexing: (bool: boolean) =>
		pm({ type: eventConstants.AGENT_STATE.TOGGLE_WORKSPACE_INDEXING, bool }),
	startIndexing: () => pm({ type: eventConstants.AGENT_STATE.START_INDEXING }),
	stopIndexing: () => pm({ type: eventConstants.AGENT_STATE.STOP_INDEXING }),
	clearIndexData: () => pm({ type: eventConstants.AGENT_STATE.CLEAR_INDEX_DATA }),
	updateSettings: (updatedSettings: Record<string, unknown>) =>
		pm({ type: eventConstants.SETTINGS.UPDATE_SETTINGS, updatedSettings }),
	setAutoApprovalEnabled: (bool: boolean) => pm({ type: eventConstants.AGENT_STATE.AUTO_APPROVAL_ENABLED, bool }),
	setTelemetry: (text: string | undefined) => pm({ type: eventConstants.SETTINGS.TELEMETRY_SETTING, text }),
	setDebugSetting: (bool: boolean | undefined) => pm({ type: eventConstants.AGENT_STATE.DEBUG_SETTING, bool }),
	reportModeSelectorOpened: (bool: boolean) =>
		pm({ type: eventConstants.AGENT_STATE.HAS_OPENED_MODE_SELECTOR, bool }),
	setModeSelectorOpened: (bool: boolean) => pm({ type: eventConstants.AGENT_STATE.HAS_OPENED_MODE_SELECTOR, bool }),
	updateVscodeSetting: (setting: string, value: number) =>
		pm({ type: eventConstants.AGENT_STATE.UPDATE_VS_CODE_SETTING, setting, value }),
	getVscodeSetting: (setting: string) => pm({ type: eventConstants.AGENT_STATE.GET_VS_CODE_SETTING, setting }),
	updateSystemPromptTemplate: (systemPromptTemplateKey: string, systemPromptTemplate: string) =>
		pm({
			type: eventConstants.AGENT_STATE.UPDATE_SYSTEM_PROMPT_TEMPLATE,
			systemPromptTemplateKey,
			systemPromptTemplate,
		}),
	readFileContent: (text: string) => pm({ type: eventConstants.SETTINGS.READ_FILE_CONTENT, text }),
	requestOpenaiCodexRateLimits: () => pm({ type: eventConstants.SETTINGS.REQUEST_OPEN_AI_CODEX_RATE_LIMITS }),
	downloadErrorDiagnostics: (values: {
		timestamp: string
		version: string
		provider: string
		model: string
		details: string
	}) => pm({ type: eventConstants.DIAGNOSTICS.DOWNLOAD_ERROR_DIAGNOSTICS, values }),
	webviewError: (text: string) => pm({ type: eventConstants.SETTINGS.WEBVIEW_ERROR, text }),
	openDebugApiHistory: () => pm({ type: eventConstants.SETTINGS.OPEN_DEBUG_API_HISTORY }),
	openDebugUiHistory: () => pm({ type: eventConstants.SETTINGS.OPEN_DEBUG_UI_HISTORY }),
	createCommand: (text: string, fileContent?: string) =>
		pm({
			type: eventConstants.SETTINGS.CREATE_COMMAND,
			text,
			...(fileContent !== undefined && { fileContent }),
		}),
	deleteCommand: (text: string) => pm({ type: eventConstants.SETTINGS.DELETE_COMMAND, text }),
	openCommandFile: (text: string) => pm({ type: eventConstants.SETTINGS.OPEN_COMMAND_FILE, text }),
	updateCustomMode: (slug: string, modeConfig: ModeConfig) =>
		pm({ type: "updateCustomMode" as const, slug, modeConfig }),
	updatePrompt: (promptMode: string, customPrompt: Record<string, unknown>) =>
		pm({ type: "updatePrompt" as const, promptMode, customPrompt }),
	checkRulesDirectory: (slug: string) => pm({ type: "checkRulesDirectory" as const, slug }),
	openCustomModesSettings: () => pm({ type: "openCustomModesSettings" as const }),
	deleteCustomMode: (slug: string, checkOnly?: boolean) =>
		pm({ type: "deleteCustomMode" as const, slug, ...(checkOnly !== undefined && { checkOnly }) }),
	exportMode: (slug: string) => pm({ type: "exportMode" as const, slug }),
	getSystemPrompt: (mode: string) => pm({ type: "getSystemPrompt" as const, mode }),
	copySystemPrompt: (mode: string) => pm({ type: "copySystemPrompt" as const, mode }),
	customInstructions: (text: string | undefined) => pm({ type: "customInstructions" as const, text }),
	importMode: (source: "global" | "project") => pm({ type: "importMode" as const, source }),
}))

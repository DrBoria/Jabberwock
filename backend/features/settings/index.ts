// ─── Re-exports from "store.ts" ──────────────────────────────────
export { initSettingsState, getSettingsState } from "./store"
export type { SettingsRootState } from "./store"

// ─── Re-exports from "store.types.ts" ────────────────────────────
export type {
	AutoApprovalState,
	AutoApprovalStateOptions,
	CheckAutoApprovalResult,
	CommandDecision,
	AutoApprovalResult,
	AutoApprovalDeps,
	ToolHandler,
	SayToolData,
} from "./types"

// ─── Re-exports from "store.commands.ts" ─────────────────────────
export {
	containsDangerousSubstitution,
	findLongestPrefixMatch,
	isAutoApprovedSingleCommand,
	isAutoDeniedSingleCommand,
	getCommandDecision,
	getSingleCommandDecision,
} from "./commands"

// ─── Re-exports from "store.auto-approval.ts" ────────────────────
export { checkAutoApproval } from "./auto-approval-check"

// ─── Re-exports from "store.ts" ──────
export { SettingsModel } from "./store"
export { AutoApprovalHandlerModel } from "./auto-approval/store"
export type { IAutoApprovalHandler } from "./auto-approval/store"
// ─── no-deep debt: deep-target re-exports via top barrel ─────────────
export { exportSettings } from "./actions/export"
export { importSettingsFromPath, importSettingsWithFeedback } from "./actions/importSettingsFromPath"
export { updateCustomModeInFile } from "./agents/modes-file-service/crud"
export { loadAndMergeModes } from "./agents/modes-file-service/file-ops"
export { JABBERWOCKMODES_FILENAME } from "./agents/modes-file-service/types"
export type {
	ExportResult,
	ExportedModeConfig,
	ImportData,
	ImportResult,
	RuleFile,
} from "./agents/modes-file-service/types"
export { LOCK_TEXT_SYMBOL, PROTECTED_PATTERNS, getIgnoreInstructions } from "./constants"
export { generateSystemPrompt } from "./context/system/generate"
export { formatResponse } from "./context/responses"
export { getSystemPrompt } from "./context/system/core"
export { filterMcpToolsForMode, filterNativeToolsForMode } from "./context/tools/filter-for-mode"
export {
	convertOpenAIToolChoiceToAnthropic,
	convertOpenAIToolsToAnthropic,
} from "./context/tools/native-tools/converters"
export { DEFAULT_LINE_LIMIT, MAX_LINE_LENGTH } from "./context/tools/native-tools/read/read_file"
export { resolveToolAlias } from "./context/tools/tool-alias"
export * from "./events/actions"
export {
	AGENT_STATE_AUTO_APPROVAL_ENABLED,
	AGENT_STATE_CHECK_RULES_DIRECTORY,
	AGENT_STATE_CLEAR_INDEX_DATA,
	AGENT_STATE_COPY_SYSTEM_PROMPT,
	AGENT_STATE_CUSTOM_INSTRUCTIONS,
	AGENT_STATE_DEBUG_SETTING,
	AGENT_STATE_DELETE_API_CONFIGURATION,
	AGENT_STATE_DELETE_CUSTOM_MODE,
	AGENT_STATE_ENHANCEMENT_API_CONFIG_ID,
	AGENT_STATE_EXPORT_MODE,
	AGENT_STATE_FLUSH_ROUTER_MODELS,
	AGENT_STATE_GET_LIST_API_CONFIGURATION,
	AGENT_STATE_GET_SYSTEM_PROMPT,
	AGENT_STATE_GET_VS_CODE_SETTING,
	AGENT_STATE_HAS_OPENED_MODE_SELECTOR,
	AGENT_STATE_IMPORT_MODE,
	AGENT_STATE_LOAD_API_CONFIGURATION,
	AGENT_STATE_LOAD_API_CONFIGURATION_BY_ID,
	AGENT_STATE_LOCK_API_CONFIG_ACROSS_MODES,
	AGENT_STATE_OPEN_CUSTOM_MODES_SETTINGS,
	AGENT_STATE_RENAME_API_CONFIGURATION,
	AGENT_STATE_REQUEST_CODE_INDEX_SECRET_STATUS,
	AGENT_STATE_REQUEST_INDEXING_STATUS,
	AGENT_STATE_REQUEST_LM_STUDIO_MODELS,
	AGENT_STATE_REQUEST_OLLAMA_MODELS,
	AGENT_STATE_REQUEST_OPEN_AI_MODELS,
	AGENT_STATE_REQUEST_ROO_CREDIT_BALANCE,
	AGENT_STATE_REQUEST_ROO_MODELS,
	AGENT_STATE_REQUEST_ROUTER_MODELS,
	AGENT_STATE_REQUEST_VS_CODE_LM_MODELS,
	AGENT_STATE_SAVE_API_CONFIGURATION,
	AGENT_STATE_SAVE_CODE_INDEX_SETTINGS_ATOMIC,
	AGENT_STATE_SET_AUTO_ENABLE_DEFAULT,
	AGENT_STATE_START_INDEXING,
	AGENT_STATE_STOP_INDEXING,
	AGENT_STATE_TOGGLE_WORKSPACE_INDEXING,
	AGENT_STATE_UPDATE_CUSTOM_MODE,
	AGENT_STATE_UPDATE_PROMPT,
	AGENT_STATE_UPDATE_SYSTEM_PROMPT_TEMPLATE,
	AGENT_STATE_UPDATE_VS_CODE_SETTING,
	AGENT_STATE_UPSERT_API_CONFIGURATION,
	DIAGNOSTICS_CLEAR_DIAGNOSTICS,
	DIAGNOSTICS_DOWNLOAD_ERROR_DIAGNOSTICS,
	SETTINGS_ALLOWED_COMMANDS,
	SETTINGS_BROWSE_FOR_WORKTREE_PATH,
	SETTINGS_CHECKOUT_BRANCH,
	SETTINGS_CHECK_BRANCH_WORKTREE_INCLUDE,
	SETTINGS_CREATE_COMMAND,
	SETTINGS_CREATE_WORKTREE,
	SETTINGS_CREATE_WORKTREE_INCLUDE,
	SETTINGS_DELETE_COMMAND,
	SETTINGS_DELETE_MCP_SERVER,
	SETTINGS_DELETE_WORKTREE,
	SETTINGS_DENIED_COMMANDS,
	SETTINGS_DEVTOOL_STATUS,
	SETTINGS_DID_SHOW_ANNOUNCEMENT,
	SETTINGS_DISMISS_UPSELL,
	SETTINGS_DOM_RESPONSE,
	SETTINGS_FETCH_URL,
	SETTINGS_GET_AVAILABLE_BRANCHES,
	SETTINGS_GET_DISMISSED_UPSELLS,
	SETTINGS_GET_WORKTREE_DEFAULTS,
	SETTINGS_GET_WORKTREE_INCLUDE_STATUS,
	SETTINGS_INSERT_TEXT_INTO_TEXTAREA,
	SETTINGS_LIST_WORKTREES,
	SETTINGS_LOCATOR_OPEN_FILE,
	SETTINGS_LOCATOR_TARGET,
	SETTINGS_OPEN_COMMAND_FILE,
	SETTINGS_OPEN_DEBUG_API_HISTORY,
	SETTINGS_OPEN_DEBUG_UI_HISTORY,
	SETTINGS_OPEN_EXTERNAL,
	SETTINGS_OPEN_FILE,
	SETTINGS_OPEN_IMAGE,
	SETTINGS_OPEN_KEYBOARD_SHORTCUTS,
	SETTINGS_OPEN_MARKDOWN_PREVIEW,
	SETTINGS_OPEN_MCP_SETTINGS,
	SETTINGS_OPEN_MENTION,
	SETTINGS_OPEN_PROJECT_MCP_SETTINGS,
	SETTINGS_READ_FILE_CONTENT,
	SETTINGS_REFRESH_ALL_MCP_SERVERS,
	SETTINGS_REQUEST_MODES,
	SETTINGS_REQUEST_OPEN_AI_CODEX_RATE_LIMITS,
	SETTINGS_RESTART_MCP_SERVER,
	SETTINGS_SAVE_IMAGE,
	SETTINGS_SET_API_CONFIG_PASSWORD,
	SETTINGS_SHOW_MDM_AUTH_REQUIRED_NOTIFICATION,
	SETTINGS_SWITCH_WORKTREE,
	SETTINGS_TELEMETRY_SETTING,
	SETTINGS_TERMINAL_OPERATION,
	SETTINGS_TOGGLE_API_CONFIG_PIN,
	SETTINGS_TOGGLE_MCP_SERVER,
	SETTINGS_TOGGLE_TOOL_ALWAYS_ALLOW,
	SETTINGS_TOGGLE_TOOL_ENABLED_FOR_PROMPT,
	SETTINGS_UPDATE_MCP_TIMEOUT,
	SETTINGS_UPDATE_SETTINGS,
	SETTINGS_WEBVIEW_ERROR,
	SETTINGS_WEBVIEW_LOG,
} from "./events/constants"
export { registerSettingsCoreDebugHandlers } from "./events/handlers/groups/core/settings-core-debug"
export { registerSettingsCoreUiHandlers } from "./events/handlers/groups/core/settings-core-ui"
export { registerSettingsFilesHandlers } from "./events/handlers/groups/core/settings-files"
export { registerVscodeSettingsHandlers } from "./events/handlers/groups/core/vscode-settings"
export { registerCodeIndexHandlers } from "./events/handlers/groups/features/code-index"
export { registerDiagnosticsHandlers } from "./events/handlers/groups/features/diagnostics"
export { registerPromptsHandlers } from "./events/handlers/groups/features/prompts"
export { registerWorktreesHandlers } from "./events/handlers/groups/features/worktrees"
export { registerApiConfigHandlers } from "./events/handlers/groups/providers/api-config"
export { registerModelsHandlers } from "./events/handlers/groups/providers/models"
export { registerModesHandlers } from "./events/handlers/groups/providers/modes"
export { registerSettingsMcpHandlers } from "./events/handlers/groups/providers/settings-mcp"
export { registerOnSettingsIntents } from "./events/handlers"
export { generateErrorDiagnostics } from "./handlers/lifecycle/on-diagnostics"
export type { ErrorDiagnosticsValues } from "./handlers/lifecycle/on-diagnostics"
export { registerCrudRegistrations } from "./handlers/settings-worktree/crud"
export { registerInfoRegistrations } from "./handlers/settings-worktree/info"
export { resolveElicitation, setupMcpHubListeners } from "./mcp/mcpIntegration"
export { ApiConfigModel } from "./models/store"
export { activateProviderProfile, upsertProviderProfile } from "./models/api-config-profiles"
export { MODEL_MIGRATIONS, providerProfilesSchema } from "./models/provider-settings-manager/types"
export type {
	MigrationFlag,
	ProviderProfiles,
	ProviderSettingsDeps,
	SyncCloudProfilesResult,
	SyncContext,
} from "./models/provider-settings-manager/types"

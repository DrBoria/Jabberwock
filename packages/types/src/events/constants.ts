/**
 * Event Type Constants — single source of truth for all vscode.postMessage event types.
 *
 * These constants MUST be used instead of hardcoded string literals everywhere in the codebase.
 * They are derived from the event interfaces in ./event-registry.ts.
 *
 * Usage:
 *   import { eventConstants } from "@jabberwock/types"
 *   vscode.postMessage({ type: eventConstants.CHAT.TASK.NEW_TASK, text })
 */

import { CHAT } from "./chat/constants.ts"
import { SETTINGS } from "./settings/constants.ts"

export const eventConstants = {
	CHAT,

	// ═══════════════════════════════════════════════════════════════════════════════
	// Cloud
	// ═══════════════════════════════════════════════════════════════════════════════

	CLOUD: {
		CLOUD_BUTTON_CLICKED: "cloudButtonClicked" as const,
		JABBERWOCK_CLOUD_SIGN_IN: "jabberwockCloudSignIn" as const,
		CLOUD_LANDING_PAGE_SIGN_IN: "cloudLandingPageSignIn" as const,
		JABBERWOCK_CLOUD_SIGN_OUT: "jabberwockCloudSignOut" as const,
		JABBERWOCK_CLOUD_MANUAL_URL: "jabberwockCloudManualUrl" as const,
		OPEN_AI_CODEX_SIGN_IN: "openAiCodexSignIn" as const,
		OPEN_AI_CODEX_SIGN_OUT: "openAiCodexSignOut" as const,
		SWITCH_ORGANIZATION: "switchOrganization" as const,
		CLEAR_CLOUD_AUTH_SKIP_MODEL: "clearCloudAuthSkipModel" as const,
		AUTHENTICATED_USER: "authenticatedUser" as const,
		ORGANIZATION_SWITCH_RESULT: "organizationSwitchResult" as const,
		SHARE_TASK_SUCCESS: "shareTaskSuccess" as const,
		ROO_CREDIT_BALANCE: "rooCreditBalance" as const,
		FOLLOW_UP_ANSWERED: "followUpAnswered" as const,
	},

	// ═══════════════════════════════════════════════════════════════════════════════
	// Diagnostics
	// ═══════════════════════════════════════════════════════════════════════════════

	DIAGNOSTICS: {
		CLEAR_DIAGNOSTICS: "clearDiagnostics" as const,
		DOWNLOAD_ERROR_DIAGNOSTICS: "downloadErrorDiagnostics" as const,
		DIAGNOSTICS: "diagnostics" as const,
	},

	// ═══════════════════════════════════════════════════════════════════════════════
	// Foundation / Agent State
	// ═══════════════════════════════════════════════════════════════════════════════

	AGENT_STATE: {
		CURRENT_API_CONFIG_NAME: "currentApiConfigName" as const,
		SAVE_API_CONFIGURATION: "saveApiConfiguration" as const,
		UPSERT_API_CONFIGURATION: "upsertApiConfiguration" as const,
		DELETE_API_CONFIGURATION: "deleteApiConfiguration" as const,
		LOAD_API_CONFIGURATION: "loadApiConfiguration" as const,
		LOAD_API_CONFIGURATION_BY_ID: "loadApiConfigurationById" as const,
		RENAME_API_CONFIGURATION: "renameApiConfiguration" as const,
		GET_LIST_API_CONFIGURATION: "getListApiConfiguration" as const,
		CUSTOM_INSTRUCTIONS: "customInstructions" as const,
		FLUSH_ROUTER_MODELS: "flushRouterModels" as const,
		REQUEST_ROUTER_MODELS: "requestRouterModels" as const,
		REQUEST_OPEN_AI_MODELS: "requestOpenAiModels" as const,
		REQUEST_OLLAMA_MODELS: "requestOllamaModels" as const,
		REQUEST_LM_STUDIO_MODELS: "requestLmStudioModels" as const,
		REQUEST_ROO_MODELS: "requestRooModels" as const,
		REQUEST_ROO_CREDIT_BALANCE: "requestRooCreditBalance" as const,
		REQUEST_VS_CODE_LM_MODELS: "requestVsCodeLmModels" as const,
		UPDATE_VS_CODE_SETTING: "updateVSCodeSetting" as const,
		GET_VS_CODE_SETTING: "getVSCodeSetting" as const,
		VS_CODE_SETTING: "vsCodeSetting" as const,
		UPDATE_PROMPT: "updatePrompt" as const,
		GET_SYSTEM_PROMPT: "getSystemPrompt" as const,
		COPY_SYSTEM_PROMPT: "copySystemPrompt" as const,
		SYSTEM_PROMPT: "systemPrompt" as const,
		AUTO_APPROVAL_ENABLED: "autoApprovalEnabled" as const,
		UPDATE_CUSTOM_MODE: "updateCustomMode" as const,
		DELETE_CUSTOM_MODE: "deleteCustomMode" as const,
		EXPORT_MODE: "exportMode" as const,
		IMPORT_MODE: "importMode" as const,
		CHECK_RULES_DIRECTORY: "checkRulesDirectory" as const,
		SETOPEN_AI_CUSTOM_MODEL_INFO: "setopenAiCustomModelInfo" as const,
		OPEN_CUSTOM_MODES_SETTINGS: "openCustomModesSettings" as const,
		CODEBASE_INDEX_ENABLED: "codebaseIndexEnabled" as const,
		REQUEST_INDEXING_STATUS: "requestIndexingStatus" as const,
		START_INDEXING: "startIndexing" as const,
		STOP_INDEXING: "stopIndexing" as const,
		CLEAR_INDEX_DATA: "clearIndexData" as const,
		INDEXING_STATUS_UPDATE: "indexingStatusUpdate" as const,
		INDEX_CLEARED: "indexCleared" as const,
		TOGGLE_WORKSPACE_INDEXING: "toggleWorkspaceIndexing" as const,
		SET_AUTO_ENABLE_DEFAULT: "setAutoEnableDefault" as const,
		SAVE_CODE_INDEX_SETTINGS_ATOMIC: "saveCodeIndexSettingsAtomic" as const,
		REQUEST_CODE_INDEX_SECRET_STATUS: "requestCodeIndexSecretStatus" as const,
		HAS_OPENED_MODE_SELECTOR: "hasOpenedModeSelector" as const,
		LOCK_API_CONFIG_ACROSS_MODES: "lockApiConfigAcrossModes" as const,
		UPDATE_SYSTEM_PROMPT_TEMPLATE: "updateSystemPromptTemplate" as const,
		UPDATE_CONDENSING_PROMPT: "updateCondensingPrompt" as const,
		ENHANCEMENT_API_CONFIG_ID: "enhancementApiConfigId" as const,
		DEBUG_SETTING: "debugSetting" as const,
		LIST_API_CONFIG: "listApiConfig" as const,
		ROUTER_MODELS: "routerModels" as const,
		OPEN_AI_MODELS: "openAiModels" as const,
		OLLAMA_MODELS: "ollamaModels" as const,
		LM_STUDIO_MODELS: "lmStudioModels" as const,
		VS_CODE_LM_MODELS: "vsCodeLmModels" as const,
		VS_CODE_LM_API_AVAILABLE: "vsCodeLmApiAvailable" as const,
		SINGLE_ROUTER_MODEL_FETCH_RESPONSE: "singleRouterModelFetchResponse" as const,
		DELETE_CUSTOM_MODE_CHECK: "deleteCustomModeCheck" as const,
		EXPORT_MODE_RESULT: "exportModeResult" as const,
		IMPORT_MODE_RESULT: "importModeResult" as const,
		CHECK_RULES_DIRECTORY_RESULT: "checkRulesDirectoryResult" as const,
		CODEBASE_INDEX_CONFIG: "codebaseIndexConfig" as const,
		CODE_INDEX_SETTINGS_SAVED: "codeIndexSettingsSaved" as const,
		CODE_INDEX_SECRET_STATUS: "codeIndexSecretStatus" as const,
	},

	// ═══════════════════════════════════════════════════════════════════════════════
	// Foundation / Window Manager
	// ═══════════════════════════════════════════════════════════════════════════════

	WINDOW_MANAGER: {
		FOCUS_PANEL_REQUEST: "focusPanelRequest" as const,
		SWITCH_TAB: "switchTab" as const,
		ACTIVE_PAGE_RESPONSE: "activePageResponse" as const,
		GET_TASK_WITH_AGGREGATED_COSTS: "getTaskWithAggregatedCosts" as const,
		SHOW_TASK_WITH_ID: "showTaskWithId" as const,
		DELETE_TASK_WITH_ID: "deleteTaskWithId" as const,
		EXPORT_TASK_WITH_ID: "exportTaskWithId" as const,
		EXPORT_CURRENT_TASK: "exportCurrentTask" as const,
		DELETE_MULTIPLE_TASKS_WITH_IDS: "deleteMultipleTasksWithIds" as const,
		REQUEST_STATE: "requestState" as const,
		TASK_WITH_AGGREGATED_COSTS: "taskWithAggregatedCosts" as const,
		SHOW_INTERACTIVE_APP: "showInteractiveApp" as const,
		INTERACTION_REQUIRED: "interactionRequired" as const,
		SET_HISTORY_PREVIEW_COLLAPSED: "setHistoryPreviewCollapsed" as const,
	},

	// ═══════════════════════════════════════════════════════════════════════════════
	// Foundation / MST
	// ═══════════════════════════════════════════════════════════════════════════════

	MST: {
		MST_PATCH: "mstPatch" as const,
		MST_SNAPSHOT_BATCH: "mstSnapshotBatch" as const,
	},

	// ═══════════════════════════════════════════════════════════════════════════════
	// History
	// ═══════════════════════════════════════════════════════════════════════════════

	HISTORY: {
		SEARCH_COMMITS: "searchCommits" as const,
		IMPORT_SETTINGS: "importSettings" as const,
		EXPORT_SETTINGS: "exportSettings" as const,
		RESET_STATE: "resetState" as const,
		HISTORY_BUTTON_CLICKED: "historyButtonClicked" as const,
		COMMIT_SEARCH_RESULTS: "commitSearchResults" as const,
		WORKSPACE_UPDATED: "workspaceUpdated" as const,
	},

	// ═══════════════════════════════════════════════════════════════════════════════
	// Marketplace
	// ═══════════════════════════════════════════════════════════════════════════════

	MARKETPLACE: {
		MARKETPLACE_BUTTON_CLICKED: "marketplaceButtonClicked" as const,
		FILTER_MARKETPLACE_ITEMS: "filterMarketplaceItems" as const,
		INSTALL_MARKETPLACE_ITEM: "installMarketplaceItem" as const,
		INSTALL_MARKETPLACE_ITEM_WITH_PARAMETERS: "installMarketplaceItemWithParameters" as const,
		CANCEL_MARKETPLACE_INSTALL: "cancelMarketplaceInstall" as const,
		REMOVE_INSTALLED_MARKETPLACE_ITEM: "removeInstalledMarketplaceItem" as const,
		MARKETPLACE_INSTALL_RESULT: "marketplaceInstallResult" as const,
		FETCH_MARKETPLACE_DATA: "fetchMarketplaceData" as const,
		REFRESH_CUSTOM_TOOLS: "refreshCustomTools" as const,
		REQUEST_SKILLS: "requestSkills" as const,
		CREATE_SKILL: "createSkill" as const,
		DELETE_SKILL: "deleteSkill" as const,
		MOVE_SKILL: "moveSkill" as const,
		UPDATE_SKILL_MODES: "updateSkillModes" as const,
		OPEN_SKILL_FILE: "openSkillFile" as const,
		MARKETPLACE_DATA: "marketplaceData" as const,
		MARKETPLACE_REMOVE_RESULT: "marketplaceRemoveResult" as const,
		CUSTOM_TOOLS_RESULT: "customToolsResult" as const,
		SKILLS: "skills" as const,
	},

	// ═══════════════════════════════════════════════════════════════════════════════
	// Settings
	// ═══════════════════════════════════════════════════════════════════════════════

	SETTINGS,
} as const

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

export const eventConstants = {
	// ═══════════════════════════════════════════════════════════════════════════════
	// Chat
	// ═══════════════════════════════════════════════════════════════════════════════

	CHAT: {
		// ─── ChatMessagesList ───────────────────────────────────────────────────
		MESSAGES_LIST: {
			ASK_RESPONSE: "askResponse" as const,
			DELETE_MESSAGE: "deleteMessage" as const,
			DELETE_MESSAGE_CONFIRM: "deleteMessageConfirm" as const,
			SUBMIT_EDITED_MESSAGE: "submitEditedMessage" as const,
			EDIT_MESSAGE_CONFIRM: "editMessageConfirm" as const,
			CHAT_TREE_SNAPSHOT: "chatTreeSnapshot" as const,
			CHAT_TREE_PATCH: "chatTreePatch" as const,
			MESSAGE_UPDATED: "messageUpdated" as const,
			SHOW_EDIT_MESSAGE_DIALOG: "showEditMessageDialog" as const,
			SHOW_DELETE_MESSAGE_DIALOG: "showDeleteMessageDialog" as const,
		},

		// ─── ChatNotifications ───────────────────────────────────────────────────
		NOTIFICATIONS: {
			CHECKPOINT_DIFF: "checkpointDiff" as const,
			CHECKPOINT_RESTORE: "checkpointRestore" as const,
			PLAY_SOUND: "playSound" as const,
			PLAY_TTS: "playTts" as const,
			STOP_TTS: "stopTts" as const,
			TTS_ENABLED: "ttsEnabled" as const,
			TTS_SPEED: "ttsSpeed" as const,
			QUEUE_MESSAGE: "queueMessage" as const,
			REMOVE_QUEUED_MESSAGE: "removeQueuedMessage" as const,
			EDIT_QUEUED_MESSAGE: "editQueuedMessage" as const,
			ELICITATION_RESPONSE: "elicitationResponse" as const,
			CANCEL_AUTO_APPROVAL: "cancelAutoApproval" as const,
			LAST_MESSAGE_SEEN: "lastMessageSeen" as const,
			CURRENT_CHECKPOINT_UPDATED: "currentCheckpointUpdated" as const,
			CHECKPOINT_INIT_WARNING: "checkpointInitWarning" as const,
			TTS_START: "ttsStart" as const,
			TTS_STOP: "ttsStop" as const,
			COMMAND_EXECUTION_STATUS: "commandExecutionStatus" as const,
			MCP_EXECUTION_STATUS: "mcpExecutionStatus" as const,
		},

		// ─── ChatTask ───────────────────────────────────────────────────
		TASK: {
			NEW_TASK: "newTask" as const,
			CANCEL_TASK: "cancelTask" as const,
			CLEAR_TASK: "clearTask" as const,
			TASK_SYNC_ENABLED: "taskSyncEnabled" as const,
			CONDENSE_TASK_CONTEXT_REQUEST: "condenseTaskContextRequest" as const,
			WEBVIEW_DID_LAUNCH: "webviewDidLaunch" as const,
			SET_CHAT_BOX_MESSAGE: "setChatBoxMessage" as const,
			ACTION: "action" as const,
			STATE: "state" as const,
			CONDENSE_TASK_CONTEXT_STARTED: "condenseTaskContextStarted" as const,
			CONDENSE_TASK_CONTEXT_RESPONSE: "condenseTaskContextResponse" as const,
			ACCEPT_INPUT: "acceptInput" as const,
		},

		// ─── ChatTextArea ───────────────────────────────────────────────────
		TEXT_AREA: {
			ENHANCE_PROMPT: "enhancePrompt" as const,
			DRAGGED_IMAGES: "draggedImages" as const,
			SELECT_IMAGES: "selectImages" as const,
			SEARCH_FILES: "searchFiles" as const,
			ENHANCED_PROMPT: "enhancedPrompt" as const,
			FILE_SEARCH_RESULTS: "fileSearchResults" as const,
			INSERT_TEXT_INTO_TEXTAREA: "insertTextIntoTextarea" as const,
		},

		// ─── ChatTopic ───────────────────────────────────────────────────
		TOPIC: {
			MODE: "mode" as const,
			REQUEST_COMMANDS: "requestCommands" as const,
			SWITCH_MODE: "switchMode" as const,
			UPDATE_TODO_LIST: "updateTodoList" as const,
			TASK_HISTORY_UPDATED: "taskHistoryUpdated" as const,
			TASK_HISTORY_ITEM_UPDATED: "taskHistoryItemUpdated" as const,
			COMMANDS: "commands" as const,
			MODES: "modes" as const,
		},
	},

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

	SETTINGS: {
		UPDATE_SETTINGS: "updateSettings" as const,
		DID_SHOW_ANNOUNCEMENT: "didShowAnnouncement" as const,
		GET_DISMISSED_UPSELLS: "getDismissedUpsells" as const,
		DISMISS_UPSELL: "dismissUpsell" as const,
		OPEN_IMAGE: "openImage" as const,
		SAVE_IMAGE: "saveImage" as const,
		OPEN_FILE: "openFile" as const,
		READ_FILE_CONTENT: "readFileContent" as const,
		OPEN_MENTION: "openMention" as const,
		OPEN_EXTERNAL: "openExternal" as const,
		OPEN_KEYBOARD_SHORTCUTS: "openKeyboardShortcuts" as const,
		OPEN_MCP_SETTINGS: "openMcpSettings" as const,
		OPEN_PROJECT_MCP_SETTINGS: "openProjectMcpSettings" as const,
		RESTART_MCP_SERVER: "restartMcpServer" as const,
		REFRESH_ALL_MCP_SERVERS: "refreshAllMcpServers" as const,
		TOGGLE_TOOL_ALWAYS_ALLOW: "toggleToolAlwaysAllow" as const,
		TOGGLE_TOOL_ENABLED_FOR_PROMPT: "toggleToolEnabledForPrompt" as const,
		TOGGLE_MCP_SERVER: "toggleMcpServer" as const,
		UPDATE_MCP_TIMEOUT: "updateMcpTimeout" as const,
		DELETE_MCP_SERVER: "deleteMcpServer" as const,
		SET_API_CONFIG_PASSWORD: "setApiConfigPassword" as const,
		TELEMETRY_SETTING: "telemetrySetting" as const,
		TOGGLE_API_CONFIG_PIN: "toggleApiConfigPin" as const,
		LIST_WORKTREES: "listWorktrees" as const,
		CREATE_WORKTREE: "createWorktree" as const,
		DELETE_WORKTREE: "deleteWorktree" as const,
		SWITCH_WORKTREE: "switchWorktree" as const,
		GET_AVAILABLE_BRANCHES: "getAvailableBranches" as const,
		GET_WORKTREE_DEFAULTS: "getWorktreeDefaults" as const,
		GET_WORKTREE_INCLUDE_STATUS: "getWorktreeIncludeStatus" as const,
		CHECK_BRANCH_WORKTREE_INCLUDE: "checkBranchWorktreeInclude" as const,
		CREATE_WORKTREE_INCLUDE: "createWorktreeInclude" as const,
		CHECKOUT_BRANCH: "checkoutBranch" as const,
		BROWSE_FOR_WORKTREE_PATH: "browseForWorktreePath" as const,
		WEBVIEW_LOG: "webviewLog" as const,
		DEVTOOL_STATUS: "devtoolStatus" as const,
		LOCATOR_TARGET: "locatorTarget" as const,
		DOM_RESPONSE: "domResponse" as const,
		WEBVIEW_ERROR: "webviewError" as const,
		FETCH_URL: "fetchUrl" as const,
		ALLOWED_COMMANDS: "allowedCommands" as const,
		DENIED_COMMANDS: "deniedCommands" as const,
		OPEN_DEBUG_API_HISTORY: "openDebugApiHistory" as const,
		OPEN_DEBUG_UI_HISTORY: "openDebugUiHistory" as const,
		REQUEST_OPEN_AI_CODEX_RATE_LIMITS: "requestOpenAiCodexRateLimits" as const,
		REQUEST_MODES: "requestModes" as const,
		IMAGE_GENERATION_SETTINGS: "imageGenerationSettings" as const,
		OPEN_MARKDOWN_PREVIEW: "openMarkdownPreview" as const,
		OPEN_COMMAND_FILE: "openCommandFile" as const,
		DELETE_COMMAND: "deleteCommand" as const,
		CREATE_COMMAND: "createCommand" as const,
		INSERT_TEXT_INTO_TEXTAREA: "insertTextIntoTextarea" as const,
		SHOW_MDM_AUTH_REQUIRED_NOTIFICATION: "showMdmAuthRequiredNotification" as const,
		TERMINAL_OPERATION: "terminalOperation" as const,
		LOCATOR_OPEN_FILE: "LOCATOR_OPEN_FILE" as const,
		MCP_SERVERS: "mcpServers" as const,
		THEME: "theme" as const,
		SELECTED_IMAGES: "selectedImages" as const,
		INVOKE: "invoke" as const,
		OPEN_AI_CODEX_RATE_LIMITS: "openAiCodexRateLimits" as const,
		WORKTREE_LIST: "worktreeList" as const,
		WORKTREE_RESULT: "worktreeResult" as const,
		WORKTREE_COPY_PROGRESS: "worktreeCopyProgress" as const,
		BRANCH_LIST: "branchList" as const,
		WORKTREE_DEFAULTS: "worktreeDefaults" as const,
		WORKTREE_INCLUDE_STATUS: "worktreeIncludeStatus" as const,
		BRANCH_WORKTREE_INCLUDE_RESULT: "branchWorktreeIncludeResult" as const,
		FOLDER_SELECTED: "folderSelected" as const,
		FILE_CONTENT: "fileContent" as const,
		FETCH_URL_RESPONSE: "fetchUrlResponse" as const,
	},
} as const

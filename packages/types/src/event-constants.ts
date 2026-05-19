/**
 * Event Type Constants — single source of truth for all vscode.postMessage event types.
 *
 * These constants MUST be used instead of hardcoded string literals everywhere in the codebase.
 * They are derived from the event interfaces in ./event-registry.ts.
 *
 * Naming convention:
 *   <FEATURE>[_<SUBFEATURE>]_<ACTION> (UPPER_SNAKE_CASE)
 *   Value matches the flat `type` string used in postMessage / onDidReceiveMessage.
 *
 * Usage:
 *   import { CHAT_TASK_NEW_TASK } from "@jabberwock/types"
 *   vscode.postMessage({ type: CHAT_TASK_NEW_TASK, text })
 */

// ═══════════════════════════════════════════════════════════════════════════════
// WEBVIEW → BACKEND (postMessage events)
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// Chat / Messages List
// ═══════════════════════════════════════════════════════════════════════════════

// ─── ChatMessagesList ───────────────────────────────────────────────────
export const CHAT_MESSAGES_LIST_ASK_RESPONSE = "askResponse" as const
export const CHAT_MESSAGES_LIST_DELETE_MESSAGE = "deleteMessage" as const
export const CHAT_MESSAGES_LIST_DELETE_MESSAGE_CONFIRM = "deleteMessageConfirm" as const
export const CHAT_MESSAGES_LIST_SUBMIT_EDITED_MESSAGE = "submitEditedMessage" as const
export const CHAT_MESSAGES_LIST_EDIT_MESSAGE_CONFIRM = "editMessageConfirm" as const

// ═══════════════════════════════════════════════════════════════════════════════
// Chat / Notifications
// ═══════════════════════════════════════════════════════════════════════════════

// ─── ChatNotifications ───────────────────────────────────────────────────
export const CHAT_NOTIFICATIONS_CHECKPOINT_DIFF = "checkpointDiff" as const
export const CHAT_NOTIFICATIONS_CHECKPOINT_RESTORE = "checkpointRestore" as const
export const CHAT_NOTIFICATIONS_PLAY_SOUND = "playSound" as const
export const CHAT_NOTIFICATIONS_PLAY_TTS = "playTts" as const
export const CHAT_NOTIFICATIONS_STOP_TTS = "stopTts" as const
export const CHAT_NOTIFICATIONS_TTS_ENABLED = "ttsEnabled" as const
export const CHAT_NOTIFICATIONS_TTS_SPEED = "ttsSpeed" as const
export const CHAT_NOTIFICATIONS_QUEUE_MESSAGE = "queueMessage" as const
export const CHAT_NOTIFICATIONS_REMOVE_QUEUED_MESSAGE = "removeQueuedMessage" as const
export const CHAT_NOTIFICATIONS_EDIT_QUEUED_MESSAGE = "editQueuedMessage" as const
export const CHAT_NOTIFICATIONS_ELICITATION_RESPONSE = "elicitationResponse" as const

// ═══════════════════════════════════════════════════════════════════════════════
// Chat / Task
// ═══════════════════════════════════════════════════════════════════════════════

// ─── ChatTask ───────────────────────────────────────────────────
export const CHAT_TASK_NEW_TASK = "newTask" as const
export const CHAT_TASK_CANCEL_TASK = "cancelTask" as const
export const CHAT_TASK_CLEAR_TASK = "clearTask" as const
export const CHAT_TASK_TASK_SYNC_ENABLED = "taskSyncEnabled" as const
export const CHAT_TASK_CONDENSE_TASK_CONTEXT_REQUEST = "condenseTaskContextRequest" as const
export const CHAT_TASK_WEBVIEW_DID_LAUNCH = "webviewDidLaunch" as const

// ═══════════════════════════════════════════════════════════════════════════════
// Chat / Text Area
// ═══════════════════════════════════════════════════════════════════════════════

// ─── ChatTextArea ───────────────────────────────────────────────────
export const CHAT_TEXT_AREA_ENHANCE_PROMPT = "enhancePrompt" as const
export const CHAT_TEXT_AREA_DRAGGED_IMAGES = "draggedImages" as const
export const CHAT_TEXT_AREA_SELECT_IMAGES = "selectImages" as const
export const CHAT_TEXT_AREA_SEARCH_FILES = "searchFiles" as const

// ═══════════════════════════════════════════════════════════════════════════════
// Chat / Topic
// ═══════════════════════════════════════════════════════════════════════════════

// ─── ChatTopic ───────────────────────────────────────────────────
export const CHAT_TOPIC_MODE = "mode" as const
export const CHAT_TOPIC_REQUEST_COMMANDS = "requestCommands" as const
export const CHAT_TOPIC_SWITCH_MODE = "switchMode" as const
export const CHAT_TOPIC_UPDATE_TODO_LIST = "updateTodoList" as const

// ═══════════════════════════════════════════════════════════════════════════════
// Cloud
// ═══════════════════════════════════════════════════════════════════════════════

export const CLOUD_CLOUD_BUTTON_CLICKED = "cloudButtonClicked" as const
export const CLOUD_JABBERWOCK_CLOUD_SIGN_IN = "jabberwockCloudSignIn" as const
export const CLOUD_CLOUD_LANDING_PAGE_SIGN_IN = "cloudLandingPageSignIn" as const
export const CLOUD_JABBERWOCK_CLOUD_SIGN_OUT = "jabberwockCloudSignOut" as const
export const CLOUD_JABBERWOCK_CLOUD_MANUAL_URL = "jabberwockCloudManualUrl" as const
export const CLOUD_OPEN_AI_CODEX_SIGN_IN = "openAiCodexSignIn" as const
export const CLOUD_OPEN_AI_CODEX_SIGN_OUT = "openAiCodexSignOut" as const
export const CLOUD_SWITCH_ORGANIZATION = "switchOrganization" as const
export const CLOUD_CLEAR_CLOUD_AUTH_SKIP_MODEL = "clearCloudAuthSkipModel" as const

// ═══════════════════════════════════════════════════════════════════════════════
// Diagnostics
// ═══════════════════════════════════════════════════════════════════════════════

export const DIAGNOSTICS_CLEAR_DIAGNOSTICS = "clearDiagnostics" as const
export const DIAGNOSTICS_DOWNLOAD_ERROR_DIAGNOSTICS = "downloadErrorDiagnostics" as const

// ═══════════════════════════════════════════════════════════════════════════════
// Foundation / Agent State
// ═══════════════════════════════════════════════════════════════════════════════

export const AGENT_STATE_CURRENT_API_CONFIG_NAME = "currentApiConfigName" as const
export const AGENT_STATE_SAVE_API_CONFIGURATION = "saveApiConfiguration" as const
export const AGENT_STATE_UPSERT_API_CONFIGURATION = "upsertApiConfiguration" as const
export const AGENT_STATE_DELETE_API_CONFIGURATION = "deleteApiConfiguration" as const
export const AGENT_STATE_LOAD_API_CONFIGURATION = "loadApiConfiguration" as const
export const AGENT_STATE_LOAD_API_CONFIGURATION_BY_ID = "loadApiConfigurationById" as const
export const AGENT_STATE_RENAME_API_CONFIGURATION = "renameApiConfiguration" as const
export const AGENT_STATE_GET_LIST_API_CONFIGURATION = "getListApiConfiguration" as const
export const AGENT_STATE_CUSTOM_INSTRUCTIONS = "customInstructions" as const
export const AGENT_STATE_FLUSH_ROUTER_MODELS = "flushRouterModels" as const
export const AGENT_STATE_REQUEST_ROUTER_MODELS = "requestRouterModels" as const
export const AGENT_STATE_REQUEST_OPEN_AI_MODELS = "requestOpenAiModels" as const
export const AGENT_STATE_REQUEST_OLLAMA_MODELS = "requestOllamaModels" as const
export const AGENT_STATE_REQUEST_LM_STUDIO_MODELS = "requestLmStudioModels" as const
export const AGENT_STATE_REQUEST_ROO_MODELS = "requestRooModels" as const
export const AGENT_STATE_REQUEST_ROO_CREDIT_BALANCE = "requestRooCreditBalance" as const
export const AGENT_STATE_REQUEST_VS_CODE_LM_MODELS = "requestVsCodeLmModels" as const
export const AGENT_STATE_UPDATE_VS_CODE_SETTING = "updateVSCodeSetting" as const
export const AGENT_STATE_GET_VS_CODE_SETTING = "getVSCodeSetting" as const
export const AGENT_STATE_VS_CODE_SETTING = "vsCodeSetting" as const
export const AGENT_STATE_UPDATE_PROMPT = "updatePrompt" as const
export const AGENT_STATE_GET_SYSTEM_PROMPT = "getSystemPrompt" as const
export const AGENT_STATE_COPY_SYSTEM_PROMPT = "copySystemPrompt" as const
export const AGENT_STATE_SYSTEM_PROMPT = "systemPrompt" as const
export const AGENT_STATE_AUTO_APPROVAL_ENABLED = "autoApprovalEnabled" as const
export const AGENT_STATE_UPDATE_CUSTOM_MODE = "updateCustomMode" as const
export const AGENT_STATE_DELETE_CUSTOM_MODE = "deleteCustomMode" as const
export const AGENT_STATE_EXPORT_MODE = "exportMode" as const
export const AGENT_STATE_IMPORT_MODE = "importMode" as const
export const AGENT_STATE_CHECK_RULES_DIRECTORY = "checkRulesDirectory" as const
export const AGENT_STATE_SETOPEN_AI_CUSTOM_MODEL_INFO = "setopenAiCustomModelInfo" as const
export const AGENT_STATE_OPEN_CUSTOM_MODES_SETTINGS = "openCustomModesSettings" as const
export const AGENT_STATE_CODEBASE_INDEX_ENABLED = "codebaseIndexEnabled" as const
export const AGENT_STATE_REQUEST_INDEXING_STATUS = "requestIndexingStatus" as const
export const AGENT_STATE_START_INDEXING = "startIndexing" as const
export const AGENT_STATE_STOP_INDEXING = "stopIndexing" as const
export const AGENT_STATE_CLEAR_INDEX_DATA = "clearIndexData" as const
export const AGENT_STATE_INDEXING_STATUS_UPDATE = "indexingStatusUpdate" as const
export const AGENT_STATE_INDEX_CLEARED = "indexCleared" as const
export const AGENT_STATE_TOGGLE_WORKSPACE_INDEXING = "toggleWorkspaceIndexing" as const
export const AGENT_STATE_SET_AUTO_ENABLE_DEFAULT = "setAutoEnableDefault" as const
export const AGENT_STATE_SAVE_CODE_INDEX_SETTINGS_ATOMIC = "saveCodeIndexSettingsAtomic" as const
export const AGENT_STATE_REQUEST_CODE_INDEX_SECRET_STATUS = "requestCodeIndexSecretStatus" as const
export const AGENT_STATE_HAS_OPENED_MODE_SELECTOR = "hasOpenedModeSelector" as const
export const AGENT_STATE_LOCK_API_CONFIG_ACROSS_MODES = "lockApiConfigAcrossModes" as const
export const AGENT_STATE_UPDATE_SYSTEM_PROMPT_TEMPLATE = "updateSystemPromptTemplate" as const
export const AGENT_STATE_UPDATE_CONDENSING_PROMPT = "updateCondensingPrompt" as const
export const AGENT_STATE_ENHANCEMENT_API_CONFIG_ID = "enhancementApiConfigId" as const
export const AGENT_STATE_DEBUG_SETTING = "debugSetting" as const

// ═══════════════════════════════════════════════════════════════════════════════
// Foundation / Window Manager
// ═══════════════════════════════════════════════════════════════════════════════

export const WINDOW_MANAGER_FOCUS_PANEL_REQUEST = "focusPanelRequest" as const
export const WINDOW_MANAGER_SWITCH_TAB = "switchTab" as const
export const WINDOW_MANAGER_ACTIVE_PAGE_RESPONSE = "activePageResponse" as const
export const WINDOW_MANAGER_GET_TASK_WITH_AGGREGATED_COSTS = "getTaskWithAggregatedCosts" as const
export const WINDOW_MANAGER_SHOW_TASK_WITH_ID = "showTaskWithId" as const
export const WINDOW_MANAGER_DELETE_TASK_WITH_ID = "deleteTaskWithId" as const
export const WINDOW_MANAGER_EXPORT_TASK_WITH_ID = "exportTaskWithId" as const
export const WINDOW_MANAGER_EXPORT_CURRENT_TASK = "exportCurrentTask" as const
export const WINDOW_MANAGER_DELETE_MULTIPLE_TASKS_WITH_IDS = "deleteMultipleTasksWithIds" as const

// ═══════════════════════════════════════════════════════════════════════════════
// Foundation / MST
// ═══════════════════════════════════════════════════════════════════════════════

export const MST_MST_PATCH = "mstPatch" as const

// ═══════════════════════════════════════════════════════════════════════════════
// History
// ═══════════════════════════════════════════════════════════════════════════════

export const HISTORY_SEARCH_COMMITS = "searchCommits" as const
export const HISTORY_IMPORT_SETTINGS = "importSettings" as const
export const HISTORY_EXPORT_SETTINGS = "exportSettings" as const
export const HISTORY_RESET_STATE = "resetState" as const
export const HISTORY_HISTORY_BUTTON_CLICKED = "historyButtonClicked" as const

// ═══════════════════════════════════════════════════════════════════════════════
// Marketplace
// ═══════════════════════════════════════════════════════════════════════════════

export const MARKETPLACE_MARKETPLACE_BUTTON_CLICKED = "marketplaceButtonClicked" as const
export const MARKETPLACE_FILTER_MARKETPLACE_ITEMS = "filterMarketplaceItems" as const
export const MARKETPLACE_INSTALL_MARKETPLACE_ITEM = "installMarketplaceItem" as const
export const MARKETPLACE_INSTALL_MARKETPLACE_ITEM_WITH_PARAMETERS = "installMarketplaceItemWithParameters" as const
export const MARKETPLACE_CANCEL_MARKETPLACE_INSTALL = "cancelMarketplaceInstall" as const
export const MARKETPLACE_REMOVE_INSTALLED_MARKETPLACE_ITEM = "removeInstalledMarketplaceItem" as const
export const MARKETPLACE_MARKETPLACE_INSTALL_RESULT = "marketplaceInstallResult" as const
export const MARKETPLACE_FETCH_MARKETPLACE_DATA = "fetchMarketplaceData" as const
export const MARKETPLACE_REFRESH_CUSTOM_TOOLS = "refreshCustomTools" as const
export const MARKETPLACE_REQUEST_SKILLS = "requestSkills" as const
export const MARKETPLACE_CREATE_SKILL = "createSkill" as const
export const MARKETPLACE_DELETE_SKILL = "deleteSkill" as const
export const MARKETPLACE_MOVE_SKILL = "moveSkill" as const
export const MARKETPLACE_UPDATE_SKILL_MODES = "updateSkillModes" as const
export const MARKETPLACE_OPEN_SKILL_FILE = "openSkillFile" as const

// ═══════════════════════════════════════════════════════════════════════════════
// Settings
// ═══════════════════════════════════════════════════════════════════════════════

export const SETTINGS_UPDATE_SETTINGS = "updateSettings" as const
export const SETTINGS_DID_SHOW_ANNOUNCEMENT = "didShowAnnouncement" as const
export const SETTINGS_GET_DISMISSED_UPSELLS = "getDismissedUpsells" as const
export const SETTINGS_DISMISS_UPSELL = "dismissUpsell" as const
export const SETTINGS_OPEN_IMAGE = "openImage" as const
export const SETTINGS_SAVE_IMAGE = "saveImage" as const
export const SETTINGS_OPEN_FILE = "openFile" as const
export const SETTINGS_READ_FILE_CONTENT = "readFileContent" as const
export const SETTINGS_OPEN_MENTION = "openMention" as const
export const SETTINGS_OPEN_EXTERNAL = "openExternal" as const
export const SETTINGS_OPEN_KEYBOARD_SHORTCUTS = "openKeyboardShortcuts" as const
export const SETTINGS_OPEN_MCP_SETTINGS = "openMcpSettings" as const
export const SETTINGS_OPEN_PROJECT_MCP_SETTINGS = "openProjectMcpSettings" as const
export const SETTINGS_RESTART_MCP_SERVER = "restartMcpServer" as const
export const SETTINGS_REFRESH_ALL_MCP_SERVERS = "refreshAllMcpServers" as const
export const SETTINGS_TOGGLE_TOOL_ALWAYS_ALLOW = "toggleToolAlwaysAllow" as const
export const SETTINGS_TOGGLE_TOOL_ENABLED_FOR_PROMPT = "toggleToolEnabledForPrompt" as const
export const SETTINGS_TOGGLE_MCP_SERVER = "toggleMcpServer" as const
export const SETTINGS_UPDATE_MCP_TIMEOUT = "updateMcpTimeout" as const
export const SETTINGS_DELETE_MCP_SERVER = "deleteMcpServer" as const
export const SETTINGS_SET_API_CONFIG_PASSWORD = "setApiConfigPassword" as const
export const SETTINGS_TELEMETRY_SETTING = "telemetrySetting" as const
export const SETTINGS_TOGGLE_API_CONFIG_PIN = "toggleApiConfigPin" as const
export const SETTINGS_LIST_WORKTREES = "listWorktrees" as const
export const SETTINGS_CREATE_WORKTREE = "createWorktree" as const
export const SETTINGS_DELETE_WORKTREE = "deleteWorktree" as const
export const SETTINGS_SWITCH_WORKTREE = "switchWorktree" as const
export const SETTINGS_GET_AVAILABLE_BRANCHES = "getAvailableBranches" as const
export const SETTINGS_GET_WORKTREE_DEFAULTS = "getWorktreeDefaults" as const
export const SETTINGS_GET_WORKTREE_INCLUDE_STATUS = "getWorktreeIncludeStatus" as const
export const SETTINGS_CHECK_BRANCH_WORKTREE_INCLUDE = "checkBranchWorktreeInclude" as const
export const SETTINGS_CREATE_WORKTREE_INCLUDE = "createWorktreeInclude" as const
export const SETTINGS_CHECKOUT_BRANCH = "checkoutBranch" as const
export const SETTINGS_BROWSE_FOR_WORKTREE_PATH = "browseForWorktreePath" as const
export const SETTINGS_WEBVIEW_LOG = "webviewLog" as const
export const SETTINGS_DEVTOOL_STATUS = "devtoolStatus" as const
export const SETTINGS_LOCATOR_TARGET = "locatorTarget" as const
export const SETTINGS_DOM_RESPONSE = "domResponse" as const
export const SETTINGS_WEBVIEW_ERROR = "webviewError" as const
export const SETTINGS_FETCH_URL = "fetchUrl" as const
export const SETTINGS_ALLOWED_COMMANDS = "allowedCommands" as const
export const SETTINGS_DENIED_COMMANDS = "deniedCommands" as const
export const SETTINGS_OPEN_DEBUG_API_HISTORY = "openDebugApiHistory" as const
export const SETTINGS_OPEN_DEBUG_UI_HISTORY = "openDebugUiHistory" as const
export const SETTINGS_REQUEST_OPEN_AI_CODEX_RATE_LIMITS = "requestOpenAiCodexRateLimits" as const
export const SETTINGS_REQUEST_MODES = "requestModes" as const
export const SETTINGS_IMAGE_GENERATION_SETTINGS = "imageGenerationSettings" as const
export const SETTINGS_OPEN_MARKDOWN_PREVIEW = "openMarkdownPreview" as const
export const SETTINGS_OPEN_COMMAND_FILE = "openCommandFile" as const
export const SETTINGS_DELETE_COMMAND = "deleteCommand" as const
export const SETTINGS_CREATE_COMMAND = "createCommand" as const
export const SETTINGS_INSERT_TEXT_INTO_TEXTAREA = "insertTextIntoTextarea" as const
export const SETTINGS_SHOW_MDM_AUTH_REQUIRED_NOTIFICATION = "showMdmAuthRequiredNotification" as const
export const SETTINGS_TERMINAL_OPERATION = "terminalOperation" as const
export const SETTINGS_LOCATOR_OPEN_FILE = "LOCATOR_OPEN_FILE" as const

// ═══════════════════════════════════════════════════════════════════════════════
// BACKEND → WEBVIEW (onDidReceiveMessage events)
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// Chat / Messages List
// ═══════════════════════════════════════════════════════════════════════════════

// ─── ChatMessagesList ───────────────────────────────────────────────────
export const CHAT_MESSAGES_LIST_CHAT_TREE_SNAPSHOT = "chatTreeSnapshot" as const
export const CHAT_MESSAGES_LIST_CHAT_TREE_PATCH = "chatTreePatch" as const
export const CHAT_MESSAGES_LIST_MESSAGE_UPDATED = "messageUpdated" as const
export const CHAT_MESSAGES_LIST_SHOW_EDIT_MESSAGE_DIALOG = "showEditMessageDialog" as const
export const CHAT_MESSAGES_LIST_SHOW_DELETE_MESSAGE_DIALOG = "showDeleteMessageDialog" as const

// ═══════════════════════════════════════════════════════════════════════════════
// Chat / Notifications
// ═══════════════════════════════════════════════════════════════════════════════

// ─── ChatNotifications ───────────────────────────────────────────────────
export const CHAT_NOTIFICATIONS_CURRENT_CHECKPOINT_UPDATED = "currentCheckpointUpdated" as const
export const CHAT_NOTIFICATIONS_CHECKPOINT_INIT_WARNING = "checkpointInitWarning" as const
export const CHAT_NOTIFICATIONS_TTS_START = "ttsStart" as const
export const CHAT_NOTIFICATIONS_TTS_STOP = "ttsStop" as const
export const CHAT_NOTIFICATIONS_COMMAND_EXECUTION_STATUS = "commandExecutionStatus" as const
export const CHAT_NOTIFICATIONS_MCP_EXECUTION_STATUS = "mcpExecutionStatus" as const

// ═══════════════════════════════════════════════════════════════════════════════
// Chat / Task
// ═══════════════════════════════════════════════════════════════════════════════

// ─── ChatTask ───────────────────────────────────────────────────
export const CHAT_TASK_ACTION = "action" as const
export const CHAT_TASK_STATE = "state" as const
export const CHAT_TASK_CONDENSE_TASK_CONTEXT_STARTED = "condenseTaskContextStarted" as const
export const CHAT_TASK_CONDENSE_TASK_CONTEXT_RESPONSE = "condenseTaskContextResponse" as const
export const CHAT_TASK_ACCEPT_INPUT = "acceptInput" as const

// ═══════════════════════════════════════════════════════════════════════════════
// Chat / Text Area
// ═══════════════════════════════════════════════════════════════════════════════

// ─── ChatTextArea ───────────────────────────────────────────────────
export const CHAT_TEXT_AREA_ENHANCED_PROMPT = "enhancedPrompt" as const
export const CHAT_TEXT_AREA_FILE_SEARCH_RESULTS = "fileSearchResults" as const
export const CHAT_TEXT_AREA_INSERT_TEXT_INTO_TEXTAREA = "insertTextIntoTextarea" as const

// ═══════════════════════════════════════════════════════════════════════════════
// Chat / Topic
// ═══════════════════════════════════════════════════════════════════════════════

// ─── ChatTopic ───────────────────────────────────────────────────
export const CHAT_TOPIC_TASK_HISTORY_UPDATED = "taskHistoryUpdated" as const
export const CHAT_TOPIC_TASK_HISTORY_ITEM_UPDATED = "taskHistoryItemUpdated" as const
export const CHAT_TOPIC_COMMANDS = "commands" as const
export const CHAT_TOPIC_MODES = "modes" as const
// ═══════════════════════════════════════════════════════════════════════════════
// Cloud
// ═══════════════════════════════════════════════════════════════════════════════

export const CLOUD_AUTHENTICATED_USER = "authenticatedUser" as const
export const CLOUD_ORGANIZATION_SWITCH_RESULT = "organizationSwitchResult" as const
export const CLOUD_SHARE_TASK_SUCCESS = "shareTaskSuccess" as const
export const CLOUD_ROO_CREDIT_BALANCE = "rooCreditBalance" as const

// ═══════════════════════════════════════════════════════════════════════════════
// Diagnostics
// ═══════════════════════════════════════════════════════════════════════════════

export const DIAGNOSTICS_DIAGNOSTICS = "diagnostics" as const

// ═══════════════════════════════════════════════════════════════════════════════
// Foundation / Agent State
// ═══════════════════════════════════════════════════════════════════════════════

export const AGENT_STATE_LIST_API_CONFIG = "listApiConfig" as const
export const AGENT_STATE_ROUTER_MODELS = "routerModels" as const
export const AGENT_STATE_OPEN_AI_MODELS = "openAiModels" as const
export const AGENT_STATE_OLLAMA_MODELS = "ollamaModels" as const
export const AGENT_STATE_LM_STUDIO_MODELS = "lmStudioModels" as const
export const AGENT_STATE_VS_CODE_LM_MODELS = "vsCodeLmModels" as const
export const AGENT_STATE_VS_CODE_LM_API_AVAILABLE = "vsCodeLmApiAvailable" as const
export const AGENT_STATE_SINGLE_ROUTER_MODEL_FETCH_RESPONSE = "singleRouterModelFetchResponse" as const

export const AGENT_STATE_DELETE_CUSTOM_MODE_CHECK = "deleteCustomModeCheck" as const
export const AGENT_STATE_EXPORT_MODE_RESULT = "exportModeResult" as const
export const AGENT_STATE_IMPORT_MODE_RESULT = "importModeResult" as const
export const AGENT_STATE_CHECK_RULES_DIRECTORY_RESULT = "checkRulesDirectoryResult" as const
export const AGENT_STATE_CODEBASE_INDEX_CONFIG = "codebaseIndexConfig" as const
export const AGENT_STATE_CODE_INDEX_SETTINGS_SAVED = "codeIndexSettingsSaved" as const
export const AGENT_STATE_CODE_INDEX_SECRET_STATUS = "codeIndexSecretStatus" as const

// ═══════════════════════════════════════════════════════════════════════════════
// Foundation / Window Manager
// ═══════════════════════════════════════════════════════════════════════════════

export const WINDOW_MANAGER_TASK_WITH_AGGREGATED_COSTS = "taskWithAggregatedCosts" as const
export const WINDOW_MANAGER_SHOW_INTERACTIVE_APP = "showInteractiveApp" as const
export const WINDOW_MANAGER_INTERACTION_REQUIRED = "interactionRequired" as const
export const WINDOW_MANAGER_SET_HISTORY_PREVIEW_COLLAPSED = "setHistoryPreviewCollapsed" as const

// ═══════════════════════════════════════════════════════════════════════════════
// Foundation / MST
// ═══════════════════════════════════════════════════════════════════════════════

export const MST_MST_SNAPSHOT_BATCH = "mstSnapshotBatch" as const

// ═══════════════════════════════════════════════════════════════════════════════
// History
// ═══════════════════════════════════════════════════════════════════════════════

export const HISTORY_COMMIT_SEARCH_RESULTS = "commitSearchResults" as const
export const HISTORY_WORKSPACE_UPDATED = "workspaceUpdated" as const

// ═══════════════════════════════════════════════════════════════════════════════
// Marketplace
// ═══════════════════════════════════════════════════════════════════════════════

export const MARKETPLACE_MARKETPLACE_DATA = "marketplaceData" as const
export const MARKETPLACE_MARKETPLACE_REMOVE_RESULT = "marketplaceRemoveResult" as const
export const MARKETPLACE_CUSTOM_TOOLS_RESULT = "customToolsResult" as const
export const MARKETPLACE_SKILLS = "skills" as const

// ═══════════════════════════════════════════════════════════════════════════════
// Settings
// ═══════════════════════════════════════════════════════════════════════════════

export const SETTINGS_MCP_SERVERS = "mcpServers" as const
export const SETTINGS_THEME = "theme" as const
export const SETTINGS_SELECTED_IMAGES = "selectedImages" as const
export const SETTINGS_INVOKE = "invoke" as const
export const SETTINGS_OPEN_AI_CODEX_RATE_LIMITS = "openAiCodexRateLimits" as const
export const SETTINGS_WORKTREE_LIST = "worktreeList" as const
export const SETTINGS_WORKTREE_RESULT = "worktreeResult" as const
export const SETTINGS_WORKTREE_COPY_PROGRESS = "worktreeCopyProgress" as const
export const SETTINGS_BRANCH_LIST = "branchList" as const
export const SETTINGS_WORKTREE_DEFAULTS = "worktreeDefaults" as const
export const SETTINGS_WORKTREE_INCLUDE_STATUS = "worktreeIncludeStatus" as const
export const SETTINGS_BRANCH_WORKTREE_INCLUDE_RESULT = "branchWorktreeIncludeResult" as const
export const SETTINGS_FOLDER_SELECTED = "folderSelected" as const
export const SETTINGS_FILE_CONTENT = "fileContent" as const
export const SETTINGS_FETCH_URL_RESPONSE = "fetchUrlResponse" as const

// ═══════════════════════════════════════════════════════════════════════════════
// Additional WebviewToBackend events (used by ChatStore, tracked in vscode-extension-host.ts)
// ═══════════════════════════════════════════════════════════════════════════════

export const CHAT_NOTIFICATIONS_CANCEL_AUTO_APPROVAL = "cancelAutoApproval" as const
export const CHAT_NOTIFICATIONS_LAST_MESSAGE_SEEN = "lastMessageSeen" as const
export const CHAT_TASK_SET_CHAT_BOX_MESSAGE = "setChatBoxMessage" as const
export const CLOUD_FOLLOW_UP_ANSWERED = "followUpAnswered" as const

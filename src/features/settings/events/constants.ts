/**
 * Settings event key constants.
 *
 * These keys map 1:1 to the event types sent via EventBridge IPC.
 * Naming convention: [Feature]_[Action] in UPPER_SNAKE_CASE.
 */
import { eventConstants } from "@jabberwock/types"

export const SettingsEventKeys = {
	SETTINGS_OPENED: "settings.opened",
	SETTINGS_CHANGED: "settings.changed",
	SETTINGS_UPDATE: "settings.update",
	SETTINGS_ANNOUNCEMENT_SHOWN: "settings.announcement.shown",
	SETTINGS_UPSELLS_DISMISSED_GET: "settings.upsells.dismissed.get",
	SETTINGS_UPSELL_DISMISS: "settings.upsell.dismiss",
	SETTINGS_KEYBOARD_SHORTCUTS_OPEN: "settings.keyboard.shortcuts.open",
	SETTINGS_MARKDOWN_PREVIEW_OPEN: "settings.markdown.preview.open",
	SETTINGS_TELEMETRY_SET: "settings.telemetry.set",
	SETTINGS_TERMINAL_OPERATION_ACTION: "settings.terminal.operation.action",
	SETTINGS_COMMANDS_ALLOWED_SET: "settings.commands.allowed.set",
	SETTINGS_COMMANDS_DENIED_SET: "settings.commands.denied.set",
	SETTINGS_COMMANDS_FILE_OPEN: "settings.commands.file.open",
	SETTINGS_COMMANDS_DELETE: "settings.commands.delete",
	SETTINGS_COMMANDS_CREATE: "settings.commands.create",
	SETTINGS_TEXTAREA_TEXT_INSERT: "settings.textarea.text.insert",
	SETTINGS_OPENAI_CODEX_RATE_LIMITS: "settings.openai.codex.rate.limits",
	SETTINGS_DEBUG_API_HISTORY_OPEN: "settings.debug.api.history.open",
	SETTINGS_DEBUG_UI_HISTORY_OPEN: "settings.debug.ui.history.open",
	SETTINGS_DIAGNOSTICS_DOWNLOAD: "settings.diagnostics.download",
	SETTINGS_API_CONFIG_SAVE: "settings.api.config.save",
	SETTINGS_API_CONFIG_DELETE: "settings.api.config.delete",
	SETTINGS_CODE_INDEX_SET: "settings.code.index.set",
	SETTINGS_FILES_CONFIG_SAVE: "settings.files.config.save",
	SETTINGS_MCP_SAVE: "settings.mcp.save",
	SETTINGS_AGENTS_SAVE: "settings.agents.save",
	SETTINGS_MODELS_SAVE: "settings.models.save",
	SETTINGS_CONTEXT_SAVE: "settings.context.save",
	SETTINGS_SKILLS_SAVE: "settings.skills.save",
	SETTINGS_VSCODE_SAVE: "settings.vscode.save",
	SETTINGS_WEBVIEW_SAVE: "settings.webview.save",
	SETTINGS_WORKTREE_SAVE: "settings.worktree.save",

	// ── Settings — Ignore ─────────────────────────────────────
	IGNORE_RELOAD_REQUESTED: "ignore.reload.requested",
	IGNORE_STATUS_CHANGED: "ignore.status.changed",

	// ── Settings — Protect ────────────────────────────────────
	PROTECT_STATUS_REQUESTED: "protect.status.requested",
	PROTECT_FILE_CHECKED: "protect.file.checked",

	MODE_SWITCH_REQUESTED: "mode.switch.requested",
} as const

/**
 * Ignore rules event keys — derived from SettingsEventKeys.
 */
export const IgnoreEventKeys = {
	IGNORE_RELOAD_REQUESTED: SettingsEventKeys.IGNORE_RELOAD_REQUESTED,
	IGNORE_STATUS_CHANGED: SettingsEventKeys.IGNORE_STATUS_CHANGED,
} as const

export type IgnoreEventKeys = (typeof IgnoreEventKeys)[keyof typeof IgnoreEventKeys]

/**
 * File protection event keys — derived from SettingsEventKeys.
 */
export const ProtectEventKeys = {
	PROTECT_STATUS_REQUESTED: SettingsEventKeys.PROTECT_STATUS_REQUESTED,
	PROTECT_FILE_CHECKED: SettingsEventKeys.PROTECT_FILE_CHECKED,
} as const

export type ProtectEventKeys = (typeof ProtectEventKeys)[keyof typeof ProtectEventKeys]

/**
 * Flat IPC message type constants matching packages/types/src/event-constants.ts.
 * These are the actual string values used in vscode.postMessage({ type: ... }).
 * Values sourced from the single source of truth in @jabberwock/types.
 */

// ── Settings — Core ─────────────────────────────────────────
export const SETTINGS_UPDATE_SETTINGS = eventConstants.SETTINGS.UPDATE_SETTINGS
export const SETTINGS_DID_SHOW_ANNOUNCEMENT = eventConstants.SETTINGS.DID_SHOW_ANNOUNCEMENT
export const SETTINGS_GET_DISMISSED_UPSELLS = eventConstants.SETTINGS.GET_DISMISSED_UPSELLS
export const SETTINGS_DISMISS_UPSELL = eventConstants.SETTINGS.DISMISS_UPSELL
export const SETTINGS_OPEN_KEYBOARD_SHORTCUTS = eventConstants.SETTINGS.OPEN_KEYBOARD_SHORTCUTS
export const SETTINGS_OPEN_MARKDOWN_PREVIEW = eventConstants.SETTINGS.OPEN_MARKDOWN_PREVIEW
export const SETTINGS_TELEMETRY_SETTING = eventConstants.SETTINGS.TELEMETRY_SETTING
export const SETTINGS_TERMINAL_OPERATION = eventConstants.SETTINGS.TERMINAL_OPERATION
export const SETTINGS_SHOW_MDM_AUTH_REQUIRED_NOTIFICATION = eventConstants.SETTINGS.SHOW_MDM_AUTH_REQUIRED_NOTIFICATION
export const SETTINGS_ALLOWED_COMMANDS = eventConstants.SETTINGS.ALLOWED_COMMANDS
export const SETTINGS_DENIED_COMMANDS = eventConstants.SETTINGS.DENIED_COMMANDS
export const SETTINGS_OPEN_COMMAND_FILE = eventConstants.SETTINGS.OPEN_COMMAND_FILE
export const SETTINGS_DELETE_COMMAND = eventConstants.SETTINGS.DELETE_COMMAND
export const SETTINGS_CREATE_COMMAND = eventConstants.SETTINGS.CREATE_COMMAND
export const SETTINGS_INSERT_TEXT_INTO_TEXTAREA = eventConstants.SETTINGS.INSERT_TEXT_INTO_TEXTAREA
export const SETTINGS_REQUEST_OPEN_AI_CODEX_RATE_LIMITS = eventConstants.SETTINGS.REQUEST_OPEN_AI_CODEX_RATE_LIMITS
export const SETTINGS_OPEN_DEBUG_API_HISTORY = eventConstants.SETTINGS.OPEN_DEBUG_API_HISTORY
export const SETTINGS_OPEN_DEBUG_UI_HISTORY = eventConstants.SETTINGS.OPEN_DEBUG_UI_HISTORY
export const SETTINGS_TOGGLE_API_CONFIG_PIN = eventConstants.SETTINGS.TOGGLE_API_CONFIG_PIN
export const SETTINGS_SET_API_CONFIG_PASSWORD = eventConstants.SETTINGS.SET_API_CONFIG_PASSWORD
export const SETTINGS_REQUEST_MODES = eventConstants.SETTINGS.REQUEST_MODES
export const SETTINGS_DEVTOOL_STATUS = eventConstants.SETTINGS.DEVTOOL_STATUS
export const SETTINGS_WEBVIEW_LOG = eventConstants.SETTINGS.WEBVIEW_LOG
export const SETTINGS_DOM_RESPONSE = eventConstants.SETTINGS.DOM_RESPONSE
export const SETTINGS_WEBVIEW_ERROR = eventConstants.SETTINGS.WEBVIEW_ERROR
export const SETTINGS_FETCH_URL = eventConstants.SETTINGS.FETCH_URL
export const SETTINGS_LOCATOR_OPEN_FILE = eventConstants.SETTINGS.LOCATOR_OPEN_FILE
export const SETTINGS_LOCATOR_TARGET = eventConstants.SETTINGS.LOCATOR_TARGET
export const SETTINGS_IMAGE_GENERATION_SETTINGS = eventConstants.SETTINGS.IMAGE_GENERATION_SETTINGS

// ── Settings — Files ────────────────────────────────────────
export const SETTINGS_OPEN_IMAGE = eventConstants.SETTINGS.OPEN_IMAGE
export const SETTINGS_SAVE_IMAGE = eventConstants.SETTINGS.SAVE_IMAGE
export const SETTINGS_OPEN_FILE = eventConstants.SETTINGS.OPEN_FILE
export const SETTINGS_READ_FILE_CONTENT = eventConstants.SETTINGS.READ_FILE_CONTENT
export const SETTINGS_OPEN_EXTERNAL = eventConstants.SETTINGS.OPEN_EXTERNAL
export const SETTINGS_OPEN_MENTION = eventConstants.SETTINGS.OPEN_MENTION

// ── Settings — MCP ──────────────────────────────────────────
export const SETTINGS_OPEN_MCP_SETTINGS = eventConstants.SETTINGS.OPEN_MCP_SETTINGS
export const SETTINGS_OPEN_PROJECT_MCP_SETTINGS = eventConstants.SETTINGS.OPEN_PROJECT_MCP_SETTINGS
export const SETTINGS_DELETE_MCP_SERVER = eventConstants.SETTINGS.DELETE_MCP_SERVER
export const SETTINGS_RESTART_MCP_SERVER = eventConstants.SETTINGS.RESTART_MCP_SERVER
export const SETTINGS_TOGGLE_TOOL_ALWAYS_ALLOW = eventConstants.SETTINGS.TOGGLE_TOOL_ALWAYS_ALLOW
export const SETTINGS_TOGGLE_TOOL_ENABLED_FOR_PROMPT = eventConstants.SETTINGS.TOGGLE_TOOL_ENABLED_FOR_PROMPT
export const SETTINGS_TOGGLE_MCP_SERVER = eventConstants.SETTINGS.TOGGLE_MCP_SERVER
export const SETTINGS_UPDATE_MCP_TIMEOUT = eventConstants.SETTINGS.UPDATE_MCP_TIMEOUT
export const SETTINGS_REFRESH_ALL_MCP_SERVERS = eventConstants.SETTINGS.REFRESH_ALL_MCP_SERVERS

// ── Settings — Worktree ──────────────────────────────────
export const SETTINGS_LIST_WORKTREES = eventConstants.SETTINGS.LIST_WORKTREES
export const SETTINGS_CREATE_WORKTREE = eventConstants.SETTINGS.CREATE_WORKTREE
export const SETTINGS_DELETE_WORKTREE = eventConstants.SETTINGS.DELETE_WORKTREE
export const SETTINGS_SWITCH_WORKTREE = eventConstants.SETTINGS.SWITCH_WORKTREE
export const SETTINGS_GET_AVAILABLE_BRANCHES = eventConstants.SETTINGS.GET_AVAILABLE_BRANCHES
export const SETTINGS_GET_WORKTREE_DEFAULTS = eventConstants.SETTINGS.GET_WORKTREE_DEFAULTS
export const SETTINGS_GET_WORKTREE_INCLUDE_STATUS = eventConstants.SETTINGS.GET_WORKTREE_INCLUDE_STATUS
export const SETTINGS_CHECK_BRANCH_WORKTREE_INCLUDE = eventConstants.SETTINGS.CHECK_BRANCH_WORKTREE_INCLUDE
export const SETTINGS_CREATE_WORKTREE_INCLUDE = eventConstants.SETTINGS.CREATE_WORKTREE_INCLUDE
export const SETTINGS_CHECKOUT_BRANCH = eventConstants.SETTINGS.CHECKOUT_BRANCH
export const SETTINGS_BROWSE_FOR_WORKTREE_PATH = eventConstants.SETTINGS.BROWSE_FOR_WORKTREE_PATH

// ── Diagnostics ─────────────────────────────────────────────
export const DIAGNOSTICS_CLEAR_DIAGNOSTICS = eventConstants.DIAGNOSTICS.CLEAR_DIAGNOSTICS
export const DIAGNOSTICS_DOWNLOAD_ERROR_DIAGNOSTICS = eventConstants.DIAGNOSTICS.DOWNLOAD_ERROR_DIAGNOSTICS

// ── Agent State — API Config ────────────────────────────────
export const AGENT_STATE_SAVE_API_CONFIGURATION = eventConstants.AGENT_STATE.SAVE_API_CONFIGURATION
export const AGENT_STATE_UPSERT_API_CONFIGURATION = eventConstants.AGENT_STATE.UPSERT_API_CONFIGURATION
export const AGENT_STATE_RENAME_API_CONFIGURATION = eventConstants.AGENT_STATE.RENAME_API_CONFIGURATION
export const AGENT_STATE_DELETE_API_CONFIGURATION = eventConstants.AGENT_STATE.DELETE_API_CONFIGURATION
export const AGENT_STATE_LOAD_API_CONFIGURATION = eventConstants.AGENT_STATE.LOAD_API_CONFIGURATION
export const AGENT_STATE_LOAD_API_CONFIGURATION_BY_ID = eventConstants.AGENT_STATE.LOAD_API_CONFIGURATION_BY_ID
export const AGENT_STATE_GET_LIST_API_CONFIGURATION = eventConstants.AGENT_STATE.GET_LIST_API_CONFIGURATION
export const AGENT_STATE_LOCK_API_CONFIG_ACROSS_MODES = eventConstants.AGENT_STATE.LOCK_API_CONFIG_ACROSS_MODES
export const AGENT_STATE_ENHANCEMENT_API_CONFIG_ID = eventConstants.AGENT_STATE.ENHANCEMENT_API_CONFIG_ID

// ── Agent State — Code Index ────────────────────────────────
export const AGENT_STATE_SAVE_CODE_INDEX_SETTINGS_ATOMIC = eventConstants.AGENT_STATE.SAVE_CODE_INDEX_SETTINGS_ATOMIC
export const AGENT_STATE_REQUEST_INDEXING_STATUS = eventConstants.AGENT_STATE.REQUEST_INDEXING_STATUS
export const AGENT_STATE_REQUEST_CODE_INDEX_SECRET_STATUS = eventConstants.AGENT_STATE.REQUEST_CODE_INDEX_SECRET_STATUS
export const AGENT_STATE_START_INDEXING = eventConstants.AGENT_STATE.START_INDEXING
export const AGENT_STATE_STOP_INDEXING = eventConstants.AGENT_STATE.STOP_INDEXING
export const AGENT_STATE_TOGGLE_WORKSPACE_INDEXING = eventConstants.AGENT_STATE.TOGGLE_WORKSPACE_INDEXING
export const AGENT_STATE_SET_AUTO_ENABLE_DEFAULT = eventConstants.AGENT_STATE.SET_AUTO_ENABLE_DEFAULT
export const AGENT_STATE_CLEAR_INDEX_DATA = eventConstants.AGENT_STATE.CLEAR_INDEX_DATA

// ── Agent State — Agents / Modes ────────────────────────────
export const AGENT_STATE_UPDATE_CUSTOM_MODE = eventConstants.AGENT_STATE.UPDATE_CUSTOM_MODE
export const AGENT_STATE_DELETE_CUSTOM_MODE = eventConstants.AGENT_STATE.DELETE_CUSTOM_MODE
export const AGENT_STATE_EXPORT_MODE = eventConstants.AGENT_STATE.EXPORT_MODE
export const AGENT_STATE_IMPORT_MODE = eventConstants.AGENT_STATE.IMPORT_MODE
export const AGENT_STATE_CHECK_RULES_DIRECTORY = eventConstants.AGENT_STATE.CHECK_RULES_DIRECTORY
export const AGENT_STATE_HAS_OPENED_MODE_SELECTOR = eventConstants.AGENT_STATE.HAS_OPENED_MODE_SELECTOR
export const AGENT_STATE_OPEN_CUSTOM_MODES_SETTINGS = eventConstants.AGENT_STATE.OPEN_CUSTOM_MODES_SETTINGS

// ── Agent State — Models ────────────────────────────────────
export const AGENT_STATE_REQUEST_ROUTER_MODELS = eventConstants.AGENT_STATE.REQUEST_ROUTER_MODELS
export const AGENT_STATE_REQUEST_OPEN_AI_MODELS = eventConstants.AGENT_STATE.REQUEST_OPEN_AI_MODELS
export const AGENT_STATE_REQUEST_OLLAMA_MODELS = eventConstants.AGENT_STATE.REQUEST_OLLAMA_MODELS
export const AGENT_STATE_REQUEST_LM_STUDIO_MODELS = eventConstants.AGENT_STATE.REQUEST_LM_STUDIO_MODELS
export const AGENT_STATE_REQUEST_ROO_MODELS = eventConstants.AGENT_STATE.REQUEST_ROO_MODELS
export const AGENT_STATE_REQUEST_ROO_CREDIT_BALANCE = eventConstants.AGENT_STATE.REQUEST_ROO_CREDIT_BALANCE
export const AGENT_STATE_REQUEST_VS_CODE_LM_MODELS = eventConstants.AGENT_STATE.REQUEST_VS_CODE_LM_MODELS
export const AGENT_STATE_FLUSH_ROUTER_MODELS = eventConstants.AGENT_STATE.FLUSH_ROUTER_MODELS

// ── Agent State — Prompts ───────────────────────────────────
export const AGENT_STATE_UPDATE_PROMPT = eventConstants.AGENT_STATE.UPDATE_PROMPT
export const AGENT_STATE_UPDATE_SYSTEM_PROMPT_TEMPLATE = eventConstants.AGENT_STATE.UPDATE_SYSTEM_PROMPT_TEMPLATE
export const AGENT_STATE_GET_SYSTEM_PROMPT = eventConstants.AGENT_STATE.GET_SYSTEM_PROMPT
export const AGENT_STATE_COPY_SYSTEM_PROMPT = eventConstants.AGENT_STATE.COPY_SYSTEM_PROMPT
export const AGENT_STATE_CUSTOM_INSTRUCTIONS = eventConstants.AGENT_STATE.CUSTOM_INSTRUCTIONS

// ── Agent State — VSCode ────────────────────────────────────
export const AGENT_STATE_UPDATE_VS_CODE_SETTING = eventConstants.AGENT_STATE.UPDATE_VS_CODE_SETTING
export const AGENT_STATE_GET_VS_CODE_SETTING = eventConstants.AGENT_STATE.GET_VS_CODE_SETTING
export const AGENT_STATE_AUTO_APPROVAL_ENABLED = eventConstants.AGENT_STATE.AUTO_APPROVAL_ENABLED
export const AGENT_STATE_DEBUG_SETTING = eventConstants.AGENT_STATE.DEBUG_SETTING

export type SettingsEventKeys = (typeof SettingsEventKeys)[keyof typeof SettingsEventKeys]

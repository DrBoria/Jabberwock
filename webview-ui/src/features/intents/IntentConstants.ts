/**
 * Frontend Intent Constants — shared IntentType + frontend-specific extensions.
 *
 * Frontend-only intent types include UI-interaction intents that are
 * dispatched on the webview side and never cross the IPC boundary.
 *
 * Usage:
 *   import { FrontendIntentType, IntentConstants } from "@intentConstants"
 *   bus.register(IntentConstants.chat.ASK_RESPONSE_RECEIVED, handler)
 *   bus.register(FrontendIntentType.SomeUiIntent, handler)
 */
import { IntentType } from "@jabberwock/types"

/**
 * IntentConstants — structured namespace for intent type constants.
 * Groups intents by feature area for type-safe dispatch.
 *
 * These are intents that the FRONTEND bus handles — they represent
 * events arriving FROM the backend (via EventBridge handlers) or
 * purely frontend-side UI interactions.
 *
 * Usage:
 *   import { IntentConstants } from "@intentConstants"
 *   bus.register(IntentConstants.chat.ASK_RESPONSE_RECEIVED, handler)
 *
 * NOTE: Also includes backend intent groups (messages, notifications, fileContext)
 * and BackendIntentType export to satisfy transitive type-checking of backend
 * files pulled in via @shared/* includes.
 */
export const IntentConstants = {
	chat: {
		ASK_RESPONSE_RECEIVED: "chat.ask.response.received",
		CHAT_TREE_SNAPSHOT_RECEIVED: "chat.tree.snapshot.received",
		CHAT_TREE_PATCH_RECEIVED: "chat.tree.patch.received",
		MESSAGE_UPDATED: "chat.message.updated",
		MESSAGE_DISPLAY: "chat.message.display",
		INVOKE_RECEIVED: "chat.invoke.received",
		INTERACTION_REQUIRED: "chat.interaction.required",
	},
	task: {
		STATE_RECEIVED: "task.state.received",
		ACTION_RECEIVED: "task.action.received",
		MESSAGES_UPDATED: "task.messages.updated",
		CHECKPOINT_UPDATED: "task.checkpoint.updated",
		CHECKPOINT_INIT_WARNING: "task.checkpoint.init.warning",
		TASK_WITH_AGGREGATED_COSTS: "task.with.aggregated.costs",
		CONDENSE_STARTED: "task.condense.started",
		CONDENSE_RESPONSE: "task.condense.response",
		SELECTED_IMAGES: "task.selected.images",
	},
	settings: {
		THEME_UPDATED: "settings.theme.updated",
		CONFIG_UPDATED: "settings.config.updated",
		LIST_API_CONFIG: "settings.list.api.config",
		ROUTER_MODELS: "settings.router.models",
		MCP_SERVERS: "settings.mcp.servers",
		SKILLS: "settings.skills",
	},
	api: {
		STREAMING_STARTED: "api.streaming.started",
		STREAMING_ENDED: "api.streaming.ended",
	},
	foundation: {
		SHOW_INTERACTIVE_APP: "foundation.show.interactive.app",
		WORKSPACE_UPDATED: "foundation.workspace.updated",
		COMMANDS_UPDATED: "foundation.commands.updated",
	},
	history: {
		UPDATED: "history.updated",
		ITEM_UPDATED: "history.item.updated",
	},
	diagnostics: {
		RECEIVED: "diagnostics.received",
	},
	marketplace: {
		DATA_RECEIVED: "marketplace.data.received",
	},
	cloud: {
		AUTH_CHANGED: "cloud.auth.changed",
	},

	// ── Messages (backend — for transitive compilation) ──────────────
	messages: {
		AGENT_BROADCAST: "message.agent.broadcast",
		SYSTEM_BROADCAST: "message.system.broadcast",
		MCP_BROADCAST: "message.mcp.broadcast",
		USER_BROADCAST: "message.user.broadcast",
	},

	// ── Notifications (backend — for transitive compilation) ──────────
	notifications: {
		ASK_TOOL_APPROVAL: "notification.ask.tool_approval",
		ASK_FOLLOW_UP: "notification.ask.follow_up",
		ASK_SUB_TASK: "notification.ask.sub_task",
		LOG_WRITE: "log.write",
	},

	// ── File Context (backend — for transitive compilation) ───────────
	fileContext: {
		FILE_CONTEXT_TRACKED: "file.context.tracked",
	},
} as const

/**
 * Union type for IntentConstants values.
 */
export type IntentConstantsValue =
	(typeof IntentConstants)[keyof typeof IntentConstants][keyof (typeof IntentConstants)[keyof typeof IntentConstants]]

/**
 * All intent type constants available on the frontend.
 * Spreads the shared IntentType from @jabberwock/types and adds
 * frontend-specific types.
 *
 * Note: FrontendIntentType includes ALL string constants — both shared
 * IntentType values AND frontend-specific ones. IntentConstants values
 * are duplicated here for flat lookup compatibility.
 */
export const FrontendIntentType = {
	...IntentType,

	// ── Chat Operations (frontend-specific) ──────────────────────────
	ChatAskResponseReceived: IntentConstants.chat.ASK_RESPONSE_RECEIVED,
	ChatTreeSnapshotReceived: IntentConstants.chat.CHAT_TREE_SNAPSHOT_RECEIVED,
	ChatTreePatchReceived: IntentConstants.chat.CHAT_TREE_PATCH_RECEIVED,
	ChatMessageUpdated: IntentConstants.chat.MESSAGE_UPDATED,
	ChatMessageDisplay: IntentConstants.chat.MESSAGE_DISPLAY,
	ChatInvokeReceived: IntentConstants.chat.INVOKE_RECEIVED,
	ChatInteractionRequired: IntentConstants.chat.INTERACTION_REQUIRED,

	// ── Task Operations (frontend-specific) ──────────────────────────
	TaskStateReceived: IntentConstants.task.STATE_RECEIVED,
	TaskActionReceived: IntentConstants.task.ACTION_RECEIVED,
	TaskMessagesUpdated: IntentConstants.task.MESSAGES_UPDATED,
	TaskCheckpointUpdated: IntentConstants.task.CHECKPOINT_UPDATED,
	TaskCheckpointInitWarning: IntentConstants.task.CHECKPOINT_INIT_WARNING,
	TaskWithAggregatedCosts: IntentConstants.task.TASK_WITH_AGGREGATED_COSTS,
	TaskCondenseStarted: IntentConstants.task.CONDENSE_STARTED,
	TaskCondenseResponse: IntentConstants.task.CONDENSE_RESPONSE,
	TaskSelectedImages: IntentConstants.task.SELECTED_IMAGES,

	// ── Settings Operations (frontend-specific) ──────────────────────
	SettingsThemeUpdated: IntentConstants.settings.THEME_UPDATED,
	SettingsConfigUpdated: IntentConstants.settings.CONFIG_UPDATED,
	SettingsListApiConfig: IntentConstants.settings.LIST_API_CONFIG,
	SettingsRouterModels: IntentConstants.settings.ROUTER_MODELS,
	SettingsMcpServers: IntentConstants.settings.MCP_SERVERS,
	SettingsSkills: IntentConstants.settings.SKILLS,

	// ── API / Stream Operations (frontend-specific) ──────────────────
	ApiStreamingStarted: IntentConstants.api.STREAMING_STARTED,
	ApiStreamingEnded: IntentConstants.api.STREAMING_ENDED,

	// ── Foundation Operations (frontend-specific) ────────────────────
	FoundationShowInteractiveApp: IntentConstants.foundation.SHOW_INTERACTIVE_APP,
	FoundationWorkspaceUpdated: IntentConstants.foundation.WORKSPACE_UPDATED,
	FoundationCommandsUpdated: IntentConstants.foundation.COMMANDS_UPDATED,

	// ── History Operations (frontend-specific) ───────────────────────
	HistoryUpdated: IntentConstants.history.UPDATED,
	HistoryItemUpdated: IntentConstants.history.ITEM_UPDATED,

	// ── Diagnostics Operations (frontend-specific) ───────────────────
	DiagnosticsReceived: IntentConstants.diagnostics.RECEIVED,

	// ── Marketplace Operations (frontend-specific) ───────────────────
	MarketplaceDataReceived: IntentConstants.marketplace.DATA_RECEIVED,

	// ── Cloud Operations (frontend-specific) ─────────────────────────
	CloudAuthChanged: IntentConstants.cloud.AUTH_CHANGED,
} as const

/**
 * Union type of all frontend intent type string values.
 */
export type FrontendIntentType = (typeof FrontendIntentType)[keyof typeof FrontendIntentType]

/**
 * BackendIntentType — backend flat intent constant lookup.
 * Mirrors the backend BackendIntentType for transitive type-checking
 * of backend files compiled under webview-ui/tsconfig.
 *
 * Usage:
 *   import { BackendIntentType } from "@intentConstants"
 *   bus.register(BackendIntentType.AgentRequestFailed, handler)
 */
export const BackendIntentType = {
	...IntentType,

	// ── Stream Operations (backend-only) ─────────────────────────────
	StreamStart: IntentConstants.api.STREAMING_STARTED,
	StreamEnd: IntentConstants.api.STREAMING_ENDED,
	StreamChunkReceived: "api.streaming.chunk.received",
	StreamError: "api.streaming.error",

	// ── Message Broadcasts ──────────────────────────────────────────
	MessageAgentBroadcast: IntentConstants.messages.AGENT_BROADCAST,
	MessageSystemBroadcast: IntentConstants.messages.SYSTEM_BROADCAST,
	MessageMcpBroadcast: IntentConstants.messages.MCP_BROADCAST,
	MessageUserBroadcast: IntentConstants.messages.USER_BROADCAST,

	// ── Notification Ask Broadcasts ──────────────────────────────────
	NotificationAskToolApproval: IntentConstants.notifications.ASK_TOOL_APPROVAL,
	NotificationAskFollowUp: IntentConstants.notifications.ASK_FOLLOW_UP,
	NotificationAskSubTask: IntentConstants.notifications.ASK_SUB_TASK,

	// ── File Context ────────────────────────────────────────────────
	FileContextTracked: IntentConstants.fileContext.FILE_CONTEXT_TRACKED,

	// ── Agent Operations ────────────────────────────────────────────
	AgentRequestFailed: "agent.request.failed",

	// ── MCP Operations ──────────────────────────────────────────────
	McpToolResult: "mcp.tool.result",

	// ── Settings Operations ─────────────────────────────────────────
	SettingsChanged: "settings.changed",
	SettingsOpened: "settings.opened",
} as const

/**
 * Union type of all backend intent type string values.
 */
export type BackendIntentType = (typeof BackendIntentType)[keyof typeof BackendIntentType]

/**
 * Frontend-specific intent priority map.
 *
 * Lower number = higher priority. Critical (0) preempts any running fiber.
 */
export const IntentPriority = {
	Critical: 0,
	High: 1,
	Normal: 2,
	Low: 3,
} as const

export type IntentPriority = (typeof IntentPriority)[keyof typeof IntentPriority]

export const INTENT_PRIORITY: Record<string, IntentPriority> = {
	"task.cancel.requested": IntentPriority.Critical,
	"system.failure": IntentPriority.Critical,
	"user.message.received": IntentPriority.High,
	"chat.ask.response.received": IntentPriority.High,
	"webview.event": IntentPriority.High,
	"message.agent.broadcast": IntentPriority.Normal,
	"message.system.broadcast": IntentPriority.Normal,
	"message.mcp.broadcast": IntentPriority.Normal,
	"message.user.broadcast": IntentPriority.Normal,
	"notification.ask.tool_approval": IntentPriority.Normal,
	"notification.ask.follow_up": IntentPriority.Normal,
	"notification.ask.sub_task": IntentPriority.Normal,
	"notification.persist": IntentPriority.Normal,
	"api.streaming.started": IntentPriority.Normal,
	"api.streaming.ended": IntentPriority.Normal,
	"file.context.tracked": IntentPriority.Normal,
	"log.write": IntentPriority.Low,
	"agent.request.failed": IntentPriority.Low,
	"mcp.tool.result": IntentPriority.Low,
}

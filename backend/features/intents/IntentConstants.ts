/**
 * Backend Intent Constants — shared IntentType + backend-specific extensions.
 *
 * Backend-only intent types include stream-related operations that are
 * handled exclusively on the extension-host side, never crossing the IPC.
 *
 * Usage:
 *   import { IntentConstants, BackendIntentType } from "@intentConstants"
 *   bus.register(IntentConstants.api.STREAMING_STARTED, handler)
 */
import { IntentType } from "@jabberwock/types"

/**
 * IntentConstants — structured namespace for intent type constants.
 * Groups intents by feature area for type-safe dispatch.
 *
 * Usage:
 *   import { IntentConstants } from "@intentConstants"
 *   intentStore.createIntent({ type: IntentConstants.api.STREAMING_STARTED })
 */
export const IntentConstants = {
	api: {
		STREAMING_STARTED: "api.streaming.started",
		STREAMING_ENDED: "api.streaming.ended",
	},
	fileContext: {
		FILE_CONTEXT_TRACKED: "file.context.tracked",
	},
	messages: {
		AGENT_BROADCAST: "message.agent.broadcast",
		SYSTEM_BROADCAST: "message.system.broadcast",
		MCP_BROADCAST: "message.mcp.broadcast",
		USER_BROADCAST: "message.user.broadcast",
	},
	notifications: {
		ASK_TOOL_APPROVAL: "notification.ask.tool_approval",
		ASK_FOLLOW_UP: "notification.ask.follow_up",
		ASK_SUB_TASK: "notification.ask.sub_task",
		LOG_WRITE: "log.write",
	},
} as const

/**
 * Union type for IntentConstants values.
 */
export type IntentConstantsValue =
	(typeof IntentConstants)[keyof typeof IntentConstants][keyof (typeof IntentConstants)[keyof typeof IntentConstants]]

/**
 * All intent type constants available on the backend.
 * Spreads the shared IntentType from @jabberwock/types and adds
 * backend-specific types.
 *
 * Note: BackendIntentType includes ALL string constants — both shared
 * IntentType values AND backend-specific ones. IntentConstants.api values
 * are duplicated here for flat lookup compatibility.
 */
export const BackendIntentType = {
	...IntentType,

	// ── Stream Operations (backend-only) ─────────────────────────────
	StreamStart: IntentConstants.api.STREAMING_STARTED,
	StreamEnd: IntentConstants.api.STREAMING_ENDED,
	StreamChunkReceived: "api.streaming.chunk.received", // Legacy — kept for existing handlers
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
	"ask.response.received": IntentPriority.High,
	"tool.execution.required": IntentPriority.High,
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

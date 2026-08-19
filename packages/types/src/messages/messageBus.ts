/**
 * Message Bus — shared types + constants for backend↔webview communication.
 *
 * Channel naming convention:
 *   feature_function                    (1 level)  — standalone features
 *   feature:feature_function            (2 levels) — nested sub-feature
 *   feature:feature:feature_function    (3 levels) — deep nesting
 *
 * This is a NEW layer that runs alongside the existing postMessage system.
 * Features migrate to bus.on() handlers gradually.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CHANNEL CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const CHANNEL = {
	// === feature_function (1 уровень) ===
	SETTINGS_UPDATED: "settings_updated" as const,
	MODE_SWITCHED: "mode_switched" as const,

	// === feature:feature_function (2 уровня) ===
	CHAT_TASK_INITIATED: "chat:task:initiated" as const,
	CHAT_TASK_COMPLETED: "chat:task:completed" as const,
	CHAT_MESSAGE_UPDATED: "chat:messages_list:updated" as const,
	SETTINGS_API_CONFIG_UPSERTED: "settings:api_config_upserted" as const,
	SETTINGS_MCP_SERVER_TOGGLED: "settings:mcp_server_toggled" as const,

	// === feature:feature:feature_function (3 уровня) ===
	CHAT_NOTIFICATIONS_ASK: "chat:notifications:ask" as const,
	CHAT_NOTIFICATIONS_ASK_RESPONSE: "chat:notifications:ask_response" as const,
	CHAT_NOTIFICATIONS_SAY: "chat:notifications:say" as const,
	CHAT_NOTIFICATIONS_API_REQ: "chat:notifications:api_req" as const,
	CHAT_NOTIFICATIONS_API_RES: "chat:notifications:api_res" as const,
	FOUNDATION_WINDOW_SWITCH_TAB: "foundation:window:switch_tab" as const,
	FOUNDATION_WINDOW_ACTIVE_PAGE: "foundation:window:active_page" as const,
	FOUNDATION_WINDOW_STATE_PUSH: "foundation:window:state_push" as const,
	HISTORY_TASK_DELETED: "history:task_deleted" as const,
	HISTORY_TASK_EXPORTED: "history:task_exported" as const,
} as const

export type Channel = (typeof CHANNEL)[keyof typeof CHANNEL]

// ═══════════════════════════════════════════════════════════════════════════════
// APP MESSAGE
// ═══════════════════════════════════════════════════════════════════════════════

export interface AppMessage {
	channel: Channel
	payload: unknown
	source: "backend" | "webview"
	timestamp: number
	id: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE BUS INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

export interface MessageBus {
	/** Send a message over the bus */
	send(msg: AppMessage): void
	/** Register a handler for a channel. Returns unsubscribe function. */
	on(channel: Channel, handler: (msg: AppMessage) => void): () => void
	/** Register a middleware that intercepts all messages */
	use(middleware: (msg: AppMessage, next: () => void) => void): void
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

let _messageIdCounter = 0

export function createAppMessage(channel: Channel, payload: unknown, source: "backend" | "webview"): AppMessage {
	return {
		channel,
		payload,
		source,
		timestamp: Date.now(),
		id: `msg_${Date.now()}_${++_messageIdCounter}`,
	}
}

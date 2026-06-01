/**
 * Chat event key constants.
 *
 * These keys map 1:1 to the event types sent via EventBridge IPC.
 * Naming convention: [Feature]_[Action] in UPPER_SNAKE_CASE.
 */
import { eventConstants } from "@jabberwock/types"

export const ChatEventKeys = {
	// ── Chat / Text Area ──────────────────────────────────────────
	TEXTAREA_ENHANCE_REQUESTED: "textarea.enhance.requested",
	TEXTAREA_IMAGES_SELECT_REQUESTED: "textarea.images.select.requested",
	TEXTAREA_FILES_SEARCH_REQUESTED: "textarea.files.search.requested",
	TEXTAREA_IMAGES_DRAGGED: "textarea.images.dragged",

	// ── Chat / Topic ──────────────────────────────────────────────
	TOPIC_MODE_SWITCH_REQUESTED: "topic.mode.switch.requested",
	TOPIC_COMMANDS_REQUESTED: "topic.commands.requested",
	TOPIC_TODOLIST_UPDATE: "topic.todolist.update",

	// ── Chat / Task ───────────────────────────────────────────────
	TASK_NEW_REQUESTED: "task.new.requested",
	TASK_CANCEL_REQUESTED: "task.cancel.requested",
	TASK_CLEAR_REQUESTED: "task.clear.requested",
	TASK_SYNC_ENABLED_SET: "task.sync.enabled.set",
	TASK_CONDENSE_CONTEXT_REQUESTED: "task.condense.context.requested",
	TASK_WEBVIEW_LAUNCHED: "task.webview.launched",

	// ── Chat / Notifications ──────────────────────────────────────
	NOTIFICATION_CHECKPOINT_DIFF_REQUESTED: "notification.checkpoint.diff.requested",
	NOTIFICATION_CHECKPOINT_RESTORE_REQUESTED: "notification.checkpoint.restore.requested",
	NOTIFICATION_TTS_PLAY: "notification.tts.play",
	NOTIFICATION_TTS_STOP: "notification.tts.stop",
	NOTIFICATION_TTS_ENABLED_SET: "notification.tts.enabled.set",
	NOTIFICATION_TTS_SPEED_SET: "notification.tts.speed.set",
	NOTIFICATION_MESSAGE_QUEUE: "notification.message.queue",
	NOTIFICATION_MESSAGE_QUEUE_EDIT: "notification.message.queue.edit",
	NOTIFICATION_MESSAGE_QUEUE_REMOVE: "notification.message.queue.remove",
	NOTIFICATION_ELICITATION_RESPONSE: "notification.elicitation.response",

	// ── Chat / Messages List ──────────────────────────────────────
	MESSAGES_ASK_RESPONSE_RECEIVED: "ask.response.received",
	MESSAGES_DELETE_REQUESTED: "message.delete.requested",
	MESSAGES_DELETE_CONFIRMED: "message.delete.confirmed",
	MESSAGES_EDIT_REQUESTED: "message.edit.requested",
	MESSAGES_EDIT_CONFIRMED: "message.edit.confirmed",
} as const

/**
 * Flat IPC message type constants matching packages/types/src/event-constants.ts.
 * These are the actual string values used in vscode.postMessage({ type: ... }).
 * Values sourced from the single source of truth in @jabberwock/types.
 */

// ── Chat / Text Area ────────────────────────────────────────
export const CHAT_TEXT_AREA_ENHANCE_PROMPT = eventConstants.CHAT.TEXT_AREA.ENHANCE_PROMPT
export const CHAT_TEXT_AREA_DRAGGED_IMAGES = eventConstants.CHAT.TEXT_AREA.DRAGGED_IMAGES
export const CHAT_TEXT_AREA_SELECT_IMAGES = eventConstants.CHAT.TEXT_AREA.SELECT_IMAGES
export const CHAT_TEXT_AREA_SEARCH_FILES = eventConstants.CHAT.TEXT_AREA.SEARCH_FILES

// ── Chat / Topic ────────────────────────────────────────────
export const CHAT_TOPIC_MODE = eventConstants.CHAT.TOPIC.MODE
export const CHAT_TOPIC_REQUEST_COMMANDS = eventConstants.CHAT.TOPIC.REQUEST_COMMANDS
export const CHAT_TOPIC_SWITCH_MODE = eventConstants.CHAT.TOPIC.SWITCH_MODE
export const CHAT_TOPIC_UPDATE_TODO_LIST = eventConstants.CHAT.TOPIC.UPDATE_TODO_LIST

export type ChatEventKeys = (typeof ChatEventKeys)[keyof typeof ChatEventKeys]

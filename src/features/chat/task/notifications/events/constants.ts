/**
 * Chat notifications event key constants.
 *
 * These keys map 1:1 to the event types sent via EventBridge IPC.
 * Naming convention: [Feature]_[Action] in UPPER_SNAKE_CASE.
 */
import { eventConstants } from "@jabberwock/types"

export const ChatNotificationsEventKeys = {
	ASK_RESPONSE_RECEIVED: "ask.response.received",
	NOTIFICATION_PERSIST: "notification.persist",
	NOTIFICATION_ADD: "notification.add",
	ASK_NOTIFICATION: "ask.notification",
	ASK_ELICITATION_RESPONSE: "ask.elicitation.response",
	LOG_WRITE: "log.write",
	CHECKPOINT_DIFF_REQUESTED: "checkpoint.diff.requested",
	CHECKPOINT_RESTORE_REQUESTED: "checkpoint.restore.requested",
	TTS_PLAY: "tts.play",
	TTS_STOP: "tts.stop",
	TTS_ENABLED_SET: "tts.enabled.set",
	TTS_SPEED_SET: "tts.speed.set",
} as const

/**
 * Flat IPC event string constants (Webview→Backend messages).
 * Values sourced from the single source of truth in @jabberwock/types.
 */

export const CHAT_NOTIFICATIONS_CHECKPOINT_DIFF = eventConstants.CHAT.NOTIFICATIONS.CHECKPOINT_DIFF
export const CHAT_NOTIFICATIONS_CHECKPOINT_RESTORE = eventConstants.CHAT.NOTIFICATIONS.CHECKPOINT_RESTORE
export const CHAT_NOTIFICATIONS_PLAY_TTS = eventConstants.CHAT.NOTIFICATIONS.PLAY_TTS
export const CHAT_NOTIFICATIONS_STOP_TTS = eventConstants.CHAT.NOTIFICATIONS.STOP_TTS
export const CHAT_NOTIFICATIONS_TTS_ENABLED = eventConstants.CHAT.NOTIFICATIONS.TTS_ENABLED
export const CHAT_NOTIFICATIONS_TTS_SPEED = eventConstants.CHAT.NOTIFICATIONS.TTS_SPEED
export const CHAT_NOTIFICATIONS_QUEUE_MESSAGE = eventConstants.CHAT.NOTIFICATIONS.QUEUE_MESSAGE
export const CHAT_NOTIFICATIONS_EDIT_QUEUED_MESSAGE = eventConstants.CHAT.NOTIFICATIONS.EDIT_QUEUED_MESSAGE
export const CHAT_NOTIFICATIONS_REMOVE_QUEUED_MESSAGE = eventConstants.CHAT.NOTIFICATIONS.REMOVE_QUEUED_MESSAGE
export const CHAT_NOTIFICATIONS_ELICITATION_RESPONSE = eventConstants.CHAT.NOTIFICATIONS.ELICITATION_RESPONSE

export type ChatNotificationsEventKeys = (typeof ChatNotificationsEventKeys)[keyof typeof ChatNotificationsEventKeys]

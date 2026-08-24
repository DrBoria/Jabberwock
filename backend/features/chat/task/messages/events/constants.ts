/**
 * Chat messages event key constants.
 *
 * These keys map 1:1 to the event types sent via EventBridge IPC.
 * Naming convention: [Feature]_[Action] in UPPER_SNAKE_CASE.
 */
import { eventConstants } from "@jabberwock/types"

export const ChatMessagesEventKeys = {
	MESSAGE_SEND_REQUESTED: "message.send.requested",
	MESSAGE_DELETE_REQUESTED: "message.delete.requested",
	MESSAGE_DELETE_CONFIRMED: "message.delete.confirmed",
	MESSAGE_EDIT_REQUESTED: "message.edit.requested",
	MESSAGE_EDIT_CONFIRMED: "message.edit.confirmed",
} as const

/**
 * Flat IPC event string constants (Webview→Backend messages).
 * Values sourced from the single source of truth in @jabberwock/types.
 */

export const CHAT_MESSAGES_LIST_ASK_RESPONSE = eventConstants.CHAT.MESSAGES_LIST.ASK_RESPONSE
export const CHAT_MESSAGES_LIST_DELETE_MESSAGE = eventConstants.CHAT.MESSAGES_LIST.DELETE_MESSAGE
export const CHAT_MESSAGES_LIST_DELETE_MESSAGE_CONFIRM = eventConstants.CHAT.MESSAGES_LIST.DELETE_MESSAGE_CONFIRM
export const CHAT_MESSAGES_LIST_SUBMIT_EDITED_MESSAGE = eventConstants.CHAT.MESSAGES_LIST.SUBMIT_EDITED_MESSAGE
export const CHAT_MESSAGES_LIST_EDIT_MESSAGE_CONFIRM = eventConstants.CHAT.MESSAGES_LIST.EDIT_MESSAGE_CONFIRM

export type ChatMessagesEventKeys = (typeof ChatMessagesEventKeys)[keyof typeof ChatMessagesEventKeys]

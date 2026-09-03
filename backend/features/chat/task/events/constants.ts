/**
 * Chat task event key constants.
 *
 * These keys map 1:1 to the event types sent via EventBridge IPC.
 * Naming convention: [Feature]_[Action] in UPPER_SNAKE_CASE.
 */
import { eventConstants } from "@jabberwock/types"

export const ChatTaskEventKeys = {
	TASK_CREATED: "task.created",
	TASK_CANCELLED: "task.cancelled",
	TASK_NEW_REQUESTED: "task.new.requested",
	TASK_CANCEL_REQUESTED: "task.cancel.requested",
	TASK_CLEAR_REQUESTED: "task.clear.requested",
	TASK_RESUME_REQUESTED: "task.resume.requested",
	TASK_SYNC_ENABLED_SET: "task.sync.enabled.set",
	TASK_CONSTENSE_CONTEXT_REQUESTED: "task.condense.context.requested",
	TASK_WEBVIEW_LAUNCHED: "task.webview.launched",
	TASK_SCRIPTS_FINISHED: "task.scripts.finished",
	TOOL_EXECUTION_REQUIRED: "tool.execution.required",
	TEXTAREA_ENHANCE_REQUESTED: "textarea.enhance.requested",
	TEXTAREA_FILES_SEARCH_REQUESTED: "textarea.files.search.requested",
	TEXTAREA_IMAGES_DRAGGED: "textarea.images.dragged",
	TEXTAREA_IMAGES_SELECT_REQUESTED: "textarea.images.select.requested",
	TOPIC_COMMANDS_REQUESTED: "topic.commands.requested",
	TOPIC_TODOLIST_UPDATE: "topic.todolist.update",

	GOAL_ADD_REQUESTED: "task.goal.add.requested",
	GOAL_REMOVE_REQUESTED: "task.goal.remove.requested",
	GOAL_UPDATE_REQUESTED: "task.goal.update.requested",
	GOAL_REORDER_REQUESTED: "task.goal.reorder.requested",
} as const

/**
 * Flat IPC event string constants (Webview→Backend messages).
 * Values sourced from the single source of truth in @jabberwock/types.
 */

export const CHAT_TASK_NEW_TASK = eventConstants.CHAT.TASK.NEW_TASK
export const CHAT_TASK_CANCEL_TASK = eventConstants.CHAT.TASK.CANCEL_TASK
export const CHAT_TASK_RESUME = eventConstants.CHAT.TASK.RESUME_TASK
export const CHAT_TASK_SEND_MESSAGE = eventConstants.CHAT.TASK.SEND_MESSAGE
export const CHAT_TASK_CLEAR_TASK = eventConstants.CHAT.TASK.CLEAR_TASK
export const CHAT_TASK_TASK_SYNC_ENABLED = eventConstants.CHAT.TASK.TASK_SYNC_ENABLED
export const CHAT_TASK_CONDENSE_TASK_CONTEXT_REQUEST = eventConstants.CHAT.TASK.CONDENSE_TASK_CONTEXT_REQUEST
export const CHAT_TASK_WEBVIEW_DID_LAUNCH = eventConstants.CHAT.TASK.WEBVIEW_DID_LAUNCH

export const CHAT_TASK_GOAL_ADD = eventConstants.CHAT.TASK.GOAL_ADD
export const CHAT_TASK_GOAL_REMOVE = eventConstants.CHAT.TASK.GOAL_REMOVE
export const CHAT_TASK_GOAL_UPDATE = eventConstants.CHAT.TASK.GOAL_UPDATE
export const CHAT_TASK_GOAL_REORDER = eventConstants.CHAT.TASK.GOAL_REORDER

export type ChatTaskEventKeys = (typeof ChatTaskEventKeys)[keyof typeof ChatTaskEventKeys]

/**
 * Messages event key constants.
 *
 * These keys map to the event types sent via vscode.postMessage for
 * message-list operations (ask response, delete, edit, etc.).
 * Naming convention: [Feature]_[Action] in UPPER_SNAKE_CASE.
 */
export const MessagesEventKeys = {
	ASK_RESPONSE: "askResponse",
	DELETE_MESSAGE: "deleteMessage",
	DELETE_MESSAGE_CONFIRM: "deleteMessageConfirm",
	SUBMIT_EDITED_MESSAGE: "submitEditedMessage",
	EDIT_MESSAGE_CONFIRM: "editMessageConfirm",
	TASK_SYNC_ENABLED: "taskSyncEnabled",
} as const

export type MessagesEventKeys = (typeof MessagesEventKeys)[keyof typeof MessagesEventKeys]

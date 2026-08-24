/**
 * Messages event action creators.
 *
 * These functions dispatch message-list-related events to the backend
 * via vscode.postMessage. They live in `events/actions/` instead of
 * the store to decouple action dispatch from MST state management.
 */

import { vscode } from "@jabberwock/devtool/webview"
import type { WebviewMessage, AskResponseValue } from "@jabberwock/types"
import { MessagesEventKeys } from "../constants"

/**
 * Send an ask response (primary/secondary button click, message response).
 */
export function sendAskResponse(response: AskResponseValue, text?: string, images?: string[]) {
	vscode.postMessage({
		type: MessagesEventKeys.ASK_RESPONSE,
		askResponse: response,
		text,
		images,
	} satisfies WebviewMessage)
}

/**
 * Request deletion of a message by its timestamp value.
 */
export function sendDeleteMessage(value: number) {
	vscode.postMessage({
		type: MessagesEventKeys.DELETE_MESSAGE,
		value,
	} satisfies WebviewMessage)
}

/**
 * Submit an edited message.
 */
export function sendSubmitEditedMessage(value: number, editedMessageContent: string, images?: string[]) {
	vscode.postMessage({
		type: MessagesEventKeys.SUBMIT_EDITED_MESSAGE,
		value,
		editedMessageContent,
		...(images !== undefined && images.length > 0 && { images }),
	} satisfies WebviewMessage)
}

/**
 * Confirm deletion of a message, optionally restoring a checkpoint.
 */
export function sendConfirmDeleteMessage(messageTs: number, restoreCheckpoint?: boolean) {
	vscode.postMessage({
		type: MessagesEventKeys.DELETE_MESSAGE_CONFIRM,
		messageTs,
		...(restoreCheckpoint !== undefined && { restoreCheckpoint }),
	} satisfies WebviewMessage)
}

/**
 * Confirm editing a message.
 */
export function sendConfirmEditMessage(
	messageTs: number,
	text: string,
	restoreCheckpoint?: boolean,
	images?: string[],
) {
	vscode.postMessage({
		type: MessagesEventKeys.EDIT_MESSAGE_CONFIRM,
		messageTs,
		text,
		...(restoreCheckpoint !== undefined && { restoreCheckpoint }),
		...(images !== undefined && images.length > 0 && { images }),
	} satisfies WebviewMessage)
}

/**
 * Send task sync enabled status.
 */
export function sendTaskSyncEnabled(bool: boolean) {
	vscode.postMessage({
		type: MessagesEventKeys.TASK_SYNC_ENABLED,
		bool,
	} satisfies WebviewMessage)
}

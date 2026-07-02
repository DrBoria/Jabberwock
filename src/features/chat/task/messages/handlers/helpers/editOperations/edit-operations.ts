import * as vscode from "vscode"

import type { EventBridge } from "@features/foundation/webview/EventBridge"
import type { ITaskModel } from "@features/chat/task/store"
import { t } from "@i18n"
import { findMessageIndices } from "@features/chat/task/messages/handlers/helpers/findMessageIndices"
import { handleEditWithCheckpoint, handleEditWithoutCheckpoint } from "./edit-operations-private"
import { handleDeleteOperation } from "@features/chat/task/messages/handlers/helpers/deleteOperations"

/**
 * Handles message editing operations with user confirmation.
 * Shows a dialog in the webview asking the user to confirm the edit.
 */
export async function handleEditOperation(
	provider: EventBridge,
	store: ITaskModel,
	messageTs: number,
	editedContent: string,
	images?: string[],
): Promise<void> {
	let hasCheckpoint = false
	if (store) {
		const { messageIndex } = findMessageIndices(messageTs, store)
		if (messageIndex !== -1) {
			const checkpoints = store.messages.filter(
				(msg) => msg.say === "checkpoint_saved" && typeof msg.ts === "number" && msg.ts > messageTs,
			)
			hasCheckpoint = checkpoints.length > 0
		} else {
			console.log("[webviewMessageHandler] Edit - Message not found in messages!")
		}
	} else {
		console.log("[webviewMessageHandler] Edit - No currentCline available!")
	}

	await provider.postMessageToWebview({
		type: "showEditMessageDialog",
		messageTs,
		text: editedContent,
		hasCheckpoint,
		images,
	})
}

export async function handleEditMessageConfirm(
	provider: EventBridge,
	store: ITaskModel,
	messageTs: number,
	editedContent: string,
	restoreCheckpoint?: boolean,
	images?: string[],
): Promise<void> {
	const { messageIndex, apiConversationHistoryIndex } = findMessageIndices(messageTs, store)

	if (messageIndex === -1) {
		const errorMessage = t("common:errors.message.message_not_found", { messageTs })
		console.error("[jabberwock] [handleEditMessageConfirm]", errorMessage)
		await vscode.window.showErrorMessage(errorMessage)
		return
	}

	try {
		const targetMessage = store.messages[messageIndex]

		if (restoreCheckpoint) {
			await handleEditWithCheckpoint(
				provider,
				store,
				messageTs,
				messageIndex,
				targetMessage,
				editedContent,
				images,
				apiConversationHistoryIndex,
			)
			return
		}

		await handleEditWithoutCheckpoint(
			provider,
			store,
			messageIndex,
			apiConversationHistoryIndex,
			editedContent,
			images,
		)
	} catch (error) {
		console.error("[jabberwock] Error in edit message:", error)
		vscode.window.showErrorMessage(
			t("common:errors.message.error_editing_message", {
				error: error instanceof Error ? error.message : String(error),
			}),
		)
	}
}

/**
 * Handles message modification operations (delete or edit) with confirmation dialog.
 */
export async function handleMessageModificationsOperation(
	provider: EventBridge,
	store: ITaskModel,
	messageTs: number,
	operation: "delete" | "edit",
	editedContent?: string,
	images?: string[],
): Promise<void> {
	if (operation === "delete") {
		await handleDeleteOperation(provider, store, messageTs)
	} else if (operation === "edit" && editedContent) {
		await handleEditOperation(provider, store, messageTs, editedContent, images)
	}
}

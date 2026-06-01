import * as vscode from "vscode"
import type { EventBridge } from "../../../../../foundation/webview/EventBridge"
import type { ITaskModel } from "../../../../task/store"
import type { Notification } from "@jabberwock/types"
import { handleCheckpointRestoreOperation } from "../../../../task/notifications/handlers/checkpointRestoreHandler"
import { resolveImageMentions } from "../../actions/resolveImageMentions"
import { saveTaskMessages } from "../../actions/saveMessages"
import { getVscodeContext } from "../../../../../foundation/vscode/context"
import { postStateToWebview } from "../../../../../foundation/window-manager/store"
import { t } from "../../../../../../i18n"
import { findMessageIndices, findFirstApiIndexAtOrAfter } from "./findMessageIndices"
import type { ApiMessage } from "../../actions/saveApiConversation"
import { handleDeleteOperation } from "./deleteOperations"

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

/**
 * Handles confirmed message editing from webview dialog.
 * Performs the actual edit with optional checkpoint restoration.
 */
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
			const checkpoints = store.messages.filter(
				(msg) => msg.say === "checkpoint_saved" && typeof msg.ts === "number" && msg.ts > messageTs,
			)

			const nextCheckpoint = checkpoints[0]

			if (nextCheckpoint && nextCheckpoint.text) {
				await handleCheckpointRestoreOperation({
					provider,
					currentCline: store,
					messageTs: targetMessage.ts!,
					messageIndex,
					checkpoint: { hash: nextCheckpoint.text },
					operation: "edit",
					editData: {
						editedContent,
						images,
						apiConversationHistoryIndex,
					},
				})
				return
			} else {
				console.log("[handleEditMessageConfirm] No checkpoint found before message")
				vscode.window.showWarningMessage("No checkpoint found before this message")
			}
		}

		let deleteFromMessageIndex = messageIndex
		let deleteFromApiIndex = apiConversationHistoryIndex

		for (let i = messageIndex; i >= 0; i--) {
			const m = store.messages[i]
			if (m?.say === "user_feedback") {
				deleteFromMessageIndex = i
				const userTs = m.ts
				if (typeof userTs === "number") {
					const apiIdx = store.apiConversationHistory.findIndex((am: ApiMessage) => am.ts === userTs)
					if (apiIdx !== -1) {
						deleteFromApiIndex = apiIdx
					}
				}
				break
			}
		}

		if (deleteFromApiIndex === -1) {
			const tsThresholdForEdit = store.messages[deleteFromMessageIndex]?.ts
			if (typeof tsThresholdForEdit === "number") {
				deleteFromApiIndex = findFirstApiIndexAtOrAfter(tsThresholdForEdit, store)
			}
		}

		const preservedCheckpoints = new Map<number, Notification["checkpoint"]>()
		for (let i = 0; i < deleteFromMessageIndex; i++) {
			const msg = store.messages[i]
			if (msg?.checkpoint && msg.ts) {
				preservedCheckpoints.set(msg.ts, msg.checkpoint)
			}
		}

		const rewindTs = store.messages[deleteFromMessageIndex]?.ts
		if (rewindTs) {
			await store.messageManager!.rewindToTimestamp(rewindTs, { includeTargetMessage: false })
		}

		for (const [ts, checkpoint] of preservedCheckpoints) {
			const msgIndex = store.messages.findIndex((msg) => msg.ts === ts)
			if (msgIndex !== -1) {
				store.messages[msgIndex].checkpoint = checkpoint
			}
		}

		await saveTaskMessages({
			messages: store.messages,
			taskId: store.taskId,
			globalStoragePath: getVscodeContext().globalStorageUri.fsPath,
		})

		await postStateToWebview(provider)

		await store.submitUserMessage(editedContent, images)
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

import * as vscode from "vscode"
import type { EventBridge } from "../../../../../foundation/webview/EventBridge"
import type { ITaskModel } from "../../../../task/store"
import type { Notification } from "@jabberwock/types"
import { handleCheckpointRestoreOperation } from "../../../../task/notifications/handlers/checkpointRestoreHandler"
import { saveTaskMessages } from "../../actions/saveMessages"
import { getVscodeContext } from "../../../../../foundation/vscode/context"
import { postStateToWebview } from "../../../../../foundation/window-manager/store"
import { t } from "../../../../../../i18n"
import { findMessageIndices, findFirstApiIndexAtOrAfter } from "./findMessageIndices"

/**
 * Handles message deletion operations with user confirmation.
 * Shows a dialog in the webview asking the user to confirm deletion.
 */
export async function handleDeleteOperation(
	provider: EventBridge,
	store: ITaskModel,
	messageTs: number,
): Promise<void> {
	let hasCheckpoint = false

	const { messageIndex } = findMessageIndices(messageTs, store)

	if (messageIndex !== -1) {
		const checkpoints = store.messages.filter(
			(msg) => msg.say === "checkpoint_saved" && typeof msg.ts === "number" && msg.ts > messageTs,
		)
		hasCheckpoint = checkpoints.length > 0
	}

	await provider.postMessageToWebview({
		type: "showDeleteMessageDialog",
		messageTs,
		hasCheckpoint,
	})
}

/**
 * Handles confirmed message deletion from webview dialog.
 * Performs the actual deletion with optional checkpoint restoration.
 */
export async function handleDeleteMessageConfirm(
	provider: EventBridge,
	store: ITaskModel,
	messageTs: number,
	restoreCheckpoint?: boolean,
): Promise<void> {
	const { messageIndex, apiConversationHistoryIndex } = findMessageIndices(messageTs, store)
	let apiIndexToUse = apiConversationHistoryIndex
	const tsThreshold = store.messages[messageIndex]?.ts
	if (apiIndexToUse === -1 && typeof tsThreshold === "number") {
		apiIndexToUse = findFirstApiIndexAtOrAfter(tsThreshold, store)
	}

	if (messageIndex === -1) {
		await vscode.window.showErrorMessage(t("common:errors.message.message_not_found", { messageTs }))
		return
	}

	try {
		const targetMessage = store.messages[messageIndex]

		if (restoreCheckpoint) {
			const checkpoints = store.messages.filter((msg) => msg.say === "checkpoint_saved" && msg.ts > messageTs)

			const nextCheckpoint = checkpoints[0]

			if (nextCheckpoint && nextCheckpoint.text) {
				await handleCheckpointRestoreOperation({
					provider,
					currentCline: store,
					messageTs: targetMessage.ts!,
					messageIndex,
					checkpoint: { hash: nextCheckpoint.text },
					operation: "delete",
				})
			} else {
				console.log("[handleDeleteMessageConfirm] No checkpoint found before message")
				vscode.window.showWarningMessage("No checkpoint found before this message")
			}
		} else {
			const preservedCheckpoints = new Map<number, Notification["checkpoint"]>()
			for (let i = 0; i < messageIndex; i++) {
				const msg = store.messages[i]
				if (msg?.checkpoint && msg.ts) {
					preservedCheckpoints.set(msg.ts, msg.checkpoint)
				}
			}

			await store.messageManager!.rewindToTimestamp(targetMessage.ts!, { includeTargetMessage: false })

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
		}
	} catch (error) {
		console.error("[jabberwock] Error in delete message:", error)
		vscode.window.showErrorMessage(
			t("common:errors.message.error_deleting_message", {
				error: error instanceof Error ? error.message : String(error),
			}),
		)
	}
}

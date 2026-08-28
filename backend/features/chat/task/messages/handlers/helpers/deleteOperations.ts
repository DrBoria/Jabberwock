import * as vscode from "vscode"
import type { EventBridge } from "@features/foundation/webview/EventBridge"
import type { ITaskModel } from "@features/chat/task/store"
import type { Notification } from "@jabberwock/types"
import { handleCheckpointRestoreOperation } from "@features/chat/task/notifications/handlers/checkpoint/checkpointRestoreHandler"
import { saveTaskMessages } from "@features/chat/task/messages/actions/saveMessages"
import { getVscodeContext } from "@features/foundation/vscode/context"
import { postStateToWebview } from "@features/foundation/window-manager/store"
import { t } from "@i18n"
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
async function handleDeleteWithCheckpoint(
	provider: EventBridge,
	store: ITaskModel,
	messageTs: number,
	targetMessage: Notification,
): Promise<void> {
	const checkpoints = store.messages.filter((msg) => msg.say === "checkpoint_saved" && msg.ts > messageTs)

	const nextCheckpoint = checkpoints[0]

	if (nextCheckpoint && nextCheckpoint.text) {
		await handleCheckpointRestoreOperation({
			provider,
			currentCline: store,
			messageTs: targetMessage.ts!,
			messageIndex: store.messages.indexOf(targetMessage),
			checkpoint: { hash: nextCheckpoint.text },
			operation: "delete",
		})
	} else {
		console.log("[handleDeleteMessageConfirm] No checkpoint found before message")
		vscode.window.showWarningMessage("No checkpoint found before this message")
	}
}

async function handleDeleteWithoutCheckpoint(
	store: ITaskModel,
	messageIndex: number,
	targetMessage: Notification,
): Promise<void> {
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
}

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
		await publishNotificationError(t("common:errors.message.message_not_found", { messageTs }))
		return
	}

	try {
		const targetMessage = store.messages[messageIndex]

		if (restoreCheckpoint) {
			await handleDeleteWithCheckpoint(provider, store, messageTs, targetMessage)
		} else {
			await handleDeleteWithoutCheckpoint(store, messageIndex, targetMessage)
			await saveTaskMessages({
				messages: store.messages,
				taskId: store.taskId,
				globalStoragePath: getVscodeContext().globalStorageUri.fsPath,
			})
			await postStateToWebview(provider)
		}
	} catch (error) {
		console.error("[jabberwock] Error in delete message:", error)
		publishNotificationError(
			t("common:errors.message.error_deleting_message", {
				error: error instanceof Error ? error.message : String(error),
			}),
		)
	}
}

import { publishNotificationError } from "@features/foundation/capabilities/notifications"

import * as vscode from "vscode"

import type { EventBridge } from "@features/foundation/webview/EventBridge"
import type { ITaskModel } from "@features/chat/task/store"
import type { Notification } from "@jabberwock/types"
import { handleCheckpointRestoreOperation } from "@features/chat/task/notifications/handlers/checkpoint/checkpointRestoreHandler"
import { saveTaskMessages } from "@features/chat/task/messages/actions/saveMessages"
import { getVscodeContext } from "@features/foundation/vscode/context"
import { postStateToWebview } from "@features/foundation/window-manager/store"
import { findFirstApiIndexAtOrAfter } from "@features/chat/task/messages/handlers/helpers/findMessageIndices"
import type { ApiMessage } from "@features/chat/task/messages/actions/save/saveApiMessages.types"

export async function handleEditWithCheckpoint(
	provider: EventBridge,
	store: ITaskModel,
	messageTs: number,
	messageIndex: number,
	targetMessage: Notification,
	editedContent: string,
	images?: string[],
	apiConversationHistoryIndex?: number,
): Promise<void> {
	const checkpoints = store.messages.filter((msg) => msg.say === "checkpoint_saved" && msg.ts > messageTs)

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
				apiConversationHistoryIndex: apiConversationHistoryIndex!,
			},
		})
	} else {
		console.log("[handleEditMessageConfirm] No checkpoint found before message")
		vscode.window.showWarningMessage("No checkpoint found before this message")
	}
}

export async function handleEditWithoutCheckpoint(
	provider: EventBridge,
	store: ITaskModel,
	messageIndex: number,
	apiConversationHistoryIndex: number | undefined,
	editedContent: string,
	images?: string[],
): Promise<void> {
	const { deleteFromMessageIndex } = findDeleteBoundaries(store, messageIndex, apiConversationHistoryIndex)

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
}

function findDeleteBoundaries(
	store: ITaskModel,
	messageIndex: number,
	apiConversationHistoryIndex: number | undefined,
): { deleteFromMessageIndex: number; deleteFromApiIndex: number } {
	let deleteFromMessageIndex = messageIndex
	let deleteFromApiIndex = apiConversationHistoryIndex ?? -1

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

	return { deleteFromMessageIndex, deleteFromApiIndex }
}

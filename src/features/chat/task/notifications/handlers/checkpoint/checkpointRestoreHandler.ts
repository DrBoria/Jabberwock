import type { ITaskModel } from "@features/chat/task/store"
import { EventBridge } from "@features/foundation/webview/EventBridge"
import { saveTaskMessages } from "@features/chat/task/messages/actions"
import * as vscode from "vscode"
import { when } from "mobx"
import { t } from "@i18n"
import { getState, getBackendRootStore } from "@features/storeSingleton"
import { getTaskWithId } from "@features/hist/actions"
import { createTaskWithHistoryItem } from "@features/chat/task/actions/startTask"
import { getVscodeContext } from "@features/foundation/vscode/context"
import { checkpointRestore as checkpointRestoreAction } from "@features/foundation/time-machine/actions/checkpoints"

export interface CheckpointRestoreConfig {
	provider: EventBridge
	currentCline: ITaskModel
	messageTs: number
	messageIndex: number
	checkpoint: { hash: string }
	operation: "delete" | "edit"
	editData?: {
		editedContent: string
		images?: string[]
		apiConversationHistoryIndex: number
	}
}

/**
 * Handles checkpoint restoration for both delete and edit operations.
 * This consolidates the common logic while handling operation-specific behavior.
 */
export async function handleCheckpointRestoreOperation(config: CheckpointRestoreConfig): Promise<void> {
	const { provider, currentCline, messageTs, checkpoint, operation, editData } = config

	try {
		// For delete operations, ensure the task is properly aborted to handle any pending ask operations
		// This prevents "Current ask promise was ignored" errors
		// For edit operations, we don't abort because the checkpoint restore will handle it
		if (operation === "delete" && currentCline && !currentCline.abort) {
			currentCline.abortTask()
			// Wait a bit for the abort to complete
			await when(() => currentCline.abort === true, {
				timeout: 1000,
			}).catch(() => {
				// Continue even if timeout - the abort flag should be set
			})
		}

		// For edit operations, set up pending edit data before restoration
		if (operation === "edit" && editData) {
			const operationId = `task-${currentCline.taskId}`
			getBackendRootStore().foundation.agentState.pendingEditOp = {
				id: operationId,
				data: {
					messageTs,
					editedContent: editData.editedContent,
					images: editData.images,
					messageIndex: config.messageIndex,
					apiConversationHistoryIndex: editData.apiConversationHistoryIndex,
				},
			}
		}

		// Perform the checkpoint restoration
		await checkpointRestoreAction(currentCline, {
			ts: messageTs,
			commitHash: checkpoint.hash,
			mode: "restore",
			operation,
		})

		// For delete operations, we need to save messages and reinitialize
		// For edit operations, the reinitialization happens automatically
		// and processes the pending edit
		if (operation === "delete") {
			// Save the updated messages to disk after checkpoint restoration
			await saveTaskMessages({
				messages: currentCline.messages,
				taskId: currentCline.taskId,
				globalStoragePath: getVscodeContext().globalStorageUri.fsPath,
			})

			// Get the updated history item and reinitialize
			const { historyItem } = await getTaskWithId(currentCline.taskId)
			await createTaskWithHistoryItem(provider, historyItem)
		}
		// For edit operations, the task cancellation in checkpointRestore
		// will trigger reinitialization, which will process pendingEditAfterRestore
	} catch (error) {
		console.error(`[jabberwock] Error in checkpoint restore (${operation}):`, error)
		vscode.window.showErrorMessage(
			`Error during checkpoint restore: ${error instanceof Error ? error.message : String(error)}`,
		)
		throw error
	}
}

/**
 * Common checkpoint restore validation and initialization utility.
 * This can be used by any checkpoint restore flow that needs to wait for initialization.
 */
export async function waitForClineInitialization(
	rootStore: import("@features/store").IBackendRootStore,
	timeoutMs: number = 3000,
): Promise<boolean> {
	try {
		await when(() => rootStore.chat.activeTask?.isInitialized === true, {
			timeout: timeoutMs,
		})
		return true
	} catch (error) {
		vscode.window.showErrorMessage(t("common:errors.checkpoint_timeout"))
		return false
	}
}

import type { EventBridge, CurrentTask } from "../../../core/webview/EventBridge"
import type { WebviewMessage, ExtensionMessage, ClineMessage } from "@jabberwock/types"
import type { ApiMessage } from "../../../core/task-persistence/apiMessages"
import { saveTaskMessages } from "../../../core/task-persistence"
import { handleCheckpointRestoreOperation } from "../../../core/webview/checkpointRestoreHandler"
import { resolveImageMentions } from "../../../core/mentions/resolveImageMentions"
import { t } from "../../../i18n"
import * as vscode from "vscode"

import { postStateToWebview } from "../../foundation/window-manager/store"
export type HandlerFn = (provider: EventBridge, message: WebviewMessage) => Promise<void>

/**
 * Resolves image file mentions in incoming messages.
 * Matches read_file behavior: respects size limits and model capabilities.
 */
async function resolveIncomingImages(
	provider: EventBridge,
	payload: { text?: string; images?: string[] },
	cwd: string,
) {
	const text = payload.text ?? ""
	const images = payload.images
	const currentTask = provider.getCurrentTask()
	const state = await provider.getState()
	const resolved = await resolveImageMentions({
		text,
		images,
		cwd,
		jabberwockIgnoreController: currentTask?.jabberwockIgnoreController,
		maxImageFileSize: state.maxImageFileSize,
		maxTotalImageSize: state.maxTotalImageSize,
	})
	return resolved
}

/**
 * Shared utility to find message indices based on timestamp.
 * When multiple messages share the same timestamp (e.g., after condense),
 * this function prefers non-summary messages to ensure user operations
 * target the intended message rather than the summary.
 */
function findMessageIndices(messageTs: number, currentCline: CurrentTask) {
	const messageIndex = currentCline.clineMessages.findIndex((msg) => msg.ts === messageTs)

	const allApiMatches = currentCline.apiConversationHistory
		.map((msg, idx) => ({ msg, idx }))
		.filter(({ msg }) => msg.ts === messageTs)

	const preferred = allApiMatches.find(({ msg }) => !msg.isSummary) || allApiMatches[0]
	const apiConversationHistoryIndex = preferred?.idx ?? -1

	return { messageIndex, apiConversationHistoryIndex }
}

/**
 * Fallback: find first API history index at or after a timestamp.
 */
function findFirstApiIndexAtOrAfter(ts: number, currentCline: CurrentTask) {
	if (typeof ts !== "number") return -1
	return currentCline.apiConversationHistory.findIndex((msg) => typeof msg?.ts === "number" && msg.ts >= ts)
}

/**
 * Handles message deletion operations with user confirmation
 */
async function handleDeleteOperation(provider: EventBridge, messageTs: number): Promise<void> {
	const currentCline = provider.getCurrentTask()
	let hasCheckpoint = false

	if (!currentCline) {
		await vscode.window.showErrorMessage(t("common:errors.message.no_active_task_to_delete"))
		return
	}

	const { messageIndex } = findMessageIndices(messageTs, currentCline)

	if (messageIndex !== -1) {
		const checkpoints = currentCline.clineMessages.filter(
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
 * Handles confirmed message deletion from webview dialog
 */
async function handleDeleteMessageConfirm(
	provider: EventBridge,
	messageTs: number,
	restoreCheckpoint?: boolean,
): Promise<void> {
	const currentCline = provider.getCurrentTask()
	if (!currentCline) {
		console.error("[handleDeleteMessageConfirm] No current cline available")
		return
	}

	const { messageIndex, apiConversationHistoryIndex } = findMessageIndices(messageTs, currentCline)
	let apiIndexToUse = apiConversationHistoryIndex
	const tsThreshold = currentCline.clineMessages[messageIndex]?.ts
	if (apiIndexToUse === -1 && typeof tsThreshold === "number") {
		apiIndexToUse = findFirstApiIndexAtOrAfter(tsThreshold, currentCline)
	}

	if (messageIndex === -1) {
		await vscode.window.showErrorMessage(t("common:errors.message.message_not_found", { messageTs }))
		return
	}

	try {
		const targetMessage = currentCline.clineMessages[messageIndex]

		if (restoreCheckpoint) {
			const checkpoints = currentCline.clineMessages.filter(
				(msg) => msg.say === "checkpoint_saved" && msg.ts > messageTs,
			)

			const nextCheckpoint = checkpoints[0]

			if (nextCheckpoint && nextCheckpoint.text) {
				await handleCheckpointRestoreOperation({
					provider,
					currentCline,
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
			const preservedCheckpoints = new Map<number, ClineMessage["checkpoint"]>()
			for (let i = 0; i < messageIndex; i++) {
				const msg = currentCline.clineMessages[i]
				if (msg?.checkpoint && msg.ts) {
					preservedCheckpoints.set(msg.ts, msg.checkpoint)
				}
			}

			await currentCline.messageManager.rewindToTimestamp(targetMessage.ts!, { includeTargetMessage: false })

			for (const [ts, checkpoint] of preservedCheckpoints) {
				const msgIndex = currentCline.clineMessages.findIndex((msg) => msg.ts === ts)
				if (msgIndex !== -1) {
					currentCline.clineMessages[msgIndex].checkpoint = checkpoint
				}
			}

			await saveTaskMessages({
				messages: currentCline.clineMessages,
				taskId: currentCline.taskId,
				globalStoragePath: provider.contextProxy.globalStorageUri.fsPath,
			})

			await postStateToWebview(provider)
		}
	} catch (error) {
		console.error("Error in delete message:", error)
		vscode.window.showErrorMessage(
			t("common:errors.message.error_deleting_message", {
				error: error instanceof Error ? error.message : String(error),
			}),
		)
	}
}

/**
 * Handles message editing operations with user confirmation
 */
async function handleEditOperation(
	provider: EventBridge,
	messageTs: number,
	editedContent: string,
	images?: string[],
): Promise<void> {
	const currentCline = provider.getCurrentTask()
	let hasCheckpoint = false
	if (currentCline) {
		const { messageIndex } = findMessageIndices(messageTs, currentCline)
		if (messageIndex !== -1) {
			const checkpoints = currentCline.clineMessages.filter(
				(msg) => msg.say === "checkpoint_saved" && typeof msg.ts === "number" && msg.ts > messageTs,
			)
			hasCheckpoint = checkpoints.length > 0
		} else {
			console.log("[webviewMessageHandler] Edit - Message not found in clineMessages!")
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
 * Handles confirmed message editing from webview dialog
 */
async function handleEditMessageConfirm(
	provider: EventBridge,
	messageTs: number,
	editedContent: string,
	restoreCheckpoint?: boolean,
	images?: string[],
): Promise<void> {
	const currentCline = provider.getCurrentTask()
	if (!currentCline) {
		console.error("[handleEditMessageConfirm] No current cline available")
		return
	}

	const { messageIndex, apiConversationHistoryIndex } = findMessageIndices(messageTs, currentCline)

	if (messageIndex === -1) {
		const errorMessage = t("common:errors.message.message_not_found", { messageTs })
		console.error("[handleEditMessageConfirm]", errorMessage)
		await vscode.window.showErrorMessage(errorMessage)
		return
	}

	try {
		const targetMessage = currentCline.clineMessages[messageIndex]

		if (restoreCheckpoint) {
			const checkpoints = currentCline.clineMessages.filter(
				(msg) => msg.say === "checkpoint_saved" && typeof msg.ts === "number" && msg.ts > messageTs,
			)

			const nextCheckpoint = checkpoints[0]

			if (nextCheckpoint && nextCheckpoint.text) {
				await handleCheckpointRestoreOperation({
					provider,
					currentCline,
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
			const m = currentCline.clineMessages[i]
			if (m?.say === "user_feedback") {
				deleteFromMessageIndex = i
				const userTs = m.ts
				if (typeof userTs === "number") {
					const apiIdx = currentCline.apiConversationHistory.findIndex((am: ApiMessage) => am.ts === userTs)
					if (apiIdx !== -1) {
						deleteFromApiIndex = apiIdx
					}
				}
				break
			}
		}

		if (deleteFromApiIndex === -1) {
			const tsThresholdForEdit = currentCline.clineMessages[deleteFromMessageIndex]?.ts
			if (typeof tsThresholdForEdit === "number") {
				deleteFromApiIndex = findFirstApiIndexAtOrAfter(tsThresholdForEdit, currentCline)
			}
		}

		const preservedCheckpoints = new Map<number, ClineMessage["checkpoint"]>()
		for (let i = 0; i < deleteFromMessageIndex; i++) {
			const msg = currentCline.clineMessages[i]
			if (msg?.checkpoint && msg.ts) {
				preservedCheckpoints.set(msg.ts, msg.checkpoint)
			}
		}

		const rewindTs = currentCline.clineMessages[deleteFromMessageIndex]?.ts
		if (rewindTs) {
			await currentCline.messageManager.rewindToTimestamp(rewindTs, { includeTargetMessage: false })
		}

		for (const [ts, checkpoint] of preservedCheckpoints) {
			const msgIndex = currentCline.clineMessages.findIndex((msg) => msg.ts === ts)
			if (msgIndex !== -1) {
				currentCline.clineMessages[msgIndex].checkpoint = checkpoint
			}
		}

		await saveTaskMessages({
			messages: currentCline.clineMessages,
			taskId: currentCline.taskId,
			globalStoragePath: provider.contextProxy.globalStorageUri.fsPath,
		})

		await postStateToWebview(provider)

		await currentCline.submitUserMessage(editedContent, images)
	} catch (error) {
		console.error("Error in edit message:", error)
		vscode.window.showErrorMessage(
			t("common:errors.message.error_editing_message", {
				error: error instanceof Error ? error.message : String(error),
			}),
		)
	}
}

/**
 * Handles message modification operations (delete or edit) with confirmation dialog
 */
async function handleMessageModificationsOperation(
	provider: EventBridge,
	messageTs: number,
	operation: "delete" | "edit",
	editedContent?: string,
	images?: string[],
): Promise<void> {
	if (operation === "delete") {
		await handleDeleteOperation(provider, messageTs)
	} else if (operation === "edit" && editedContent) {
		await handleEditOperation(provider, messageTs, editedContent, images)
	}
}

export const handlerMap: Record<string, HandlerFn> = {
	askResponse: async (provider, message) => {
		const currentCline = provider.getCurrentTask()
		const cwd = currentCline?.cwd || provider.cwd
		const resolved = await resolveIncomingImages(provider, { text: message.text, images: message.images }, cwd)
		provider.getCurrentTask()?.handleWebviewAskResponse(message.askResponse!, resolved.text, resolved.images)
	},

	deleteMessage: async (provider, message) => {
		if (!provider.getCurrentTask()) {
			await vscode.window.showErrorMessage(t("common:errors.message.no_active_task_to_delete"))
			return
		}

		if (typeof message.value !== "number" || !message.value) {
			await vscode.window.showErrorMessage(t("common:errors.message.invalid_timestamp_for_deletion"))
			return
		}

		await handleMessageModificationsOperation(provider, message.value, "delete")
	},

	deleteMessageConfirm: async (provider, message) => {
		if (!message.messageTs) {
			await vscode.window.showErrorMessage(t("common:errors.message.cannot_delete_missing_timestamp"))
			return
		}

		if (typeof message.messageTs !== "number") {
			await vscode.window.showErrorMessage(t("common:errors.message.cannot_delete_invalid_timestamp"))
			return
		}

		await handleDeleteMessageConfirm(provider, message.messageTs, message.restoreCheckpoint)
	},

	submitEditedMessage: async (provider, message) => {
		if (
			provider.getCurrentTask() &&
			typeof message.value === "number" &&
			message.value &&
			message.editedMessageContent
		) {
			await handleMessageModificationsOperation(
				provider,
				message.value,
				"edit",
				message.editedMessageContent,
				message.images,
			)
		}
	},

	editMessageConfirm: async (provider, message) => {
		if (message.messageTs && message.text) {
			const currentCline = provider.getCurrentTask()
			const cwd = currentCline?.cwd || provider.cwd
			const resolved = await resolveIncomingImages(provider, { text: message.text, images: message.images }, cwd)
			await handleEditMessageConfirm(
				provider,
				message.messageTs,
				resolved.text,
				message.restoreCheckpoint,
				resolved.images,
			)
		}
	},
}

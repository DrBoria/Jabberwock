import { vscode } from "@jabberwock/devtool/react"
import type { WebviewMessage } from "@jabberwock/types"
import {
	CHAT_TASK_NEW_TASK,
	CHAT_TASK_CLEAR_TASK,
	CHAT_TASK_CANCEL_TASK,
	CHAT_TASK_CONDENSE_TASK_CONTEXT_REQUEST,
	CHAT_TASK_SET_CHAT_BOX_MESSAGE,
	WINDOW_MANAGER_GET_TASK_WITH_AGGREGATED_COSTS,
	WINDOW_MANAGER_SHOW_TASK_WITH_ID,
} from "@jabberwock/types"

/**
 * Factory for ChatStore task-related actions.
 * Spread into the ChatStore's .actions() block.
 */
export function createTaskActions(self: {
	ui: {
		clearInput(): void
		setSendingDisabled(val: boolean): void
		isCondensing: boolean
		sendingDisabled: boolean
	}
	tree: {
		navigateToNode(id: string): void
	}
}) {
	return {
		// ── Send message ───────────────────────────────────────────
		sendMessage(text: string, images: string[]) {
			const trimmed = text.trim()
			if (!trimmed && images.length === 0) return
			vscode.postMessage({
				type: CHAT_TASK_NEW_TASK,
				text: trimmed,
				images,
			} satisfies WebviewMessage)
			self.ui.clearInput()
		},

		// ── Clear / cancel task ────────────────────────────────────
		clearTask() {
			vscode.postMessage({
				type: CHAT_TASK_CLEAR_TASK,
			} satisfies WebviewMessage)
			self.ui.clearInput()
			self.ui.setSendingDisabled(false)
		},

		cancelTask() {
			vscode.postMessage({
				type: CHAT_TASK_CANCEL_TASK,
			} satisfies WebviewMessage)
		},

		// ── Navigate to task ───────────────────────────────────────
		navigateToTask(taskId: string) {
			self.tree.navigateToNode(taskId)
			vscode.postMessage({
				type: WINDOW_MANAGER_SHOW_TASK_WITH_ID,
				text: taskId,
			} satisfies WebviewMessage)
		},

		// ── Condense context ───────────────────────────────────────
		condenseContext(taskId: string) {
			if (self.ui.isCondensing || self.ui.sendingDisabled) return
			self.ui.isCondensing = true
			self.ui.setSendingDisabled(true)
			vscode.postMessage({
				type: CHAT_TASK_CONDENSE_TASK_CONTEXT_REQUEST,
				text: taskId,
			} satisfies WebviewMessage)
		},

		// ── Set chat box message ────────────────────────────────────
		setChatBoxMessage(text: string, images: string[]) {
			vscode.postMessage({
				type: CHAT_TASK_SET_CHAT_BOX_MESSAGE,
				text,
				images,
			} satisfies WebviewMessage)
		},

		// ── Get task with aggregated costs ──────────────────────────
		getTaskWithAggregatedCosts(taskId: string) {
			vscode.postMessage({
				type: WINDOW_MANAGER_GET_TASK_WITH_AGGREGATED_COSTS,
				text: taskId,
			} satisfies WebviewMessage)
		},
	}
}

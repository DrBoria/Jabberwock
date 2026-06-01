import { vscode } from "@jabberwock/devtool/webview"
import type { WebviewMessage } from "@jabberwock/types"
import { eventConstants } from "@jabberwock/types"

/**
 * Factory for ChatStore task-related actions.
 * Spread into the ChatStore's .actions() block.
 */
export function createTaskActions(self: {
	clearInput(): void
	setSendingDisabled(val: boolean): void
	isCondensing: boolean
	sendingDisabled: boolean
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
				type: eventConstants.CHAT.TASK.NEW_TASK,
				text: trimmed,
				images,
			} satisfies WebviewMessage)
			self.clearInput()
		},

		// ── Clear / cancel task ────────────────────────────────────
		clearTask() {
			vscode.postMessage({
				type: eventConstants.CHAT.TASK.CLEAR_TASK,
			} satisfies WebviewMessage)
			self.clearInput()
			self.setSendingDisabled(false)
		},

		cancelTask() {
			vscode.postMessage({
				type: eventConstants.CHAT.TASK.CANCEL_TASK,
			} satisfies WebviewMessage)
		},

		// ── Navigate to task ───────────────────────────────────────
		navigateToTask(taskId: string) {
			self.tree.navigateToNode(taskId)
			vscode.postMessage({
				type: eventConstants.WINDOW_MANAGER.SHOW_TASK_WITH_ID,
				text: taskId,
			} satisfies WebviewMessage)
		},

		// ── Condense context ───────────────────────────────────────
		condenseContext(taskId: string) {
			if (self.isCondensing || self.sendingDisabled) return
			self.isCondensing = true
			self.setSendingDisabled(true)
			vscode.postMessage({
				type: eventConstants.CHAT.TASK.CONDENSE_TASK_CONTEXT_REQUEST,
				text: taskId,
			} satisfies WebviewMessage)
		},

		// ── Set chat box message ────────────────────────────────────
		setChatBoxMessage(text: string, images: string[]) {
			vscode.postMessage({
				type: eventConstants.CHAT.TASK.SET_CHAT_BOX_MESSAGE,
				text,
				images,
			} satisfies WebviewMessage)
		},

		// ── Get task with aggregated costs ──────────────────────────
		getTaskWithAggregatedCosts(taskId: string) {
			vscode.postMessage({
				type: eventConstants.WINDOW_MANAGER.GET_TASK_WITH_AGGREGATED_COSTS,
				text: taskId,
			} satisfies WebviewMessage)
		},
	}
}

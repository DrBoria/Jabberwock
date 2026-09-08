import { getConnectorBus } from "../../../connector-bus"
import { getRoot } from "mobx-state-tree"

import type { WebviewMessage, Goal, Notification } from "@jabberwock/types"
import { eventConstants } from "@jabberwock/types"

/**
 * Factory for ChatStore task-related actions.
 * Spread into the ChatStore's .actions() block.
 */
import { sendNavigateToTask } from "@src/features/chat/task/events/actions"

export interface TaskActionsParams {
	textArea: {
		clearInput(): void
		setSendingDisabled(val: boolean): void
		sendingDisabled: boolean
	}
	isCondensing: boolean
	tree: {
		navigateToNode(id: string): void
	}
}

export function createTaskActions(self: TaskActionsParams) {
	const _self = self as TaskActionsParams & {
		respondToAsk(response: string, text?: string, images?: string[]): void
		clearTask(): void
	}
	const hasInput = (trimmedInput: string | undefined, images: string[] | undefined): boolean =>
		!!trimmedInput || (!!images && images.length > 0)
	const isClearTaskSecondary = (currentAsk: string | undefined): boolean =>
		currentAsk === "api_req_failed" || currentAsk === "mistake_limit_reached" || currentAsk === "resume_task"
	const isRespondNoSecondary = (currentAsk: string | undefined): boolean =>
		currentAsk === "command" || currentAsk === "tool" || currentAsk === "use_mcp_server"

	return {
		// ── Send message ───────────────────────────────────────────
		sendMessage(text: string, images: string[], goals?: Goal[]) {
			const trimmed = text.trim()
			if (!trimmed && images.length === 0) return
			const root = getRoot<{ extensionState: { mode: string } }>(self as never)
			getConnectorBus().publish({
				type: eventConstants.CHAT.TASK.NEW_TASK,
				text: trimmed,
				images,
				mode: root.extensionState.mode,
				...(goals && goals.length > 0 ? { goals } : {}),
			} satisfies WebviewMessage)
			self.textArea.clearInput()
		},

		// ── Clear / cancel task ────────────────────────────────────
		clearTask() {
			getConnectorBus().publish({
				type: eventConstants.CHAT.TASK.CLEAR_TASK,
			} satisfies WebviewMessage)
			self.textArea.clearInput()
			self.textArea.setSendingDisabled(false)
		},

		cancelTask() {
			getConnectorBus().publish({
				type: eventConstants.CHAT.TASK.CANCEL_TASK,
			} satisfies WebviewMessage)
			self.textArea.setSendingDisabled(false)
		},

		// ── Navigate to task ───────────────────────────────────────
		navigateToTask(taskId: string) {
			self.tree.navigateToNode(taskId)
			sendNavigateToTask(taskId)
		},

		// ── Condense context ───────────────────────────────────────
		condenseContext(taskId: string) {
			if (self.isCondensing || self.textArea.sendingDisabled) return
			self.isCondensing = true
			self.textArea.setSendingDisabled(true)
			getConnectorBus().publish({
				type: eventConstants.CHAT.TASK.CONDENSE_TASK_CONTEXT_REQUEST,
				text: taskId,
			} satisfies WebviewMessage)
		},

		// ── Set chat box message ────────────────────────────────────
		setChatBoxMessage(text: string, images: string[]) {
			getConnectorBus().publish({
				type: eventConstants.CHAT.TASK.SET_CHAT_BOX_MESSAGE,
				text,
				images,
			} satisfies WebviewMessage)
		},

		// ── Get task with aggregated costs ──────────────────────────
		getTaskWithAggregatedCosts(taskId: string) {
			getConnectorBus().publish({
				type: eventConstants.WINDOW_MANAGER.GET_TASK_WITH_AGGREGATED_COSTS,
				text: taskId,
			} satisfies WebviewMessage)
		},

		// ── Button click handlers ──────────────────────────────────
		handlePrimaryButtonClick(
			currentAsk: string | undefined,
			currentTaskItem: { parentTaskId?: string } | undefined,
			messages: Notification[],
			text?: string,
			images?: string[],
		) {
			const trimmedInput = text?.trim()
			if (currentAsk === "completion_result" || currentAsk === "resume_completed_task") _self.clearTask()
			else if (currentAsk === "resume_task") {
				const hasParentResult =
					currentTaskItem?.parentTaskId &&
					messages.some((msg) => msg.ask === "completion_result" || msg.say === "completion_result")
				if (hasParentResult) _self.clearTask()
				else respondYes(hasInput, trimmedInput, images, _self)
			} else respondYes(hasInput, trimmedInput, images, _self)
			self.textArea.setSendingDisabled(true)
		},

		handleSecondaryButtonClick(
			currentAsk: string | undefined,
			_isStreaming: boolean,
			text?: string,
			images?: string[],
		) {
			const trimmedInput = text?.trim()
			if (isClearTaskSecondary(currentAsk)) _self.clearTask()
			else if (isRespondNoSecondary(currentAsk)) {
				if (hasInput(trimmedInput, images)) _self.respondToAsk("noButtonClicked", trimmedInput, images)
				else _self.respondToAsk("noButtonClicked")
			} else _self.respondToAsk("noButtonClicked", trimmedInput, images)
			self.textArea.setSendingDisabled(true)
		},
	}
}

function respondYes(
	hasInput: (text: string | undefined, images: string[] | undefined) => boolean,
	trimmedInput: string | undefined,
	images: string[] | undefined,
	self: { respondToAsk(response: string, text?: string, images?: string[]): void },
) {
	if (hasInput(trimmedInput, images)) self.respondToAsk("yesButtonClicked", trimmedInput, images)
	else self.respondToAsk("yesButtonClicked")
}

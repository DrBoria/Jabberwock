import { onWebviewMessage } from "@features/foundation/webview/events/handlers/on-webview-message"
import { IntentStatus } from "@jabberwock/types"
import { getBackendRootStore } from "@features/storeSingleton"
import {
	CHAT_TASK_GOAL_ADD,
	CHAT_TASK_GOAL_REMOVE,
	CHAT_TASK_GOAL_UPDATE,
	CHAT_TASK_GOAL_REORDER,
} from "@features/chat/task/events/constants"

/**
 * Handles GOAL_ADD event — creates an intent to add a goal.
 */
export function registerOnGoalAdd(): void {
	onWebviewMessage(CHAT_TASK_GOAL_ADD, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "task.goal.add.requested",
			payload: { taskId: store.chat.activeTaskId ?? "", text: message.text, importance: message.importance },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

/**
 * Handles GOAL_REMOVE event — creates an intent to remove a goal.
 */
export function registerOnGoalRemove(): void {
	onWebviewMessage(CHAT_TASK_GOAL_REMOVE, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "task.goal.remove.requested",
			payload: { taskId: store.chat.activeTaskId ?? "", id: message.id },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

/**
 * Handles GOAL_UPDATE event — creates an intent to update a goal.
 */
export function registerOnGoalUpdate(): void {
	onWebviewMessage(CHAT_TASK_GOAL_UPDATE, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "task.goal.update.requested",
			payload: {
				taskId: store.chat.activeTaskId ?? "",
				id: message.id,
				text: message.text,
				importance: message.importance,
			},
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

/**
 * Handles GOAL_REORDER event — creates an intent to reorder goals.
 */
export function registerOnGoalReorder(): void {
	onWebviewMessage(CHAT_TASK_GOAL_REORDER, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "task.goal.reorder.requested",
			payload: {
				taskId: store.chat.activeTaskId ?? "",
				fromIndex: message.fromIndex,
				toIndex: message.toIndex,
			},
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

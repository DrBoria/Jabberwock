import { defaultModeSlug } from "@shared/modes"
import type { Goal, Notification } from "@jabberwock/types"

import { getTask } from "@features/chat/task/actions/taskRegistry"
import { updateTaskHistory } from "@features/hist/actions"
import { getBackendRootStore } from "@features/storeSingleton"

import { saveTaskMessages } from "./saveMessages.io"
import { taskMetadata } from "./saveMessages.metadata"

/**
 * Save messages to disk and sync to MST store.
 * Messages are read from per-task MST store.
 */
export async function saveMessages(taskId: string): Promise<boolean> {
	const task = getTask(taskId)
	try {
		const messages = getBackendRootStore().chat.tasks.get(taskId)!.notifications.items

		const plainMessages = messages.map((m) => ({ ...m }))
		await saveTaskMessages({
			messages: structuredClone(plainMessages),
			taskId: task.taskId,
			globalStoragePath: task.globalStoragePath,
		})

		if (task._state._taskApiConfigName === undefined) {
			await task.taskApiConfigReady
		}

		const { historyItem, tokenUsage } = await taskMetadata({
			taskId: task.taskId,
			rootTaskId: task.rootTaskId,
			parentTaskId: task.parentTaskId,
			taskNumber: task._state.taskNumber,
			messages,
			globalStoragePath: task.globalStoragePath,
			workspace: task.cwd,
			mode: task._state._taskMode || defaultModeSlug,
			apiConfigName: task._state._taskApiConfigName,
			initialStatus: task._state.initialStatus as "active" | "delegated" | "completed" | undefined,
			goals: (task as { goals?: Goal[] }).goals,
			goalsHistory: (task as { goalsHistory?: Goal[] }).goalsHistory,
		})

		task.debouncedEmitTokenUsage!(tokenUsage, task._state.toolUsage)

		await updateTaskHistory(historyItem)
		return true
	} catch (error) {
		console.error("[jabberwock] Failed to save Jabberwock messages:", error)
		return false
	}
}

/**
 * Find a message by its timestamp (searching from the end).
 * Searches in MST store (notifications.items).
 */
export function findMessageByTimestamp(taskId: string, ts: number): Notification | undefined {
	const messages = getBackendRootStore().chat.tasks.get(taskId)!.notifications.items
	for (let i = messages.length - 1; i >= 0; i--) {
		if (messages[i].ts === ts) {
			return messages[i]
		}
	}
	return undefined
}

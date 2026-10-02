import { defaultModeSlug } from "@shared/modes"
import type { Goal, Notification } from "@jabberwock/types"

import { getTask } from "@features/chat"
import { updateTaskHistory } from "@features/hist/actions"
import { getStore } from "@features/singleton"

import { buildTaskHistory } from "./history"
import { safeWriteJson, getTaskDirectoryPath } from "@utils/io"
import { fileExistsAtPath } from "@utils/io/fs"
import { GlobalFileNames } from "@shared/globalFileNames"
import * as path from "path"
import * as fs from "fs/promises"

/**
 * Save messages to disk and sync to MST store.
 * Messages are read from "per-task" MST store.
 */
export async function saveMessages(taskId: string): Promise<boolean> {
	const task = getTask(taskId)
	try {
		const messages = getStore().chat.tasks.get(taskId)!.notifications.items

		const plainMessages = messages.map((m) => ({ ...m }))
		await saveTaskMessages({
			messages: structuredClone(plainMessages),
			taskId: task.taskId,
			globalStoragePath: task.globalStoragePath,
		})

		if (task._state._taskApiConfigName === undefined) {
			await task.taskApiConfigReady
		}

		const { historyItem, tokenUsage } = await buildTaskHistory({
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
 * Find a message by its timestamp (searching from "the" end).
 * Searches in MST store (notifications.items).
 */
export function findMessageByTimestamp(taskId: string, ts: number): Notification | undefined {
	const messages = getStore().chat.tasks.get(taskId)!.notifications.items
	for (let i = messages.length - 1; i >= 0; i--) {
		if (messages[i].ts === ts) {
			return messages[i]
		}
	}
	return undefined
}
export type ReadTaskMessagesOptions = {
	taskId: string
	globalStoragePath: string
}

export async function readTaskMessages({
	taskId,
	globalStoragePath,
}: ReadTaskMessagesOptions): Promise<Notification[]> {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.uiMessages)
	const fileExists = await fileExistsAtPath(filePath)

	if (fileExists) {
		try {
			const parsedData = JSON.parse(await fs.readFile(filePath, "utf8"))
			if (!Array.isArray(parsedData)) {
				console.warn(
					`[jabberwock] [readTaskMessages] Parsed data is not an array (got ${typeof parsedData}), returning empty. TaskId: ${taskId}, Path: ${filePath}`,
				)
				return []
			}
			return parsedData
		} catch (error) {
			console.warn(
				`[jabberwock] [readTaskMessages] Failed to parse ${filePath} for task ${taskId}, returning empty: ${error instanceof Error ? error.message : String(error)}`,
			)
			return []
		}
	}

	return []
}

export type SaveTaskMessagesOptions = {
	messages: Notification[]
	taskId: string
	globalStoragePath: string
}

export async function saveTaskMessages({ messages, taskId, globalStoragePath }: SaveTaskMessagesOptions) {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.uiMessages)
	await safeWriteJson(filePath, messages)
}

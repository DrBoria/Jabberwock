import { safeWriteJson } from "@utils/io"
import delay from "delay"
import { Anthropic } from "@anthropic-ai/sdk"
import { getTask } from "@features/chat/task/actions"
import { getStore } from "@features/singleton"
import type { ITaskModel } from "@features/chat/task"
import * as path from "path"
import * as fs from "fs/promises"
import { sendStateToWebview } from "@features/chat"
import { fileExistsAtPath } from "@utils/io/fs"
import { GlobalFileNames } from "@shared/globalFileNames"
import { getTaskDirectoryPath } from "@utils/io"
// ICG-C1 (ICG doc section 5.6): dual-write ingest into the context archive.
import { ingestTaskMessages } from "@features/context"

import type { ApiMessage } from "./types"
export type { ApiMessage }
export async function readApiConversation({
	taskId,
	globalStoragePath,
}: {
	taskId: string
	globalStoragePath: string
}): Promise<ApiMessage[]> {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.apiConversationHistory)

	if (await fileExistsAtPath(filePath)) {
		const fileContent = await fs.readFile(filePath, "utf8")
		try {
			const parsedData = JSON.parse(fileContent)
			if (!Array.isArray(parsedData)) {
				console.warn(
					`[jabberwock] [readApiConversation] Parsed data is not an array (got ${typeof parsedData}), returning empty. TaskId: ${taskId}, Path: ${filePath}`,
				)
				return []
			}
			if (parsedData.length === 0) {
				console.error(
					`[jabberwock] [Jabberwock-Debug] readApiConversation: Found API conversation history file, but it's empty (parsed as []). TaskId: ${taskId}, Path: ${filePath}`,
				)
			}
			return parsedData
		} catch (error) {
			console.warn(
				`[jabberwock] [readApiConversation] Error parsing API conversation history file, returning empty. TaskId: ${taskId}, Path: ${filePath}, Error: ${error}`,
			)
			return []
		}
	} else {
		const oldPath = path.join(taskDir, "claude_messages.json")

		if (await fileExistsAtPath(oldPath)) {
			const fileContent = await fs.readFile(oldPath, "utf8")
			try {
				const parsedData = JSON.parse(fileContent)
				if (!Array.isArray(parsedData)) {
					console.warn(
						`[jabberwock] [readApiConversation] Parsed OLD data is not an array (got ${typeof parsedData}), returning empty. TaskId: ${taskId}, Path: ${oldPath}`,
					)
					return []
				}
				if (parsedData.length === 0) {
					console.error(
						`[jabberwock] [Jabberwock-Debug] readApiConversation: Found OLD API conversation history file (claude_messages.json), but it's empty (parsed as []). TaskId: ${taskId}, Path: ${oldPath}`,
					)
				}
				await fs.unlink(oldPath)
				return parsedData
			} catch (error) {
				console.warn(
					`[jabberwock] [readApiConversation] Error parsing OLD API conversation history file (claude_messages.json), returning empty. TaskId: ${taskId}, Path: ${oldPath}, Error: ${error}`,
				)
				return []
			}
		}
	}

	console.error(
		`[jabberwock] [Jabberwock-Debug] readApiConversation: API conversation history file not found for taskId: ${taskId}. Expected at: ${filePath}`,
	)
	return []
}

export async function saveApiMessages({
	messages,
	taskId,
	globalStoragePath,
}: {
	messages: ApiMessage[]
	taskId: string
	globalStoragePath: string
}) {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.apiConversationHistory)
	await safeWriteJson(filePath, messages)
	// ICG-C1 (section 5.6 dual-write): mirror into the archive after the JSON write succeeds; idempotent per (taskId, seq); failures are logged and swallowed so they never break the primary save path.
	try {
		ingestTaskMessages(taskId, messages)
	} catch (error) {
		console.warn(`[jabberwock] [ContextArchive] Failed to ingest task ${taskId}:`, error)
	}
}

/**
 * Overwrites the API conversation history for a task and optionally syncs to UI.
 */
export async function overwriteApiConversationHistory(
	task: ITaskModel,
	newHistory: ApiMessage[],
	syncToUi: boolean = true,
): Promise<void> {
	// Volatile MST field — set through an action (direct assignment throws in strict mode).
	task.setApiConversationHistory(newHistory)
	if (syncToUi) {
		sendStateToWebview()
	}
}

export async function saveApiConversationHistory(taskId: string, globalStoragePath: string): Promise<boolean> {
	try {
		const history = getStore().chat.tasks.get(taskId)!.apiConversationHistory as ApiMessage[]
		await saveApiMessages({
			messages: structuredClone(history),
			taskId,
			globalStoragePath,
		})
		return true
	} catch (error) {
		console.error("[jabberwock] Failed to save API conversation history:", error)
		return false
	}
}

export async function retrySaveApiConversationHistory(taskId: string): Promise<boolean> {
	const task = getTask(taskId)
	const delays = [100, 500, 1500]

	for (let attempt = 0; attempt < delays.length; attempt++) {
		await delay(delays[attempt])
		console.warn(
			`[Task#${task.taskId}] retrySaveApiConversationHistory: retry attempt ${attempt + 1}/${delays.length}`,
		)

		try {
			await saveApiConversationHistory(task.taskId, task.globalStoragePath)
			return true
		} catch (err) {
			console.warn(`[Task#${task.taskId}] retrySaveApiConversationHistory failed:`, err)
		}
	}

	return false
}

export async function addToApiConversationHistory(
	taskId: string,
	globalStoragePath: string,
	task: ITaskModel,
	message: Anthropic.MessageParam,
	_reasoning?: string,
): Promise<void> {
	const ts = task.generateUniqueTs()
	;(task.apiConversationHistory as ApiMessage[]).push({ ...message, ts } as ApiMessage)
	await saveApiConversationHistory(taskId, globalStoragePath)
}

export function getSavedApiConversationHistory(taskId: string, globalStoragePath: string): Promise<ApiMessage[]> {
	const options = { taskId, globalStoragePath }
	return readApiConversation(options)
}

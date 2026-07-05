import { safeWriteJson } from "@utils/io"
import type { ITaskModel } from "@features/chat/task/store"
import * as path from "path"
import * as fs from "fs/promises"
import { sendStateToWebview } from "@features/chat/task/messages/events/actions/sendMessageEvent"
import { fileExistsAtPath } from "@utils/io/fs"
import { GlobalFileNames } from "@shared/globalFileNames"
import { getTaskDirectoryPath } from "@utils/io"

import type { ApiMessage } from "./saveApiMessages.types"
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
}

/**
 * Overwrites the API conversation history for a task and optionally syncs to UI.
 */
export async function overwriteApiConversationHistory(
	task: ITaskModel,
	newHistory: ApiMessage[],
	syncToUi: boolean = true,
): Promise<void> {
	task.apiConversationHistory = newHistory
	if (syncToUi) {
		sendStateToWebview()
	}
}

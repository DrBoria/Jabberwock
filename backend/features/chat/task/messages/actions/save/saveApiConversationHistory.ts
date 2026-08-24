import delay from "delay"
import { Anthropic } from "@anthropic-ai/sdk"
import { type ApiMessage, readApiConversation, saveApiMessages } from "."
import { getTask } from "@features/chat/task/actions/taskRegistry"
import { getBackendRootStore } from "@features/storeSingleton"
import type { ITaskModel } from "@features/chat/task/store"

export async function saveApiConversationHistory(taskId: string, globalStoragePath: string): Promise<boolean> {
	try {
		const history = getBackendRootStore().chat.tasks.get(taskId)!.apiConversationHistory as ApiMessage[]
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

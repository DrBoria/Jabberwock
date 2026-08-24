import { Anthropic } from "@anthropic-ai/sdk"

import { IntentType, IntentStatus } from "@jabberwock/types"

import type { ITaskModel } from "@features/chat/task/store"

import {
	cleanResumeMessages,
	pruneEmptyApiReqStarted,
	determineAskType,
	prepareResumeContent,
} from "./resumeTask.helpers"
import { overwriteMessages } from "@features/chat/task/messages/actions/updateMessage"
import { overwriteApiConversationHistory } from "@features/chat/task/messages/actions/save/saveApiMessages"
import { ask } from "@features/chat/task/notifications/actions/ask"
import { userBroadcast } from "@features/chat/task/messages/actions/say"
import { getBackendRootStore } from "@features/storeSingleton"
import { registerTask } from "@features/chat/task/actions/taskRegistry"
import { formatResponse } from "@features/settings/context/responses"

/**
 * Resumes a task from saved history.
 * Cleans up task messages, reconstructs API conversation history,
 * and prompts the user to resume or continue the task.
 */
export async function resumeTaskFromHistory(task: ITaskModel): Promise<void> {
	const modifiedClineMessages = await cleanResumeMessages(task)
	pruneEmptyApiReqStarted(modifiedClineMessages)
	await overwriteMessages(task.taskId, modifiedClineMessages)
	task.apiConversationHistory =
		modifiedClineMessages as never as import("@features/chat/task/messages/actions/save").ApiMessage[]

	task.apiConversationHistory =
		(await task.getSavedApiConversationHistory?.()) as import("@features/chat/task/messages/actions/save").ApiMessage[]

	const lastClineMessage = task.messages
		.slice()
		.reverse()
		.find((m) => m.ask !== "resume_task" && m.ask !== "resume_completed_task")

	const askType = determineAskType(lastClineMessage)
	const { response, text, images } = await ask(task.taskId, askType)

	let responseText: string | undefined
	let responseImages: string[] | undefined

	if (response === "messageResponse") {
		await userBroadcast(task.taskId, "user_feedback", text, images)
		responseText = text
		responseImages = images
	}

	const existingApiConversationHistory: import("@features/chat/task/messages/actions/save").ApiMessage[] =
		(await task.getSavedApiConversationHistory?.()) as import("@features/chat/task/messages/actions/save").ApiMessage[]

	const { modifiedHistory, oldContent } = prepareResumeContent(existingApiConversationHistory)

	let newUserContent: Anthropic.Messages.ContentBlockParam[] = [...oldContent]

	if (responseText) {
		newUserContent.push({
			type: "text",
			text: `<user_message>\n${responseText}\n</user_message>`,
		})
	}

	if (responseImages && responseImages.length > 0) {
		newUserContent.push(...formatResponse.imageBlocks(responseImages))
	}

	if (newUserContent.length === 0) {
		newUserContent.push({
			type: "text",
			text: "[TASK RESUMPTION] Resuming task...",
		})
	}

	await overwriteApiConversationHistory(task, modifiedHistory)

	const store = getBackendRootStore()
	registerTask(task.taskId, task)

	store.intentStore.createIntent({
		id: crypto.randomUUID(),
		type: IntentType.UserMessageReceived,
		payload: {
			taskId: task.taskId,
			content: newUserContent,
		},
		status: IntentStatus.Queued,
		createdAt: Date.now(),
	})
}

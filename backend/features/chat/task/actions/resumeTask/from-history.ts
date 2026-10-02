import { Anthropic } from "@anthropic-ai/sdk"

import { IntentType, IntentStatus } from "@jabberwock/types"

import type { ITaskModel } from "@features/chat/task"

import {
	cleanResumeMessages,
	pruneEmptyApiReqStarted,
	determineAskType,
	isResumeAskMessage,
	prepareResumeContent,
} from "./helpers"
import { overwriteMessages } from "@features/chat"
import { overwriteApiConversationHistory } from "@features/chat"
import { ask } from "@features/chat/task/notifications/actions/ask"
import { emitBroadcast } from "@features/chat/task/messages/actions/say"
import { getStore } from "@features/singleton"
import { registerTask } from "@features/chat"
import { formatResponse } from "@features/settings"

/**
 * Restores the task's persisted messages into the live MST notifications store
 * (non-blocking, does NOT wait on user input). This is the part of resuming that
 * makes the conversation visible in the webview. Split out from
 * `resumeTaskFromHistory` so the show-task handler can push state to the webview
 * BEFORE the blocking `await ask(...)` resume prompt.
 */
export async function restoreTaskMessages(task: ITaskModel): Promise<void> {
	const modifiedClineMessages = await cleanResumeMessages(task)
	pruneEmptyApiReqStarted(modifiedClineMessages)
	await overwriteMessages(task.taskId, modifiedClineMessages)
}

/**
 * Resumes a task from "saved" history.
 * Cleans up task messages, reconstructs API conversation history,
 * and prompts the user to resume or continue the task.
 */
export async function resumeTaskFromHistory(task: ITaskModel): Promise<void> {
	await restoreTaskMessages(task)

	const existingApiConversationHistory: import("@features/chat/task/messages/actions/save").ApiMessage[] =
		(await task.getSavedApiConversationHistory?.()) as import("@features/chat/task/messages/actions/save").ApiMessage[]
	// Volatile MST field — must be set through an action (direct assignment throws in strict mode).
	task.setApiConversationHistory(existingApiConversationHistory)

	const lastClineMessage = task.messages
		.slice()
		.reverse()
		.find((m) => !isResumeAskMessage(m))

	const askType = determineAskType(lastClineMessage)
	const { response, text, images } = await ask(task.taskId, askType)

	let responseText: string | undefined
	let responseImages: string[] | undefined

	if (response === "messageResponse") {
		await emitBroadcast("user", task.taskId, "user_feedback", text, images)
		responseText = text
		responseImages = images
	}

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

	const store = getStore()
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

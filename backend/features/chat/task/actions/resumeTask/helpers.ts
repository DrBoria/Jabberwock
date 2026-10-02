import { Anthropic } from "@anthropic-ai/sdk"

import type { Notification, NotificationAsk, ApiReqData } from "@jabberwock/types"

import type { ApiMessage } from "@features/chat"

import { findLastIndex } from "@shared/core/array"
import type { ITaskModel } from "@features/chat/task"

import {
	ResumeHandlerResult,
	asContentBlocks,
	previousAssistantContent,
	classifySummary,
	classifyAssistantWithTools,
	classifyAssistantNoTools,
	classifyUserWithMissingTools,
	classifyUserNoTools,
} from "./rebuild"

/**
 * True if the notification is a resume prompt (resume_task / resume_completed_task).
 */
export function isResumeAskMessage(message: Notification): boolean {
	return message.ask === "resume_task" || message.ask === "resume_completed_task"
}

/**
 * Removes resume-task messages and trailing reasoning messages from "saved" messages.
 */
export async function cleanResumeMessages(task: ITaskModel): Promise<Notification[]> {
	const messages = (await task.getSavedMessages?.()) ?? []

	const lastRelevantIndex = findLastIndex(messages, (m) => !isResumeAskMessage(m))
	if (lastRelevantIndex !== -1) {
		messages.splice(lastRelevantIndex + 1)
	}

	while (messages.length > 0) {
		const last = messages[messages.length - 1]
		if (last.type === "say" && last.say === "reasoning") {
			messages.pop()
		} else {
			break
		}
	}

	return messages
}

/**
 * Removes an `api_req_started` notification if it has no cost and no cancel reason,
 * indicating an API request that streamed no partial content.
 */
export function pruneEmptyApiReqStarted(messages: Notification[]): void {
	const lastApiReqStartedIndex = findLastIndex(messages, (m) => m.type === "say" && m.say === "api_req_started")
	if (lastApiReqStartedIndex === -1) {
		return
	}
	const lastApiReqStarted = messages[lastApiReqStartedIndex]
	const { cost, cancelReason }: ApiReqData = JSON.parse(lastApiReqStarted.text || "{}")
	if (cost === undefined && cancelReason === undefined) {
		messages.splice(lastApiReqStartedIndex, 1)
	}
}

/**
 * Determines the resume ask type based on the last non-resume message.
 */
export function determineAskType(lastClineMessage: Notification | undefined): NotificationAsk {
	if (lastClineMessage?.ask === "completion_result") {
		return "resume_completed_task" as NotificationAsk
	}
	return "resume_task"
}

/**
 * Determines the handler key for the resume dispatch map based on the last message's type and content.
 */
export function resolveResumeHandlerKey(lastMessage: ApiMessage, history: ApiMessage[]): string {
	if (lastMessage.isSummary) {
		return "summary"
	}
	if (lastMessage.role === "assistant") {
		const content = asContentBlocks(lastMessage)
		return content.some((b) => b.type === "tool_use") ? "assistant_with_tools" : "assistant_no_tools"
	}
	if (lastMessage.role === "user") {
		const assistantContent = previousAssistantContent(history)
		return assistantContent.some((b) => b.type === "tool_use") ? "user_with_missing_tools" : "user_no_tools"
	}
	throw new Error("Unexpected: Last message is not a user or assistant message")
}

/**
 * Processes the existing API conversation history to prepare the resume content.
 */
export function prepareResumeContent(history: ApiMessage[]): {
	modifiedHistory: ApiMessage[]
	oldContent: Anthropic.Messages.ContentBlockParam[]
} {
	if (history.length === 0) {
		throw new Error("Unexpected: No existing API conversation history")
	}

	const lastMessage = history[history.length - 1]

	const RESUME_HANDLERS: Record<string, (msg: ApiMessage, h: ApiMessage[]) => ResumeHandlerResult> = {
		summary: classifySummary,
		assistant_with_tools: classifyAssistantWithTools,
		assistant_no_tools: classifyAssistantNoTools,
		user_with_missing_tools: classifyUserWithMissingTools,
		user_no_tools: classifyUserNoTools,
	}

	const key = resolveResumeHandlerKey(lastMessage, history)
	const result = RESUME_HANDLERS[key](lastMessage, history)

	return { modifiedHistory: result.history, oldContent: result.oldContent }
}

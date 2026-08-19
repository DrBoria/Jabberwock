import { Anthropic } from "@anthropic-ai/sdk"

import type { Notification, NotificationAsk, ApiReqData } from "@jabberwock/types"

import type { ApiMessage } from "@features/chat/task/messages/actions/save/saveApiMessages.types"

import { findLastIndex } from "@shared/array"
import type { ITaskModel } from "@features/chat/task/store"

import {
	ResumeHandlerResult,
	handleSummary,
	handleAssistantWithTools,
	handleAssistantNoTools,
	handleUserWithMissingTools,
	handleUserNoTools,
} from "./resumeTask.handlers"

/**
 * Removes resume-task messages and trailing reasoning messages from saved messages.
 */
export async function cleanResumeMessages(task: ITaskModel): Promise<Notification[]> {
	const messages = (await task.getSavedMessages?.()) ?? []

	const lastRelevantIndex = findLastIndex(
		messages,
		(m) => m.ask !== "resume_task" && m.ask !== "resume_completed_task",
	)
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
 * Formats a timestamp into a human-readable relative time string.
 */
export function formatAgoText(timestamp: number | undefined): string {
	if (timestamp === undefined) {
		return "just now"
	}
	const diff = Date.now() - timestamp
	const minutes = Math.floor(diff / 60000)
	const hours = Math.floor(minutes / 60)
	const days = Math.floor(hours / 24)

	if (days > 0) {
		return `${days} day${days > 1 ? "s" : ""} ago`
	}
	if (hours > 0) {
		return `${hours} hour${hours > 1 ? "s" : ""} ago`
	}
	if (minutes > 0) {
		return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
	}
	return "just now"
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
		const previousAssistantMessage = history[history.length - 2]
		if (previousAssistantMessage && previousAssistantMessage.role === "assistant") {
			const assistantContent = asContentBlocks(previousAssistantMessage)
			return assistantContent.some((b) => b.type === "tool_use") ? "user_with_missing_tools" : "user_no_tools"
		}
		return "user_no_tools"
	}
	throw new Error("Unexpected: Last message is not a user or assistant message")
}

function asContentBlocks(message: { content?: string | unknown[] }): Anthropic.Messages.ContentBlockParam[] {
	if (Array.isArray(message.content)) {
		return message.content as Anthropic.Messages.ContentBlockParam[]
	}
	return [{ type: "text" as const, text: (message.content as string) ?? "" }]
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
		summary: handleSummary,
		assistant_with_tools: handleAssistantWithTools,
		assistant_no_tools: handleAssistantNoTools,
		user_with_missing_tools: handleUserWithMissingTools,
		user_no_tools: handleUserNoTools,
	}

	const key = resolveResumeHandlerKey(lastMessage, history)
	const result = RESUME_HANDLERS[key](lastMessage, history)

	return { modifiedHistory: result.history, oldContent: result.oldContent }
}

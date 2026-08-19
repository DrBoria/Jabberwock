import type { ExtensionMessage, Notification, NotificationAsk, NotificationSay } from "@jabberwock/types"
import { consolidateTokenUsage, consolidateApiRequests, consolidateCommands } from "@jabberwock/core/cli"

import type { TUIMessage, TaskHistoryItem } from "../types.js"
import { cliStore } from "../store.js"
import { formatToolOutput } from "./tools.js"

export function processResumeTask(messageId: string, seenMessageIds: React.MutableRefObject<Set<string>>): void {
	seenMessageIds.current.add(messageId)
	cliStore.isLoading = false
	cliStore.hasStartedTask = true
	cliStore.isResumingTask = false
}

export function processCompletionResult(
	ts: number,
	text: string,
	messageId: string,
	addMessage: (msg: TUIMessage) => void,
	seenMessageIds: React.MutableRefObject<Set<string>>,
): void {
	seenMessageIds.current.add(messageId)
	cliStore.isComplete = true
	cliStore.isLoading = false

	try {
		const completionInfo = JSON.parse(text) as Record<string, unknown>
		addMessage({
			id: messageId,
			role: "tool",
			content: text,
			toolName: "attempt_completion",
			toolDisplayName: "Task Complete",
			toolDisplayOutput: formatToolOutput({ tool: "attempt_completion", ...completionInfo }),
			originalType: "completion_result" as NotificationAsk,
			toolData: {
				tool: "attempt_completion",
				result: completionInfo.result as string | undefined,
				content: completionInfo.result as string | undefined,
			},
		})
	} catch {
		addMessage({
			id: messageId,
			role: "tool",
			content: text || "Task completed",
			toolName: "attempt_completion",
			toolDisplayName: "Task Complete",
			toolDisplayOutput: "✅ Task completed",
			originalType: "completion_result" as NotificationAsk,
			toolData: { tool: "attempt_completion", content: text },
		})
	}
}

function processStateMessages(
	messages: Notification[] | undefined,
	handleSayMessage: (ts: number, say: NotificationSay, text: string, partial: boolean) => void,
	handleAskMessage: (ts: number, ask: NotificationAsk, text: string, partial: boolean) => void,
): void {
	if (!messages) {
		return
	}

	for (const notification of messages) {
		const { ts, type, say, ask, text = "", partial = false } = notification

		if (type === "say" && say) {
			handleSayMessage(ts, say, text, partial)
		} else if (type === "ask" && ask) {
			handleAskMessage(ts, ask, text, partial)
		}
	}

	if (messages.length > 1) {
		const processed = consolidateApiRequests(consolidateCommands(messages.slice(1) as Notification[]))
		const metrics = consolidateTokenUsage(processed)
		cliStore.tokenUsage = metrics
	}
}

export function handleStateExtension(
	msg: ExtensionMessage,
	handleSayMessage: (ts: number, say: NotificationSay, text: string, partial: boolean) => void,
	handleAskMessage: (ts: number, ask: NotificationAsk, text: string, partial: boolean) => void,
): void {
	const state = msg.state

	if (!state) {
		return
	}

	if (state.mode) {
		cliStore.currentMode = state.mode
	}

	if (state.taskHistory && Array.isArray(state.taskHistory)) {
		cliStore.setTaskHistory(state.taskHistory as TaskHistoryItem[])
	}

	processStateMessages(state.messages, handleSayMessage, handleAskMessage)

	if (cliStore.isResumingTask) {
		cliStore.isResumingTask = false
	}
}

export function handleMessageUpdatedExtension(
	msg: ExtensionMessage,
	handleSayMessage: (ts: number, say: NotificationSay, text: string, partial: boolean) => void,
	handleAskMessage: (ts: number, ask: NotificationAsk, text: string, partial: boolean) => void,
): void {
	if (!msg.message) {
		return
	}

	const { ts, type, say, ask, text = "", partial = false } = msg.message

	if (type === "say" && say) {
		handleSayMessage(ts, say, text, partial)
	} else if (type === "ask" && ask) {
		handleAskMessage(ts, ask, text, partial)
	}
}

import { Anthropic } from "@anthropic-ai/sdk"
import { serializeError } from "serialize-error"

import { type Notification } from "@jabberwock/types"

import { GroundingSource } from "@api/transform/stream"
import { findLastIndex } from "@shared/array"
import { t } from "@i18n"

import type { ITaskModel } from "@features/chat/task/store"
import { presentAssistantMessage } from "@features/chat/task/messages/actions"
import { parseFinalToolCall } from "./parse-tool-call"
import type { ToolUse, McpToolUse } from "@shared/tools"
import type { AssistantMessageContent } from "@features/chat/task/messages/actions/types"
import { diagnosticsManager } from "@jabberwock/devtool"

import { buildAssistantContentForApi, enforceNewTaskIsolation, saveAssistantMessageToHistory } from "./tool-executor"
import { type TaskDelegate } from "@features/chat/task/condense/actions/types"
import { sendStateWithoutTaskHistory } from "@features/chat/task/messages/events/actions/sendMessageEvent"
import { agentBroadcast } from "@features/chat/task/messages/actions/say"
import { saveMessages } from "@features/chat/task/messages/actions/saveMessages"
import { updateMessage } from "@features/chat/task/messages/actions/updateMessage"
import { getBackendRootStore } from "@features/storeSingleton"
import { getTask as getRegisteredTask } from "@features/chat/task/actions/taskRegistry"
import { type StreamResult } from "@features/api/handlers/stream/types"

// ── E.4: finalizeToolCalls ─────────────────────────────────────────────────────

/**
 * Finalizes tool calls after streaming completes.
 *
 * Handles:
 * - Finalizing streaming tool call indices
 * - Reasoning message completion
 * - Grounding source display
 * - Building assistant content for API
 * - Saving assistant message to history
 */
export async function finalizeToolCalls(taskId: string, result: StreamResult): Promise<void> {
	const task = getRegisteredTask(taskId)!
	const delegate = task as ITaskModel & TaskDelegate
	const store = getBackendRootStore()
	const messages = [...store.chat.tasks.get(taskId)!.notifications.items]

	if (task._state.abort || task._state.abandoned) {
		throw new Error(`[finalizeToolCalls] task ${task.taskId}.${task.instanceId} aborted`)
	}

	task._state.setDidCompleteReadingStream(true)

	processStreamingToolCalls(delegate, delegate, result)
	markPartialBlocksComplete(delegate)

	await finalizeReasoningMessage(result, messages, store, delegate)

	await saveMessages(task.taskId)
	sendStateWithoutTaskHistory()

	await finalizeAssistantContent(delegate, delegate, result)
	presentCompletedPartialBlocks(delegate, delegate)
}

function processStreamingToolCalls(
	task: ITaskModel & TaskDelegate,
	delegate: ITaskModel & TaskDelegate,
	result: StreamResult,
): void {
	const finalizeEvents = result.rawChunkTracker.finalize()
	for (const event of finalizeEvents) {
		if (event.type !== "tool_call_end") continue
		const store = getBackendRootStore()
		const tc = store.chat.streamingToolCalls.get(event.id)
		const finalToolUse = tc ? parseFinalToolCall(event.id, tc.name, tc.argumentsAccumulator) : null
		if (tc) store.chat.finalizeToolCall(event.id)
		const streamingToolCallIndices = task._state.streamingToolCallIndices
		const toolUseIndex = streamingToolCallIndices[event.id]

		if (finalToolUse) {
			applyFinalToolUse(delegate, event, finalToolUse, toolUseIndex, streamingToolCallIndices, task)
		} else if (toolUseIndex !== undefined) {
			applyFallbackToolUse(delegate, event, toolUseIndex, streamingToolCallIndices, task)
		}
	}
}

function applyFinalToolUse(
	delegate: ITaskModel & TaskDelegate,
	event: { id: string },
	finalToolUse: object,
	toolUseIndex: number | undefined,
	streamingToolCallIndices: Record<string, number>,
	task: ITaskModel & TaskDelegate,
): void {
	;(finalToolUse as { id: string }).id = event.id
	const assistantMsgContentFinal = delegate.assistantMessageContent
	if (toolUseIndex !== undefined) {
		assistantMsgContentFinal[toolUseIndex] = finalToolUse as AssistantMessageContent
	}
	delete streamingToolCallIndices[event.id]
	task._state.setUserMessageContentReady(true)
	presentAssistantMessage(task)
}

function applyFallbackToolUse(
	delegate: ITaskModel & TaskDelegate,
	event: { id: string },
	toolUseIndex: number,
	streamingToolCallIndices: Record<string, number>,
	task: ITaskModel & TaskDelegate,
): void {
	const assistantMsgContentFinal = delegate.assistantMessageContent
	const existingToolUse = assistantMsgContentFinal[toolUseIndex]
	if (existingToolUse && existingToolUse.type === "tool_use") {
		existingToolUse.partial = false
		;(existingToolUse as { id: string }).id = event.id
	}
	delete streamingToolCallIndices[event.id]
	task._state.setUserMessageContentReady(true)
	presentAssistantMessage(task)
}

function markPartialBlocksComplete(delegate: ITaskModel & TaskDelegate): void {
	const assistantMsgContentFinal = delegate.assistantMessageContent
	const partialBlocks = assistantMsgContentFinal.filter((block: AssistantMessageContent) =>
		block.type === "tool_use" || block.type === "mcp_tool_use" ? (block as ToolUse | McpToolUse).partial : false,
	)
	partialBlocks.forEach((block: AssistantMessageContent) => {
		if (block.type === "tool_use" || block.type === "mcp_tool_use") {
			;(block as ToolUse | McpToolUse).partial = false
		}
	})
}

async function finalizeReasoningMessage(
	result: StreamResult,
	messages: Notification[],
	store: ReturnType<typeof getBackendRootStore>,
	task: ITaskModel & TaskDelegate,
): Promise<void> {
	if (!result.reasoningMessage) return
	const lastReasoningIndex = findLastIndex(
		messages,
		(m: (typeof messages)[number]) => m.type === "say" && m.say === "reasoning",
	)
	if (lastReasoningIndex === -1 || !messages[lastReasoningIndex].partial) return
	const updatedMessage: Notification = { ...messages[lastReasoningIndex], partial: false }
	const taskNotifications = store.chat.tasks.get(task.taskId)?.notifications
	if (!taskNotifications) return
	const mIndex = taskNotifications.items.findIndex((n: Notification) => n.ts === updatedMessage.ts)
	if (mIndex === -1) return
	taskNotifications.updateNotification(mIndex, updatedMessage)
	await updateMessage(task.taskId, updatedMessage)
}

async function finalizeAssistantContent(
	task: ITaskModel & TaskDelegate,
	delegate: ITaskModel & TaskDelegate,
	result: StreamResult,
): Promise<void> {
	const assistantMsgContentFinal = delegate.assistantMessageContent
	const hasTextContent = result.assistantMessage.length > 0
	const hasToolUses = assistantMsgContentFinal.some(
		(block: AssistantMessageContent) => block.type === "tool_use" || block.type === "mcp_tool_use",
	)
	if (!hasTextContent && !hasToolUses) return

	task._state.setConsecutiveNoAssistantMessagesCount(0)

	if (result.pendingGroundingSources.length > 0) {
		await displayGroundingSources(task, result)
	}

	const assistantContent = buildAssistantContentForApi(task, result.assistantMessage)
	enforceNewTaskIsolation(task, assistantContent)
	await saveAssistantMessageToHistory(task, assistantContent, result.reasoningMessage)
}

async function displayGroundingSources(task: ITaskModel & TaskDelegate, result: StreamResult): Promise<void> {
	const citationLinks = result.pendingGroundingSources.map(
		(source: GroundingSource, i: number) => `[${i + 1}](${source.url})`,
	)
	const sourcesText = `${t("common:gemini.sources")}\n${citationLinks.join("\n")}`
	await agentBroadcast(task.taskId, "text", sourcesText, undefined, false, undefined, undefined, {
		isNonInteractive: true,
	})
}

function presentCompletedPartialBlocks(task: ITaskModel & TaskDelegate, delegate: ITaskModel & TaskDelegate): void {
	const partialBlocks = delegate.assistantMessageContent.filter((block: AssistantMessageContent) =>
		block.type === "tool_use" || block.type === "mcp_tool_use" ? (block as ToolUse | McpToolUse).partial : false,
	)
	if (partialBlocks.length > 0 && delegate.assistantMessageContent.length > 0) {
		console.log(
			`[DEBUG: TaskLoop#${task.taskId}] Phase: Tool Execution Start (Blocks: ${String(delegate.assistantMessageContent.length)})`,
		)
		presentAssistantMessage(task)
	}
}

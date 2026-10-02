import { type Notification } from "@jabberwock/types"
import { t } from "@i18n"

import { GroundingSource } from "@api/transform/stream"

import type { ITaskModel } from "@features/chat/task"
import { presentAssistantMessage } from "@features/chat/task/messages/actions"
import { parseFinalToolCall } from "./parseToolCall"
import type { ToolUse, McpToolUse } from "@shared/tools"
import type { AssistantMessageContent } from "@features/chat/task/messages/actions/buildMessageTypes"

import { buildAssistantContentForApi, enforceNewTaskIsolation, saveAssistantMessageToHistory } from "./toolExecutor"
import { type TaskDelegate } from "@features/chat/task/condense/types"
import { sendStateWithoutTaskHistory } from "@features/chat/task/messages/events/actions/sendMessageEvent"
import { emitBroadcast } from "@features/chat/task/messages/actions/say"
import { saveMessages } from "@features/chat/task/messages/actions/save"
import { updateMessage } from "@features/chat/task/messages/actions"
import { getStore } from "@features/singleton"
import { getTask as getRegisteredTask } from "@features/chat"
import { type StreamResult } from "@features/api"

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

	if (task._state.abort || task._state.abandoned) {
		throw new Error(`[finalizeToolCalls] task ${task.taskId}.${task.instanceId} aborted`)
	}

	task._state.setDidCompleteReadingStream(true)

	processStreamingToolCalls(delegate, delegate, result)
	markPartialBlocksComplete(delegate)

	await finalizePartialNotifications(taskId)

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
		const store = getStore()
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
	task._state.deleteStreamingToolCallIndex(event.id)
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
	task._state.deleteStreamingToolCallIndex(event.id)
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

/**
 * Finalize every still-partial say notification (the live "reasoning" row, and
 * any partial "text" rows) in the per-task store, and push the finalized
 * content to the webview.
 *
 * Runs at the end of each stream, BEFORE `saveMessages`, so the persisted
 * `ui_messages.json` always holds `partial: false` for completed rows. The
 * previous implementation only finalized the single LAST reasoning row, gated
 * on `result.reasoningMessage` being non-empty and on a ts lookup against a
 * messages snapshot taken before this phase — earlier turns' reasoning rows
 * (and, when the gate missed, even the current one) persisted as
 * `partial: true`, which the frontend renders differently after a reload.
 */
async function finalizePartialNotifications(taskId: string): Promise<void> {
	const taskNotifications = getStore().chat.tasks.get(taskId)?.notifications
	if (!taskNotifications) return
	const items = taskNotifications.items
	for (let i = 0; i < items.length; i++) {
		const n = items[i]
		if (n.type === "say" && n.partial === true) {
			const updatedMessage: Notification = { ...n, partial: false }
			taskNotifications.updateNotification(i, updatedMessage)
			await updateMessage(taskId, updatedMessage)
		}
	}
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
	await emitBroadcast("agent", task.taskId, "text", sourcesText, undefined, false, undefined, undefined, {
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

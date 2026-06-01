import { Anthropic } from "@anthropic-ai/sdk"
import { serializeError } from "serialize-error"

import { type Notification } from "@jabberwock/types"

import { GroundingSource } from "../../../../api/transform/stream"
import { findLastIndex } from "../../../../shared/array"
import { t } from "../../../../i18n"

import type { ITaskModel } from "../../task/store"
import { presentAssistantMessage } from "../../../../features/chat/task/messages/actions"
import { parseFinalToolCall } from "./tool-parser"
import type { ToolUse, McpToolUse } from "../../../../shared/tools"
import type { AssistantMessageContent } from "../../task/messages/actions/types"
import { diagnosticsManager } from "@jabberwock/devtool"

import { buildAssistantContentForApi, enforceNewTaskIsolation, saveAssistantMessageToHistory } from "./toolCallExecutor"
import { type TaskDelegate } from "../../task/condense/actions/types"
import { postStateToWebviewWithoutTaskHistory } from "../../../foundation/window-manager/store"
import { agentBroadcast } from "../../task/messages/actions/say"
import { saveMessages } from "../../task/messages/actions/persistMessages"
import { updateMessage } from "../../task/messages/actions/updateMessage"
import { getBackendRootStore } from "@features/storeSingleton"
import { getTask as getRegisteredTask } from "../../task/actions/taskRegistry"
import { type StreamResult } from "../../../api/handlers/helpers/handleStream"

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

	// Finalize any remaining streaming tool calls that weren't explicitly ended
	const finalizeEvents = result.rawChunkTracker.finalize()
	for (const event of finalizeEvents) {
		if (event.type === "tool_call_end") {
			const store = getBackendRootStore()
			const tc = store.chat.streamingToolCalls.get(event.id)
			const finalToolUse = tc ? parseFinalToolCall(event.id, tc.name, tc.argumentsAccumulator) : null
			if (tc) {
				store.chat.finalizeToolCall(event.id)
			}
			const streamingToolCallIndices = delegate.streamingToolCallIndices
			const toolUseIndex = streamingToolCallIndices.get(event.id)

			if (finalToolUse) {
				;(finalToolUse as { id: string }).id = event.id
				const assistantMsgContentFinal = delegate.assistantMessageContent
				if (toolUseIndex !== undefined) {
					assistantMsgContentFinal[toolUseIndex] = finalToolUse as typeof finalToolUse
				}
				streamingToolCallIndices.delete(event.id)
				task._state.setUserMessageContentReady(true)
				presentAssistantMessage(task)
			} else if (toolUseIndex !== undefined) {
				const assistantMsgContentFinal = delegate.assistantMessageContent
				const existingToolUse = assistantMsgContentFinal[toolUseIndex]
				if (existingToolUse && existingToolUse.type === "tool_use") {
					existingToolUse.partial = false
					;(existingToolUse as { id: string }).id = event.id
				}
				streamingToolCallIndices.delete(event.id)
				task._state.setUserMessageContentReady(true)
				presentAssistantMessage(task)
			}
		}
	}

	// Capture partial blocks AFTER finalizeRawChunks() to avoid double-presentation
	const assistantMsgContentFinal = delegate.assistantMessageContent
	const partialBlocks = assistantMsgContentFinal.filter((block: AssistantMessageContent) =>
		block.type === "tool_use" || block.type === "mcp_tool_use" ? (block as ToolUse | McpToolUse).partial : false,
	)
	partialBlocks.forEach((block: AssistantMessageContent) => {
		if (block.type === "tool_use" || block.type === "mcp_tool_use") {
			;(block as ToolUse | McpToolUse).partial = false
		}
	})

	// Complete the reasoning message if it exists
	if (result.reasoningMessage) {
		const lastReasoningIndex = findLastIndex(
			messages,
			(m: (typeof messages)[number]) => m.type === "say" && m.say === "reasoning",
		)
		if (lastReasoningIndex !== -1 && messages[lastReasoningIndex].partial) {
			messages[lastReasoningIndex].partial = false
			await updateMessage(task.taskId, messages[lastReasoningIndex])
		}
	}

	await saveMessages(task.taskId)
	await postStateToWebviewWithoutTaskHistory(delegate.providerRef.deref()!)

	// Check if we have any content to process (text or tool uses)
	const hasTextContent = result.assistantMessage.length > 0
	const hasToolUses = assistantMsgContentFinal.some(
		(block: AssistantMessageContent) => block.type === "tool_use" || block.type === "mcp_tool_use",
	)

	if (hasTextContent || hasToolUses) {
		// Reset counter when we get a successful response with content
		task._state.setConsecutiveNoAssistantMessagesCount(0)

		// Display grounding sources to the user if they exist
		if (result.pendingGroundingSources.length > 0) {
			const citationLinks = result.pendingGroundingSources.map(
				(source: GroundingSource, i: number) => `[${i + 1}](${source.url})`,
			)
			const sourcesText = `${t("common:gemini.sources")}\n${citationLinks.join("\n")}`
			await agentBroadcast(task.taskId, "text", sourcesText, undefined, false, undefined, undefined, {
				isNonInteractive: true,
			})
		}

		// Build the assistant message content array
		const assistantContent = buildAssistantContentForApi(task, result.assistantMessage)

		// Enforce new_task isolation
		enforceNewTaskIsolation(task, assistantContent)

		// Save assistant message BEFORE executing tools
		await saveAssistantMessageToHistory(task, assistantContent, result.reasoningMessage)
	}

	// Present any partial blocks that were just completed
	if (partialBlocks.length > 0) {
		if (assistantMsgContentFinal.length > 0) {
			console.log(
				`[DEBUG: TaskLoop#${task.taskId}] Phase: Tool Execution Start (Blocks: ${String(assistantMsgContentFinal.length)})`,
			)
			presentAssistantMessage(task)
		}
	}
}

import type { ITaskModel } from "@features/chat/task/store"
import type { AssistantMessageContent } from "@features/chat/task/messages/actions/types"
import type { ToolUse, McpToolUse } from "@shared/tools"

import { handleMcpToolUse } from "./mcpToolUse"
import { handleTextBlockContent } from "./textBlockHandler"
import { handleToolBlock } from "./toolExecution"

/** Recursion depth counter for presentAssistantMessage to prevent infinite re-entry loops */
export let presentAssistantMessageRecursionDepth = 0

async function dispatchBlockByType(task: ITaskModel, block: AssistantMessageContent): Promise<void> {
	switch (block.type) {
		case "mcp_tool_use": {
			await handleMcpToolUse(task, block as McpToolUse)
			break
		}
		case "text": {
			await handleTextBlockContent(task, block)
			break
		}
		case "tool_use": {
			await handleToolBlock(task, block as ToolUse)
			break
		}
	}
}

function advanceMessageIndex(task: ITaskModel, block: AssistantMessageContent): void {
	if (!block.partial || task._state.didRejectTool || task._state.didAlreadyUseTool) {
		if (task._state.currentStreamingContentIndex === task.assistantMessageContent.length - 1) {
			task._state.setUserMessageContentReady(true)
		}

		task._state.setCurrentStreamingContentIndex(task._state.currentStreamingContentIndex + 1)

		if (task._state.currentStreamingContentIndex < task.assistantMessageContent.length) {
			presentAssistantMessage(task)
		} else if (task._state.didCompleteReadingStream) {
			task._state.setUserMessageContentReady(true)
		}
	}
}

function handlePendingUpdates(task: ITaskModel): void {
	if (task._state.presentAssistantMessageHasPendingUpdates) {
		task._state.setPresentAssistantMessageHasPendingUpdates(false)
		presentAssistantMessage(task)
	}
}

export async function presentAssistantMessage(task: ITaskModel): Promise<void> {
	if (task._state.abort) {
		throw new Error(`[Task#presentAssistantMessage] task ${task.taskId}.${task.instanceId} aborted`)
	}

	if (presentAssistantMessageRecursionDepth > 10) {
		console.error(
			`[jabberwock] [presentAssistantMessage] Recursion depth exceeded (${presentAssistantMessageRecursionDepth}), aborting to prevent infinite loop`,
		)
		task._state.setPresentAssistantMessageLocked(false)
		return
	}
	presentAssistantMessageRecursionDepth++

	try {
		if (task._state.presentAssistantMessageLocked) {
			task._state.setPresentAssistantMessageHasPendingUpdates(true)
			return
		}

		task._state.setPresentAssistantMessageLocked(true)
		task._state.setPresentAssistantMessageHasPendingUpdates(false)

		if (task._state.currentStreamingContentIndex >= task.assistantMessageContent.length) {
			if (task._state.didCompleteReadingStream) {
				task._state.setUserMessageContentReady(true)
			}

			task._state.setPresentAssistantMessageLocked(false)
			return
		}

		let block: AssistantMessageContent
		try {
			block = { ...task.assistantMessageContent[task._state.currentStreamingContentIndex] }
		} catch (error) {
			console.error(`[jabberwock] ERROR cloning block:`, error)
			console.error(
				`Block content:`,
				JSON.stringify(task.assistantMessageContent[task._state.currentStreamingContentIndex], null, 2),
			)
			task._state.setPresentAssistantMessageLocked(false)
			return
		}

		await dispatchBlockByType(task, block)

		task._state.setPresentAssistantMessageLocked(false)

		advanceMessageIndex(task, block)

		handlePendingUpdates(task)
	} catch (error) {
		console.error(`[jabberwock] [presentAssistantMessage] Error processing assistant message:`, error)
		task._state.setPresentAssistantMessageLocked(false)
		task._state.setUserMessageContentReady(true)
	} finally {
		presentAssistantMessageRecursionDepth--
	}
}

export { dispatchBlockByType, advanceMessageIndex, handlePendingUpdates }

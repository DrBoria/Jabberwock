import { Anthropic } from "@anthropic-ai/sdk"
import { IntentType, IntentStatus } from "@jabberwock/types"

import type { ITaskModel } from "@features/chat/task"
import type { ToolUse, McpToolUse } from "@shared/tools"

import { formatResponse } from "@features/settings"
import { normalizeCompletionText } from "@utils/text"
import { emitBroadcast } from "@features/chat/task/messages/actions/say"
import { getStore } from "@features/singleton"
import { pushToolResultToUserContent } from "@features/api"

function isPendingInteractiveApp(task: ITaskModel): boolean {
	const messages = task.messages
	const lastMsg = messages?.[messages.length - 1]
	return lastMsg?.type === "ask" && lastMsg?.ask === "interactive_app" && task.askResolve !== null
}

async function handleToolExecutionTimeout(task: ITaskModel): Promise<void> {
	if (isPendingInteractiveApp(task)) {
		return
	}

	const assistantMsgContent = task.assistantMessageContent
	console.error(
		`[Task#${task.taskId}] pWaitFor(userMessageContentReady) timed out. ` +
			`Current Index: ${String(task._state.currentStreamingContentIndex)}, ` +
			`Blocks: ${String(assistantMsgContent.length)}, ` +
			`Locked: ${String(task._state.presentAssistantMessageLocked)}, ` +
			`didAlreadyUseTool: ${String(task._state.didAlreadyUseTool)}`,
	)

	const userMessageContent = task.userMessageContent
	if (task._state.presentAssistantMessageLocked && userMessageContent.length === 0) {
		const pendingTools = assistantMsgContent.filter(
			(block): block is ToolUse | McpToolUse =>
				(block.type === "tool_use" || block.type === "mcp_tool_use") &&
				!block.partial &&
				(block as ToolUse).id !== undefined,
		)
		for (const toolUse of pendingTools) {
			console.warn(
				`[Task#${task.taskId}] Pushing error tool_result for timed-out tool: ${String(toolUse.name ?? "unknown")} (id: ${String(toolUse.id)})`,
			)
			pushToolResultToUserContent(task.userMessageContent, {
				type: "tool_result",
				tool_use_id: toolUse.id as string,
				content:
					"[Error] Tool execution timed out after 60 seconds while waiting for approval. " +
					"The task will continue without this tool's result. " +
					"If you still want to run this tool, please create a new task.",
				is_error: true,
			})
		}
		task._state.setPresentAssistantMessageLocked(false)
		task._state.setCurrentStreamingContentIndex(assistantMsgContent.length)
	}

	task._state.setUserMessageContentReady(true)
}

async function pollForUserMessageContentReady(task: ITaskModel): Promise<void> {
	let waitStartTime = Date.now()
	while (!task._state.userMessageContentReady && !task._state.abort) {
		const elapsed = Date.now() - waitStartTime
		if (elapsed >= 60_000) {
			await handleToolExecutionTimeout(task)
			return
		}
		await new Promise((resolve) => setTimeout(resolve, 100))
	}
	console.log(`[Task#${task.taskId}] pWaitFor(userMessageContentReady) unblocked.`)
}

async function handleNoToolUse(task: ITaskModel): Promise<void> {
	task._state.setConsecutiveNoToolUseCount(task._state.consecutiveNoToolUseCount + 1)
	if (task._state.consecutiveNoToolUseCount >= 2) {
		await emitBroadcast("system", task.taskId, "error", "MODEL_NO_TOOLS_USED")
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
	}
	const userMsgContent = task.userMessageContent
	userMsgContent.push({
		type: "text",
		text: formatResponse.noToolsUsed(),
	} as Anthropic.Messages.TextBlockParam)
}

/**
 * Completes the task implicitly from "a" plain-text assistant reply that carried no
 * tool call. Mirrors the non-blocking essentials of the canonical
 * `attempt_completion` path (state + `completion_result` say + the
 * `TaskCompletionRequested` intent that unregisters the task and clears the
 * running state). It intentionally does NOT create the blocking completion ask
 * — that ask is the git-commit approval flow and is unnecessary for a plain chat
 * answer. Used instead of nudging the model with a second API request, which used
 * to double the turn (a second "Thinking" block + a second LLM call) whenever the
 * model answered with plain text and no tool.
 */
async function implicitCompleteTask(task: ITaskModel, text: string): Promise<void> {
	try {
		const normalizedText = normalizeCompletionText(text)
		task._state.setCompletionResultSummary(normalizedText)
		task._state.setIsCompleted(true)
		getStore().chat.setIsCompleted(true)
		task._state.setConsecutiveMistakeCount(0)
		task._state.setConsecutiveNoToolUseCount(0)

		getStore().intentStore.createIntent({
			id: crypto.randomUUID(),
			type: IntentType.TaskCompletionRequested,
			payload: { taskId: task.taskId },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})

		await emitBroadcast("agent", task.taskId, "completion_result", normalizedText, undefined, false)
	} catch (error) {
		console.error(`[Task#${task.taskId}] implicitCompleteTask failed:`, error)
	}
}

export async function waitForToolExecutionAndPrepareNextContent(
	task: ITaskModel,
	assistantMessage: string,
): Promise<Anthropic.TextBlockParam[] | null> {
	await pollForUserMessageContentReady(task)

	const assistantMsgContent = task.assistantMessageContent
	const didToolUse = assistantMsgContent.some((block) => block.type === "tool_use" || block.type === "mcp_tool_use")

	const text = assistantMessage.trim()
	if (!didToolUse && text.length > 0) {
		// The model answered with a plain-text reply and no tool call. Treat it as
		// the final answer and complete the task — instead of pushing a
		// no-tool nudge that would trigger a full second API request (and a
		// second "Thinking" block). `assistantMessage` here already excludes
		// thinking-only content, so `text` is the user-facing answer.
		await implicitCompleteTask(task, text)
		return null
	}

	if (!didToolUse) {
		// Truly empty response (no text, no tool) — keep the existing nudge so the
		// model retries with a tool.
		await handleNoToolUse(task)
	}

	const userMsgContent = task.userMessageContent
	if (userMsgContent.length > 0 || task._state.isPaused) {
		return [...userMsgContent] as Anthropic.TextBlockParam[]
	}

	return null
}

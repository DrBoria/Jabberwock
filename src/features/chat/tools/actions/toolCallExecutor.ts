import { Anthropic } from "@anthropic-ai/sdk"

import { TelemetryService, getTelemetryService, hasTelemetryService } from "@jabberwock/telemetry"

import { findLastIndex } from "../../../../shared/array"
import { formatResponse } from "../../../settings/context/responses"
import { t } from "../../../../i18n"
import type { ITaskModel } from "../../task/store"
import { sanitizeToolUseId } from "../../../../utils/tool-id"
import type { AssistantMessageContent } from "../../../../features/chat/task/messages/actions"
import type { McpToolUse, ToolUse } from "../../../../shared/tools"

import { systemBroadcast } from "../../task/messages/actions/say"
import { addToApiConversationHistory } from "../../task/messages/actions/apiHistoryPersistence"
import { pushToolResultToUserContent } from "../../../api/handlers/helpers/streaming"

/**
 * Builds the assistant content array for API conversation history from the
 * streaming assistant message content. Handles both regular ToolUse and McpToolUse types.
 */
export function buildAssistantContentForApi(task: ITaskModel, assistantMessage: string): Anthropic.TextBlockParam[] {
	const assistantContent: Array<Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam> = []

	// Add text content if present
	if (assistantMessage) {
		assistantContent.push({
			type: "text" as const,
			text: assistantMessage,
		})
	}

	// Add tool_use blocks with their IDs for native protocol
	// This handles both regular ToolUse and McpToolUse types
	// IMPORTANT: Track seen IDs to prevent duplicates in the API request.
	// Duplicate tool_use IDs cause Anthropic API 400 errors:
	// "tool_use ids must be unique"
	const seenToolUseIds = new Set<string>()
	const assistantMsgContent = task.assistantMessageContent
	const toolUseBlocks = assistantMsgContent.filter(
		(block) => block.type === "tool_use" || block.type === "mcp_tool_use",
	)
	for (const block of toolUseBlocks) {
		if (block.type === "mcp_tool_use") {
			// McpToolUse already has the original tool name (e.g., "mcp_serverName_toolName")
			// The arguments are the raw tool arguments (matching the simplified schema)
			const mcpBlock = block
			if (mcpBlock.id) {
				const sanitizedId = sanitizeToolUseId(mcpBlock.id)
				// Pre-flight deduplication: Skip if we've already added this ID
				if (seenToolUseIds.has(sanitizedId)) {
					console.warn(
						`[Task#${task.taskId}] Pre-flight deduplication: Skipping duplicate MCP tool_use ID: ${sanitizedId} (tool: ${mcpBlock.name})`,
					)
					continue
				}
				seenToolUseIds.add(sanitizedId)
				assistantContent.push({
					type: "tool_use" as const,
					id: sanitizedId,
					name: mcpBlock.name, // Original dynamic name
					input: mcpBlock.arguments, // Direct tool arguments
				})
			}
		} else {
			// Regular ToolUse
			const toolUse = block
			const toolCallId = toolUse.id
			if (toolCallId) {
				const sanitizedId = sanitizeToolUseId(toolCallId)
				// Pre-flight deduplication: Skip if we've already added this ID
				if (seenToolUseIds.has(sanitizedId)) {
					console.warn(
						`[Task#${task.taskId}] Pre-flight deduplication: Skipping duplicate tool_use ID: ${sanitizedId} (tool: ${toolUse.name})`,
					)
					continue
				}
				seenToolUseIds.add(sanitizedId)
				assistantContent.push({
					type: "tool_use" as const,
					id: sanitizedId,
					name: toolUse.name,
					input: toolUse.nativeArgs || toolUse.params,
				})
			}
		}
	}

	return assistantContent as Anthropic.TextBlockParam[]
}

/**
 * Enforces new_task isolation: if new_task is called alongside other tools,
 * truncate any tools that come after it and inject error tool_results.
 * This prevents orphaned tools when delegation disposes the parent task.
 */
export function enforceNewTaskIsolation(
	task: ITaskModel,
	assistantContent: Array<Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam>,
): Array<Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam> {
	const newTaskIndex = assistantContent.findIndex((block) => block.type === "tool_use" && block.name === "new_task")

	if (newTaskIndex !== -1 && newTaskIndex < assistantContent.length - 1) {
		// new_task found but not last - truncate subsequent tools
		const truncatedTools = assistantContent.slice(newTaskIndex + 1)
		assistantContent.length = newTaskIndex + 1 // Truncate API history array

		// ALSO truncate the execution array (assistantMessageContent) to prevent
		// tools after new_task from being executed by presentAssistantMessage().
		// Find new_task index in assistantMessageContent (may differ from assistantContent
		// due to text blocks being structured differently).
		const assistantMsgContent = task.assistantMessageContent
		const executionNewTaskIndex = assistantMsgContent.findIndex(
			(block: AssistantMessageContent) => block.type === "tool_use" && (block as ToolUse).name === "new_task",
		)
		if (executionNewTaskIndex !== -1) {
			task.assistantMessageContent.length = executionNewTaskIndex + 1
		}

		// Pre-inject error tool_results for truncated tools
		for (const tool of truncatedTools) {
			if (tool.type === "tool_use" && (tool as Anthropic.ToolUseBlockParam).id) {
				pushToolResultToUserContent(task.userMessageContent, {
					type: "tool_result",
					tool_use_id: (tool as Anthropic.ToolUseBlockParam).id,
					content:
						"This tool was not executed because new_task was called in the same message turn. The new_task tool must be the last tool in a message.",
					is_error: true,
				})
			}
		}
	}

	return assistantContent
}

/**
 * Saves the assistant message to API conversation history and captures telemetry.
 * This must happen BEFORE executing tools so that tool_result blocks appear
 * AFTER their corresponding tool_use blocks.
 */
export async function saveAssistantMessageToHistory(
	task: ITaskModel,
	assistantContent: Array<Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam>,
	reasoningMessage: string,
): Promise<void> {
	await addToApiConversationHistory(
		task.taskId,
		task.globalStoragePath,
		task,
		{ role: "assistant", content: assistantContent } as Anthropic.MessageParam,
		reasoningMessage || undefined,
	)
	task._state.setAssistantMessageSavedToHistory(true)

	getTelemetryService().captureConversationMessage(task.taskId, "assistant")
}

/**
 * Waits for tool execution to complete (userMessageContentReady) and handles
 * the post-execution logic: checking if tools were used, incrementing counters,
 * and preparing the next user content for the loop.
 *
 * @returns The next user content to push to the stack, or null if no more content.
 */
export async function waitForToolExecutionAndPrepareNextContent(
	task: ITaskModel,
	assistantMessage: string,
): Promise<Anthropic.TextBlockParam[] | null> {
	// Wait for tool execution to complete
	// Uses a custom loop instead of pWaitFor with timeout because:
	// When presentAssistantMessage is blocked on an interactive_app ask
	// (e.g., md-todo-mcp manage_todo_plan), the lock is held while waiting
	// for user input. The inner pWaitFor in ask/store.ts has no timeout,
	// so the user can take as long as they need. But a pWaitFor with a hard
	// 60s timeout here would fire and push error tool_results, causing the
	// LLM to retry in an infinite loop.
	//
	// Fix: Use a polling loop that checks for pending interactive_app asks
	// and extends the wait instead of timing out.
	let waitStartTime = Date.now()
	let waitResolved = false
	while (!waitResolved && !task._state.abort) {
		if (task._state.userMessageContentReady) {
			waitResolved = true
			break
		}

		// Check for timeout (60s) — but only if there's no pending interactive_app ask
		const elapsed = Date.now() - waitStartTime
		if (elapsed >= 60_000) {
			// Check if an interactive_app ask is still pending (user is interacting with iframe)
			const messages = task.messages
			const lastMsg = messages?.[messages.length - 1]
			const hasPendingInteractiveApp =
				lastMsg?.type === "ask" && lastMsg?.ask === "interactive_app" && task.askResolve !== null

			if (hasPendingInteractiveApp) {
				console.log(
					`[Task#${task.taskId}] pWaitFor timeout suppressed: interactive_app ask pending (user is interacting with iframe). ` +
						`Elapsed: ${elapsed}ms. Resuming wait...`,
				)
				// Reset the timer and keep waiting
				waitStartTime = Date.now()
				await new Promise((resolve) => setTimeout(resolve, 100))
				continue
			}

			const assistantMsgContent = task.assistantMessageContent
			console.error(
				`[Task#${task.taskId}] pWaitFor(userMessageContentReady) timed out after ${elapsed}ms. ` +
					`Current Index: ${String(task._state.currentStreamingContentIndex)}, ` +
					`Blocks: ${String(assistantMsgContent.length)}, ` +
					`Locked: ${String(task._state.presentAssistantMessageLocked)}, ` +
					`didAlreadyUseTool: ${String(task._state.didAlreadyUseTool)}`,
			)

			// ── Retry-loop prevention ─────────────────────────────────────
			// When tools are blocked on user approval (presentAssistantMessageLocked),
			// force-continuing with empty userMessageContent causes:
			//   1. runMainLoop → initiateTaskLoop retries with "no tools used"
			//   2. Model re-issues identical tool call (no tool_result in history)
			//   3. Tool blocks on ask again → repeat every 60s → infinite retry loop
			//
			// Fix: Push error tool_results for pending tool_use blocks so the
			// conversation history gets proper tool_results, breaking the cycle.
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

				// Release the presentAssistantMessage lock so subsequent iterations
				// can process new tool_use blocks. The original presentAssistantMessage
				// is still running (blocked on ask), but its pushToolResult calls will
				// be guarded by the duplicate tool_result check in pushToolResultToUserContent.
				task._state.setPresentAssistantMessageLocked(false)
				task._state.setCurrentStreamingContentIndex(assistantMsgContent.length)
			}

			// Force continuation as a fallback
			task._state.setUserMessageContentReady(true)
			waitResolved = true
			break
		}

		await new Promise((resolve) => setTimeout(resolve, 100))
	}
	console.log(`[Task#${task.taskId}] pWaitFor(userMessageContentReady) unblocked.`)

	// If the model did not tool use, then we need to tell it to
	// either use a tool or attempt_completion.
	const assistantMsgContent = task.assistantMessageContent
	const didToolUse = assistantMsgContent.some((block) => block.type === "tool_use" || block.type === "mcp_tool_use")

	if (!didToolUse) {
		// Increment consecutive no-tool-use counter
		task._state.setConsecutiveNoToolUseCount(task._state.consecutiveNoToolUseCount + 1)

		// Only show error and count toward mistake limit after 2 consecutive failures
		if (task._state.consecutiveNoToolUseCount >= 2) {
			await systemBroadcast(task.taskId, "error", "MODEL_NO_TOOLS_USED")
			// Only count toward mistake limit after second consecutive failure
			task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		}

		// Use the task's locked protocol for consistent behavior
		const userMsgContent = task.userMessageContent
		userMsgContent.push({
			type: "text",
			text: formatResponse.noToolsUsed(),
		} as Anthropic.Messages.TextBlockParam)
	} else {
		// Reset counter when tools are used successfully
		task._state.setConsecutiveNoToolUseCount(0)
	}

	// Return next content if there is any, or null if done
	const userMsgContent = task.userMessageContent
	if (userMsgContent.length > 0 || task._state.isPaused) {
		return [...userMsgContent] as Anthropic.TextBlockParam[]
	}

	return null
}

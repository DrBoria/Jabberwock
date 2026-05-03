import { Anthropic } from "@anthropic-ai/sdk"

import { TelemetryService } from "@jabberwock/telemetry"

import { findLastIndex } from "../../../../../shared/array"
import { formatResponse } from "../../../../prompts/responses"
import { t } from "../../../../../i18n"
import { Task } from "../../../../task/Task"
import { sanitizeToolUseId } from "../../../../../utils/tool-id"
import type { McpToolUse, ToolUse } from "../../../../../shared/tools"
import pWaitFor from "p-wait-for"

/**
 * Builds the assistant content array for API conversation history from the
 * streaming assistant message content. Handles both regular ToolUse and McpToolUse types.
 */
export function buildAssistantContentForApi(task: Task, assistantMessage: string): Anthropic.TextBlockParam[] {
	const tsk = task as any
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
	const toolUseBlocks = tsk.assistantMessageContent.filter(
		(block: any) => block.type === "tool_use" || block.type === "mcp_tool_use",
	)
	for (const block of toolUseBlocks) {
		if (block.type === "mcp_tool_use") {
			// McpToolUse already has the original tool name (e.g., "mcp_serverName_toolName")
			// The arguments are the raw tool arguments (matching the simplified schema)
			const mcpBlock = block as McpToolUse
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
			const toolUse = block as ToolUse
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
				// nativeArgs is already in the correct API format for all tools
				const input = toolUse.nativeArgs || toolUse.params

				// Use originalName (alias) if present for API history consistency.
				// When tool aliases are used (e.g., "edit_file" -> "search_and_replace" -> "edit" (current canonical name)),
				// we want the alias name in the conversation history to match what the model
				// was told the tool was named, preventing confusion in multi-turn conversations.
				const toolNameForHistory = toolUse.originalName ?? toolUse.name

				assistantContent.push({
					type: "tool_use" as const,
					id: sanitizedId,
					name: toolNameForHistory,
					input,
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
	task: Task,
	assistantContent: Array<Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam>,
): Array<Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam> {
	const tsk = task as any

	const newTaskIndex = assistantContent.findIndex((block) => block.type === "tool_use" && block.name === "new_task")

	if (newTaskIndex !== -1 && newTaskIndex < assistantContent.length - 1) {
		// new_task found but not last - truncate subsequent tools
		const truncatedTools = assistantContent.slice(newTaskIndex + 1)
		assistantContent.length = newTaskIndex + 1 // Truncate API history array

		// ALSO truncate the execution array (assistantMessageContent) to prevent
		// tools after new_task from being executed by presentAssistantMessage().
		// Find new_task index in assistantMessageContent (may differ from assistantContent
		// due to text blocks being structured differently).
		const executionNewTaskIndex = tsk.assistantMessageContent.findIndex(
			(block: any) => block.type === "tool_use" && block.name === "new_task",
		)
		if (executionNewTaskIndex !== -1) {
			tsk.assistantMessageContent.length = executionNewTaskIndex + 1
		}

		// Pre-inject error tool_results for truncated tools
		for (const tool of truncatedTools) {
			if (tool.type === "tool_use" && (tool as Anthropic.ToolUseBlockParam).id) {
				task.pushToolResultToUserContent({
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
	task: Task,
	assistantContent: Array<Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam>,
	reasoningMessage: string,
): Promise<void> {
	const tsk = task as any
	await tsk.addToApiConversationHistory(
		{ role: "assistant", content: assistantContent },
		reasoningMessage || undefined,
	)
	tsk.assistantMessageSavedToHistory = true

	TelemetryService.instance.captureConversationMessage(task.taskId, "assistant")
}

/**
 * Waits for tool execution to complete (userMessageContentReady) and handles
 * the post-execution logic: checking if tools were used, incrementing counters,
 * and preparing the next user content for the loop.
 *
 * @returns The next user content to push to the stack, or null if no more content.
 */
export async function waitForToolExecutionAndPrepareNextContent(
	task: Task,
	assistantMessage: string,
): Promise<Anthropic.TextBlockParam[] | null> {
	const tsk = task as any

	// Wait for tool execution to complete
	const waitStartTime = Date.now()
	await pWaitFor(() => tsk.userMessageContentReady || task.abort, {
		interval: 100,
		timeout: 60_000, // 60s safety timeout to prevent permanent hangs
	}).catch((err: any) => {
		if (!task.abort) {
			console.error(
				`[Task#${task.taskId}] pWaitFor(userMessageContentReady) timed out after ${Date.now() - waitStartTime}ms. ` +
					`Current Index: ${tsk.currentStreamingContentIndex}, ` +
					`Blocks: ${tsk.assistantMessageContent.length}, ` +
					`Locked: ${tsk.presentAssistantMessageLocked}, ` +
					`didAlreadyUseTool: ${tsk.didAlreadyUseTool}`,
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
			if (tsk.presentAssistantMessageLocked && tsk.userMessageContent.length === 0) {
				const pendingTools = tsk.assistantMessageContent.filter(
					(block: any) =>
						(block.type === "tool_use" || block.type === "mcp_tool_use") && !block.partial && block.id,
				)
				for (const toolUse of pendingTools) {
					console.warn(
						`[Task#${task.taskId}] Pushing error tool_result for timed-out tool: ${toolUse.name ?? "unknown"} (id: ${toolUse.id})`,
					)
					tsk.pushToolResultToUserContent({
						type: "tool_result",
						tool_use_id: toolUse.id,
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
				tsk.presentAssistantMessageLocked = false
				tsk.currentStreamingContentIndex = tsk.assistantMessageContent.length
			}

			// Force continuation as a fallback
			tsk.userMessageContentReady = true
		}
	})
	console.log(`[Task#${task.taskId}] pWaitFor(userMessageContentReady) unblocked.`)

	// If the model did not tool use, then we need to tell it to
	// either use a tool or attempt_completion.
	const didToolUse = tsk.assistantMessageContent.some(
		(block: any) => block.type === "tool_use" || block.type === "mcp_tool_use",
	)

	if (!didToolUse) {
		// Increment consecutive no-tool-use counter
		tsk.consecutiveNoToolUseCount++

		// Only show error and count toward mistake limit after 2 consecutive failures
		if (tsk.consecutiveNoToolUseCount >= 2) {
			await task.say("error", "MODEL_NO_TOOLS_USED")
			// Only count toward mistake limit after second consecutive failure
			tsk.consecutiveMistakeCount++
		}

		// Use the task's locked protocol for consistent behavior
		tsk.userMessageContent.push({
			type: "text",
			text: formatResponse.noToolsUsed(),
		})
	} else {
		// Reset counter when tools are used successfully
		tsk.consecutiveNoToolUseCount = 0
	}

	// Return next content if there is any, or null if done
	if (tsk.userMessageContent.length > 0 || tsk.isPaused) {
		return [...tsk.userMessageContent] // Create a copy to avoid mutation issues
	}

	return null
}

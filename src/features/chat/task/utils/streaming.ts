import { Anthropic } from "@anthropic-ai/sdk"

import type { Task } from "../Task"

/**
 * Pushes a tool result block into the user message content array.
 * Skips duplicate tool_use_id entries and logs a warning.
 */
export function pushToolResultToUserContent(task: Task, toolResult: Anthropic.ToolResultBlockParam): boolean {
	const existingResult = task.userMessageContent.find(
		(block): block is Anthropic.ToolResultBlockParam =>
			block.type === "tool_result" && block.tool_use_id === toolResult.tool_use_id,
	)
	if (existingResult) {
		console.warn(
			`[Task#pushToolResultToUserContent] Skipping duplicate tool_result for tool_use_id: ${toolResult.tool_use_id}`,
		)
		return false
	}
	task.userMessageContent.push(toolResult)
	return true
}

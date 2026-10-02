import { Anthropic } from "@anthropic-ai/sdk"

/**
 * Pushes a tool result block into the user message content array.
 * Skips duplicate tool_use_id entries and logs a warning.
 */
export function pushToolResultToUserContent(
	userMessageContent: Anthropic.Messages.ContentBlockParam[],
	toolResult: Anthropic.Messages.ToolResultBlockParam,
): boolean {
	const existingResult = userMessageContent.find(
		(block): block is Anthropic.Messages.ToolResultBlockParam =>
			block.type === "tool_result" && block.tool_use_id === toolResult.tool_use_id,
	)
	if (existingResult) {
		console.warn(
			`[pushToolResultToUserContent] Skipping duplicate tool_result for tool_use_id: ${toolResult.tool_use_id}`,
		)
		return false
	}
	userMessageContent.push(toolResult)
	return true
}

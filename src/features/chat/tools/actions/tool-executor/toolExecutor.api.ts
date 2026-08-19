import { Anthropic } from "@anthropic-ai/sdk"

import type { ITaskModel } from "@features/chat/task/store"
import { sanitizeToolUseId } from "@utils/mcp"

/**
 * Builds the assistant content array for API conversation history from the
 * streaming assistant message content. Handles both regular ToolUse and McpToolUse types.
 */
export function buildAssistantContentForApi(task: ITaskModel, assistantMessage: string): Anthropic.TextBlockParam[] {
	const assistantContent: Array<Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam> = []

	if (assistantMessage) {
		assistantContent.push({
			type: "text" as const,
			text: assistantMessage,
		})
	}

	const seenToolUseIds = new Set<string>()
	const assistantMsgContent = task.assistantMessageContent
	const toolUseBlocks = assistantMsgContent.filter(
		(block) => block.type === "tool_use" || block.type === "mcp_tool_use",
	)
	for (const block of toolUseBlocks) {
		if (block.type === "mcp_tool_use") {
			const mcpBlock = block
			if (mcpBlock.id) {
				const sanitizedId = sanitizeToolUseId(mcpBlock.id)
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
					name: mcpBlock.name,
					input: mcpBlock.arguments,
				})
			}
		} else {
			const toolUse = block
			const toolCallId = toolUse.id
			if (toolCallId) {
				const sanitizedId = sanitizeToolUseId(toolCallId)
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

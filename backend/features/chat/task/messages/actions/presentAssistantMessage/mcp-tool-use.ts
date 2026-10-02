import { serializeError } from "serialize-error"

import { getTelemetryService } from "@jabberwock/telemetry"

import type { ToolResponse } from "@shared/tools"
import type { ToolUse, McpToolUse } from "@shared/tools"

import type { ITaskModel } from "@features/chat/task"

import { AskIgnoredError } from "@features/chat/task/notifications/actions"
import { emitBroadcast } from "@features/chat/task/messages/actions/say"

import { pushToolResultToUserContent } from "@features/api"
import { formatResponse } from "@features/settings"
import { sanitizeMcpName } from "@utils/mcp"
import { getMcpServerManager } from "@services/mcp/core/McpServerManager"

import { useMcpToolTool } from "@features/chat/tools"
import {
	createAskApproval,
	extractToolResultContent,
} from "\@features/chat/task/messages/actions/presentAssistantMessage/helpers"

async function handleMcpToolUse(task: ITaskModel, block: McpToolUse): Promise<void> {
	const mcpBlock = block

	if (task._state.didRejectTool) {
		const toolCallId = mcpBlock.id
		const errorMessage = !mcpBlock.partial
			? `Skipping MCP tool ${mcpBlock.name} due to user rejecting a previous tool.`
			: `MCP tool ${mcpBlock.name} was interrupted and not executed due to user rejecting a previous tool.`

		if (toolCallId) {
			pushToolResultToUserContent(task.userMessageContent, {
				type: "tool_result",
				tool_use_id: sanitizeMcpName(toolCallId),
				content: errorMessage,
				is_error: true,
			})
		}
		return
	}

	let hasToolResult = false
	const toolCallId = mcpBlock.id
	let approvalFeedback: { text: string; images?: string[] } | undefined

	const pushToolResult = (content: ToolResponse) => {
		if (hasToolResult) {
			console.error(
				`[jabberwock] [presentAssistantMessage] Skipping duplicate tool_result for mcp_tool_use: ${toolCallId}`,
			)
			return
		}

		const { resultContent: rawContent, imageBlocks: rawImageBlocks } = extractToolResultContent(content)
		let resultContent = rawContent
		let imageBlocks = rawImageBlocks

		if (approvalFeedback) {
			const feedbackText = formatResponse.toolApprovedWithFeedback(approvalFeedback.text)
			resultContent = `${feedbackText}\n\n${resultContent}`

			if (approvalFeedback.images) {
				const feedbackImageBlocks = formatResponse.imageBlocks(approvalFeedback.images)
				imageBlocks = [...feedbackImageBlocks, ...imageBlocks]
			}
		}

		if (toolCallId) {
			pushToolResultToUserContent(task.userMessageContent, {
				type: "tool_result",
				tool_use_id: sanitizeMcpName(toolCallId),
				content: resultContent,
			})

			if (imageBlocks.length > 0) {
				task.userMessageContent.push(...imageBlocks)
			}
		}

		hasToolResult = true
	}

	const handleError = async (action: string, error: Error) => {
		if (error instanceof AskIgnoredError) {
			return
		}
		const errorString = `Error ${action}: ${JSON.stringify(serializeError(error))}`
		await emitBroadcast(
			"system",
			task.taskId,
			"error",
			`Error ${action}:\n${error.message ?? JSON.stringify(serializeError(error), null, 2)}`,
		)
		pushToolResult(formatResponse.toolError(errorString))
	}

	if (!mcpBlock.partial) {
		task.recordToolUsage("use_mcp_tool")
		getTelemetryService().captureToolUsage(task.taskId, "use_mcp_tool")
	}

	const mcpHub = getMcpServerManager().getMcpHub()
	let resolvedServerName = mcpBlock.serverName
	if (mcpHub) {
		const originalName = mcpHub.findServerNameBySanitizedName(mcpBlock.serverName)
		if (originalName) {
			resolvedServerName = originalName
		}
	}

	const syntheticToolUse: ToolUse<"use_mcp_tool"> = {
		type: "tool_use",
		id: mcpBlock.id,
		name: "use_mcp_tool",
		params: {
			server_name: resolvedServerName,
			tool_name: mcpBlock.toolName,
			arguments: JSON.stringify(mcpBlock.arguments),
		},
		partial: mcpBlock.partial,
		nativeArgs: {
			server_name: resolvedServerName,
			tool_name: mcpBlock.toolName,
			arguments: mcpBlock.arguments,
		},
	}

	await useMcpToolTool.handle(task, syntheticToolUse, {
		askApproval: createAskApproval(task, pushToolResult),
		handleError,
		pushToolResult,
	})
}

export { handleMcpToolUse }

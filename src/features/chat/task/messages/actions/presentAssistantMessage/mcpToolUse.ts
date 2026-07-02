import { serializeError } from "serialize-error"
import { Anthropic } from "@anthropic-ai/sdk"

import { getTelemetryService } from "@jabberwock/telemetry"

import type { ToolResponse } from "@shared/tools"
import type { ToolUse, McpToolUse } from "@shared/tools"

import type { ITaskModel } from "@features/chat/task/store"

import { AskIgnoredError } from "@features/chat/task/notifications/actions"
import { systemBroadcast } from "@features/chat/task/messages/actions/say"

import { pushToolResultToUserContent } from "@features/api/handlers/helpers/process/streaming"
import { formatResponse } from "@features/settings/context/responses"
import { sanitizeToolUseId } from "@utils/mcp"
import { getMcpServerManager } from "@services/mcp/core/McpServerManager"

import { useMcpToolTool } from "@features/chat/tools"
import { createAskApproval } from "./helpers"

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
				tool_use_id: sanitizeToolUseId(toolCallId),
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

		let resultContent: string
		let imageBlocks: Anthropic.ImageBlockParam[] = []

		if (typeof content === "string") {
			resultContent = content || "(tool did not return anything)"
		} else {
			const textBlocks = content.filter((item) => item.type === "text")
			imageBlocks = content.filter((item) => item.type === "image") as Anthropic.ImageBlockParam[]
			resultContent =
				textBlocks.map((item) => (item as Anthropic.TextBlockParam).text).join("\n") ||
				"(tool did not return anything)"
		}

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
				tool_use_id: sanitizeToolUseId(toolCallId),
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
		await systemBroadcast(
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

	const mcpHub = getMcpServerManager()["_mcpHub"]
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

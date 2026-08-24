import type { McpServerRequestData } from "@jabberwock/types"

import type { ITaskModel } from "@features/chat/task/store"
import type { ToolUse } from "@shared/tools"

import { BaseTool, ToolCallbacks } from "@features/chat/tools/a-b/BaseTool"
import {
	validateParams,
	validateToolExists,
	buildUseMcpServerMessage,
	isInteractiveAppServer,
	type UseMcpToolParams,
} from "@features/chat/tools/mcp/validateParams"
import { executeToolAndProcessResult } from "@features/chat/tools/mcp/executeTool"
import { getMcpServerManager } from "@services/mcp/core/McpServerManager"
import { ask } from "@features/chat/task/notifications/actions/ask"

/**
 * Determines if the MCP server is interactive (auto-approves) or requires explicit approval.
 */
async function getMcpToolApproval(
	serverName: string,
	completeMessage: string,
	askApproval: ToolCallbacks["askApproval"],
): Promise<boolean> {
	const mcpHub = getMcpServerManager().getMcpHub()
	const servers = mcpHub?.getAllServers() || []
	const server = servers.find((s) => s.name === serverName)
	const isInteractiveApp = server ? isInteractiveAppServer(server.config || "{}") : false

	const didApprove = isInteractiveApp ? true : await askApproval("use_mcp_server", completeMessage)
	return didApprove
}

export class UseMcpToolTool extends BaseTool<"use_mcp_tool"> {
	readonly name = "use_mcp_tool" as const

	async execute(params: UseMcpToolParams, task: ITaskModel, callbacks: ToolCallbacks): Promise<void> {
		const { askApproval, handleError, pushToolResult } = callbacks

		try {
			const validation = await validateParams(task, params, pushToolResult)
			if (!validation.isValid) {
				return
			}

			const { serverName, toolName, parsedArguments } = validation

			const toolValidation = await validateToolExists(task, serverName, toolName, pushToolResult)
			if (!toolValidation.isValid) {
				return
			}

			const resolvedToolName = toolValidation.resolvedToolName ?? toolName
			task._state.setConsecutiveMistakeCount(0)

			const completeMessage = buildUseMcpServerMessage(
				serverName,
				resolvedToolName,
				params.arguments ? JSON.stringify(params.arguments) : undefined,
			)

			const executionId = task.lastMessageTs?.toString() ?? Date.now().toString()

			const didApprove = await getMcpToolApproval(serverName, completeMessage, askApproval)
			if (!didApprove) {
				return
			}

			await executeToolAndProcessResult(
				task,
				serverName,
				resolvedToolName,
				parsedArguments,
				executionId,
				pushToolResult,
			)
		} catch (error) {
			await handleError("executing MCP tool", error as Error)
		}
	}

	override async handlePartial(task: ITaskModel, block: ToolUse<"use_mcp_tool">): Promise<void> {
		const params = block.params

		const partialMessage = JSON.stringify({
			type: "use_mcp_tool",
			serverName: params.server_name ?? "",
			toolName: params.tool_name ?? "",
			arguments: params.arguments,
		} satisfies McpServerRequestData)

		await ask(task.taskId, "use_mcp_server", partialMessage, true).catch(() => {})
	}
}

export const useMcpToolTool = new UseMcpToolTool()

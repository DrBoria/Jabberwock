import type { McpServerRequestData } from "@jabberwock/types"

import type { ITaskModel } from "../../../features/chat/task/store"
import type { ToolUse } from "../../../shared/tools"

import { BaseTool, ToolCallbacks } from "./BaseTool"
import {
	validateParams,
	validateToolExists,
	buildUseMcpServerMessage,
	isInteractiveAppServer,
	type UseMcpToolParams,
} from "./mcp/validateParams"
import { executeToolAndProcessResult } from "./mcp/executeTool"
import { getMcpServerManager } from "../../../services/mcp/McpServerManager"
import { ask } from "../task/notifications/actions/ask"

export class UseMcpToolTool extends BaseTool<"use_mcp_tool"> {
	readonly name = "use_mcp_tool" as const

	async execute(params: UseMcpToolParams, task: ITaskModel, callbacks: ToolCallbacks): Promise<void> {
		const { askApproval, handleError, pushToolResult } = callbacks

		try {
			// Validate parameters
			const validation = await validateParams(task, params, pushToolResult)
			if (!validation.isValid) {
				return
			}

			const { serverName, toolName, parsedArguments } = validation

			// Validate that the tool exists on the server
			const toolValidation = await validateToolExists(task, serverName, toolName, pushToolResult)
			if (!toolValidation.isValid) {
				return
			}

			// Use the resolved tool name (original name from the server) for MCP calls
			// This handles cases where models mangle hyphens to underscores
			const resolvedToolName = toolValidation.resolvedToolName ?? toolName

			// Reset mistake count on successful validation
			task._state.setConsecutiveMistakeCount(0)

			// Get user approval
			const completeMessage = buildUseMcpServerMessage(
				serverName,
				resolvedToolName,
				params.arguments ? JSON.stringify(params.arguments) : undefined,
			)

			const executionId = task.lastMessageTs?.toString() ?? Date.now().toString()

			// Auto-approve for interactiveApp MCP servers (they have their own approval UI via _meta.ui)
			// The interactive_app ask at line 349 provides the iframe-based approval flow instead.
			const mcpHub = getMcpServerManager().getMcpHub()
			const servers = mcpHub?.getAllServers() || []
			const server = servers.find((s) => s.name === serverName)
			const isInteractiveApp = server ? isInteractiveAppServer(server.config || "{}") : false

			const didApprove = isInteractiveApp ? true : await askApproval("use_mcp_server", completeMessage)

			if (!didApprove) {
				return
			}

			// Execute the tool and process results
			// Return delegation status to signal presentAssistantMessage to abort loop
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

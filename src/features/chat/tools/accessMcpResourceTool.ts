import type { McpServerRequestData } from "@jabberwock/types"

import type { ToolUse } from "../../../shared/tools"
import type { ITaskModel } from "../../../features/chat/task/store"
import { formatResponse } from "../../settings/context/responses"
import { getMcpServerManager } from "../../../services/mcp/McpServerManager"

import { BaseTool, ToolCallbacks } from "./BaseTool"
import { ask } from "../task/notifications/actions/ask"
import { mcpBroadcast } from "../task/messages/actions/say"
import { sayAndCreateMissingParamError } from "../task/messages/actions/missingParamError"

interface AccessMcpResourceParams {
	server_name: string
	uri: string
}

export class AccessMcpResourceTool extends BaseTool<"access_mcp_resource"> {
	readonly name = "access_mcp_resource" as const

	async execute(params: AccessMcpResourceParams, task: ITaskModel, callbacks: ToolCallbacks): Promise<void> {
		const { askApproval, handleError, pushToolResult } = callbacks
		const { server_name, uri } = params

		try {
			if (!server_name) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("access_mcp_resource")
				pushToolResult(await sayAndCreateMissingParamError(task.taskId, "access_mcp_resource", "server_name"))
				return
			}

			if (!uri) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("access_mcp_resource")
				pushToolResult(await sayAndCreateMissingParamError(task.taskId, "access_mcp_resource", "uri"))
				return
			}

			task._state.setConsecutiveMistakeCount(0)

			const completeMessage = JSON.stringify({
				type: "access_mcp_resource",
				serverName: server_name,
				uri,
			} satisfies McpServerRequestData)

			const didApprove = await askApproval("use_mcp_server", completeMessage)

			if (!didApprove) {
				pushToolResult(formatResponse.toolDenied())
				return
			}

			// Now execute the tool
			await mcpBroadcast(task.taskId, "mcp_server_request_started")
			const mcpHub = getMcpServerManager().getMcpHub()
			const resourceResult = await mcpHub?.readResource(server_name, uri)

			const resourceResultPretty =
				resourceResult?.contents
					.map((item) => {
						if (item.text) {
							return item.text
						}
						return ""
					})
					.filter(Boolean)
					.join("\n\n") || "(Empty response)"

			// Handle images (image must contain mimetype and blob)
			let images: string[] = []

			resourceResult?.contents.forEach((item) => {
				if (item.mimeType?.startsWith("image") && item.blob) {
					if (item.blob.startsWith("data:")) {
						images.push(item.blob)
					} else {
						images.push(`data:${item.mimeType};base64,` + item.blob)
					}
				}
			})

			await mcpBroadcast(task.taskId, "mcp_server_response", resourceResultPretty, images)
			pushToolResult(formatResponse.toolResult(resourceResultPretty, images))
		} catch (error) {
			await handleError("accessing MCP resource", error instanceof Error ? error : new Error(String(error)))
		}
	}

	override async handlePartial(task: ITaskModel, block: ToolUse<"access_mcp_resource">): Promise<void> {
		const server_name = block.params.server_name ?? ""
		const uri = block.params.uri ?? ""

		const partialMessage = JSON.stringify({
			type: "access_mcp_resource",
			serverName: server_name,
			uri: uri,
		} satisfies McpServerRequestData)

		await ask(task.taskId, "use_mcp_server", partialMessage, block.partial).catch(() => {})
	}
}

export const accessMcpResourceTool = new AccessMcpResourceTool()

import type { McpServerRequestData } from "@jabberwock/types"

import type { ITaskModel } from "@features/chat/task/store"
import { formatResponse } from "@features/settings/context/responses"
import { getMcpServerManager } from "@services/mcp/core/McpServerManager"
import { t } from "@i18n"
import { toolNamesMatch } from "@utils/mcp"
import { systemBroadcast } from "@features/chat/task/messages/actions/say"
import { sayAndCreateMissingParamError } from "@features/chat/task/messages/actions/command/sayAndCreateMissingParamError"

export interface UseMcpToolParams {
	server_name: string
	tool_name: string
	arguments?: { [key: string]: unknown }
}

export type ValidationResult =
	| { isValid: false }
	| {
			isValid: true
			serverName: string
			toolName: string
			parsedArguments?: { [key: string]: unknown }
	  }

/**
 * Validates the basic parameters of an MCP tool call (server_name, tool_name, arguments).
 */
export async function validateParams(
	task: ITaskModel,
	params: UseMcpToolParams,
	pushToolResult: (content: string) => void,
): Promise<ValidationResult> {
	if (!params.server_name) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("use_mcp_tool")
		pushToolResult(await sayAndCreateMissingParamError(task.taskId, "use_mcp_tool", "server_name"))
		return { isValid: false }
	}

	if (!params.tool_name) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("use_mcp_tool")
		pushToolResult(await sayAndCreateMissingParamError(task.taskId, "use_mcp_tool", "tool_name"))
		return { isValid: false }
	}

	// Native-only: arguments are already a structured object.
	let parsedArguments: { [key: string]: unknown } | undefined
	if (params.arguments !== undefined) {
		if (typeof params.arguments !== "object" || params.arguments === null || Array.isArray(params.arguments)) {
			task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
			task.recordToolError("use_mcp_tool")
			await systemBroadcast(
				task.taskId,
				"error",
				t("mcp:errors.invalidJsonArgument", { toolName: params.tool_name }),
			)
			task._state.setDidToolFailInCurrentTurn(true)
			pushToolResult(
				formatResponse.toolError(
					formatResponse.invalidMcpToolArgumentError(params.server_name, params.tool_name),
				),
			)
			return { isValid: false }
		}
		parsedArguments = params.arguments
	}

	return {
		isValid: true,
		serverName: params.server_name,
		toolName: params.tool_name,
		parsedArguments,
	}
}

/**
 * Validates that the specified tool exists on the MCP server and is enabled.
 * Uses fuzzy matching to handle model mangling of hyphens to underscores.
 */
export async function validateToolExists(
	task: ITaskModel,
	serverName: string,
	toolName: string,
	pushToolResult: (content: string) => void,
): Promise<{ isValid: boolean; availableTools?: string[]; resolvedToolName?: string }> {
	try {
		// Get the MCP hub to access server information
		const mcpHub = getMcpServerManager().getMcpHub()

		if (!mcpHub) {
			// If we can't get the MCP hub, we can't validate, so proceed with caution
			return { isValid: true }
		}

		// Get all servers to find the specific one
		const servers = mcpHub.getAllServers()
		const server = servers.find((s) => s.name === serverName)

		if (!server) {
			// Fail fast when server is unknown
			const availableServersArray = servers.map((s) => s.name)
			const availableServers =
				availableServersArray.length > 0 ? availableServersArray.join(", ") : "No servers available"

			task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
			task.recordToolError("use_mcp_tool")
			await systemBroadcast(
				task.taskId,
				"error",
				t("mcp:errors.serverNotFound", { serverName, availableServers }),
			)
			task._state.setDidToolFailInCurrentTurn(true)

			pushToolResult(formatResponse.unknownMcpServerError(serverName, availableServersArray))
			return { isValid: false, availableTools: [] }
		}

		// Check if the server has tools defined
		if (!server.tools || server.tools.length === 0) {
			// No tools available on this server
			task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
			task.recordToolError("use_mcp_tool")
			await systemBroadcast(
				task.taskId,
				"error",
				t("mcp:errors.toolNotFound", {
					toolName,
					serverName,
					availableTools: "No tools available",
				}),
			)
			task._state.setDidToolFailInCurrentTurn(true)

			pushToolResult(formatResponse.unknownMcpToolError(serverName, toolName, []))
			return { isValid: false, availableTools: [] }
		}

		// Check if the requested tool exists (using fuzzy matching to handle model mangling of hyphens)
		const tool = server.tools.find((t) => toolNamesMatch(t.name, toolName))

		if (!tool) {
			// Tool not found - provide list of available tools
			const availableToolNames = server.tools.map((tool) => tool.name)

			task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
			task.recordToolError("use_mcp_tool")
			await systemBroadcast(
				task.taskId,
				"error",
				t("mcp:errors.toolNotFound", {
					toolName,
					serverName,
					availableTools: availableToolNames.join(", "),
				}),
			)
			task._state.setDidToolFailInCurrentTurn(true)

			pushToolResult(formatResponse.unknownMcpToolError(serverName, toolName, availableToolNames))
			return { isValid: false, availableTools: availableToolNames }
		}

		// Check if the tool is disabled (enabledForPrompt is false)
		if (tool.enabledForPrompt === false) {
			// Tool is disabled - only show enabled tools
			const enabledTools = server.tools.filter((t) => t.enabledForPrompt !== false)
			const enabledToolNames = enabledTools.map((t) => t.name)

			task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
			task.recordToolError("use_mcp_tool")
			await systemBroadcast(
				task.taskId,
				"error",
				t("mcp:errors.toolDisabled", {
					toolName,
					serverName,
					availableTools:
						enabledToolNames.length > 0 ? enabledToolNames.join(", ") : "No enabled tools available",
				}),
			)
			task._state.setDidToolFailInCurrentTurn(true)

			pushToolResult(formatResponse.unknownMcpToolError(serverName, toolName, enabledToolNames))
			return { isValid: false, availableTools: enabledToolNames }
		}

		// Tool exists and is enabled - return the original tool name for use with the MCP server
		return { isValid: true, availableTools: server.tools.map((t) => t.name), resolvedToolName: tool.name }
	} catch (error) {
		// If there's an error during validation, log it but don't block the tool execution
		// The actual tool call might still fail with a proper error
		console.error("[jabberwock] Error validating MCP tool existence:", error)
		return { isValid: true }
	}
}

/**
 * Builds the complete message for the use_mcp_server ask.
 */

/**
 * Builds the complete message for the use_mcp_server ask.
 */
export function buildUseMcpServerMessage(serverName: string, toolName: string, args?: string): string {
	const argsStr = args ? `\n\nArguments:\n${args}` : ""
	return `Use MCP Server: ${serverName}\n\nTool: ${toolName}${argsStr}`
}

/**
 * Checks if the MCP server config indicates it's an interactive app server.
 */
export function isInteractiveAppServer(config: Record<string, unknown> | string): boolean {
	const parsed: Record<string, unknown> = typeof config === "string" ? {} : config
	return parsed.isInteractiveApp === true
}

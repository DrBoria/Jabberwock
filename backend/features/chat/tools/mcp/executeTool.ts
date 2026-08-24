import type { ITaskModel } from "@features/chat/task/store"
import { formatResponse } from "@features/settings/context/responses"
import { getMcpServerManager } from "@services/mcp/core/McpServerManager"
import type { ToolResponse } from "@shared/tools"
import { processToolContent, sendExecutionStatus } from "./processToolContent"
import { processDeterministicDelegation } from "./deterministicDelegation"
import { ask } from "@features/chat/task/notifications/actions/ask"
import { mcpBroadcast } from "@features/chat/task/messages/actions/say"

/**
 * Result of tool execution, indicating whether delegation occurred.
 */
export interface ExecutionResult {
	isDelegated: boolean
}

/**
 * Executes an MCP tool call and processes the result.
 *
 * Flow:
 * 1. Sends execution started status to UI
 * 2. Injects _meta context (workspace path, agent role, task ID) into the MCP payload
 * 3. Calls the MCP tool via McpHub
 * 4. If the tool returns _meta.ui (interactive app), creates an interactive_app ask
 *    and handles the user's response (including deterministic delegation for manage_todo_plan)
 * 5. If no _meta.ui, processes the tool content normally
 * 6. Sends completion status and creates the mcp_server_response say message
 *
 * @returns ExecutionResult with isDelegated flag, or void if no delegation
 */

/** Typed helper to access getTaskMode on an ITaskModel without as-unknown. */
function getTaskWithMode(task: ITaskModel): ITaskModel & { getTaskMode: () => Promise<string> } {
	return task as ITaskModel & { getTaskMode: () => Promise<string> }
}

async function handleInteractiveApp(
	task: ITaskModel,
	serverName: string,
	toolName: string,
	parsedArguments: { [key: string]: unknown } | undefined,
	toolResult: {
		_meta?: { ui?: { resourceUri?: string } }
		isError?: boolean
		content?: { type: string; text: string }[]
	},
	executionId: string,
	pushToolResult: (content: ToolResponse) => void,
): Promise<ExecutionResult | void> {
	const uiMeta = toolResult._meta?.ui ? { ...toolResult._meta.ui, input: parsedArguments } : {}
	const interactiveAppMeta = { resourceUri: toolResult._meta?.ui?.resourceUri, input: parsedArguments }

	const { response, text } = await ask(task.taskId, "interactive_app", JSON.stringify(uiMeta))

	if (response !== "yesButtonClicked") {
		const toolResultPretty = "User cancelled the interactive app."
		toolResult.isError = true
		toolResult.content = [{ type: "text", text: toolResultPretty }]
		await finalizeInteractiveApp(
			task,
			executionId,
			toolResult,
			toolResultPretty,
			interactiveAppMeta,
			pushToolResult,
		)
		return
	}

	const toolResultPretty = text || "Interactive app completed successfully."
	toolResult.content = [{ type: "text", text: toolResultPretty }]

	const delegationResult = await tryDeterministicDelegation(task, serverName, toolName, text)
	if (delegationResult) return delegationResult

	await finalizeInteractiveApp(task, executionId, toolResult, toolResultPretty, interactiveAppMeta, pushToolResult)
}

async function tryDeterministicDelegation(
	task: ITaskModel,
	serverName: string,
	toolName: string,
	text: string | undefined,
): Promise<ExecutionResult | void> {
	if (serverName !== "md-todo-mcp" || toolName !== "manage_todo_plan" || typeof text !== "string") {
		return
	}

	try {
		const delegationResult = await processDeterministicDelegation(task, text)

		if (delegationResult === null) {
			const _toolResultPretty =
				"Plan cancelled: the user removed all tasks during review. No tasks to execute. Use attempt_completion to inform the user."
			task._state.setTodoList([])
			return
		}

		console.log(
			`[DeterministicDelegation] Delegation complete, parent aborted. Returning isDelegated=true to stop orchestration loop.`,
		)
		return { isDelegated: true }
	} catch (e) {
		console.error("[jabberwock] [DeterministicDelegation] Failed to process approved plan", e)
	}
}

async function finalizeInteractiveApp(
	task: ITaskModel,
	executionId: string,
	toolResult: { isError?: boolean; content?: { type: string; text: string }[] },
	toolResultPretty: string,
	interactiveAppMeta: { [key: string]: unknown },
	pushToolResult: (content: ToolResponse) => void,
): Promise<void> {
	await sendExecutionStatus(task, {
		executionId,
		status: toolResult.isError ? "error" : "completed",
		response: toolResultPretty,
		error: toolResult.isError ? "Error executing MCP tool" : undefined,
	})

	const sayText = JSON.stringify({ _interactiveMeta: interactiveAppMeta, response: toolResultPretty })
	await mcpBroadcast(task.taskId, "mcp_server_response", sayText)
	pushToolResult(formatResponse.toolResult(toolResultPretty, []))
}

function processNonInteractiveOutput(toolResult: { isError?: boolean; content: { type: string; text: string }[] }): {
	toolResultPretty: string
	images: string[]
} {
	const { text: outputText, images: extractedImages } = processToolContent(toolResult)
	const images = extractedImages

	if (outputText || images.length > 0) {
		const toolResultPretty =
			(toolResult.isError ? "Error:\n" : "") +
			(outputText || (images.length > 0 ? `[${images.length} image(s) received]` : ""))
		return { toolResultPretty, images }
	}

	return { toolResultPretty: "(No response)", images: [] }
}

export async function executeToolAndProcessResult(
	task: ITaskModel,
	serverName: string,
	toolName: string,
	parsedArguments: { [key: string]: unknown } | undefined,
	executionId: string,
	pushToolResult: (content: ToolResponse) => void,
): Promise<ExecutionResult | void> {
	await mcpBroadcast(task.taskId, "mcp_server_request_started")
	await sendExecutionStatus(task, { executionId, status: "started", serverName, toolName })

	const activeAgentRole = await getTaskWithMode(task).getTaskMode()
	const argsWithMeta = {
		...(parsedArguments || {}),
		_meta: { workspacePath: task.workspacePath, activeAgentRole, taskId: task.taskId },
	}

	const mcpHub = getMcpServerManager().getMcpHub()
	const toolResult = await mcpHub?.callTool(serverName, toolName, argsWithMeta)

	if (!toolResult) {
		await sendExecutionStatus(task, { executionId, status: "error", error: "No response from MCP server" })
		await mcpBroadcast(task.taskId, "mcp_server_response", "(No response)")
		pushToolResult(formatResponse.toolResult("(No response)", []))
		return
	}

	const mcpToolResult: { isError?: boolean; content: { type: string; text: string }[] } = {
		isError: toolResult.isError,
		content: (toolResult.content ?? []).map((item) => ({
			type: item.type,
			text: "text" in item ? item.text : "",
		})),
	}

	if (toolResult._meta?.ui) {
		const result = await handleInteractiveApp(
			task,
			serverName,
			toolName,
			parsedArguments,
			{ ...mcpToolResult, _meta: toolResult._meta as { ui?: { resourceUri?: string } } | undefined },
			executionId,
			pushToolResult,
		)
		if (result) return result
	}

	const { toolResultPretty, images } = processNonInteractiveOutput(mcpToolResult)
	await sendExecutionStatus(task, {
		executionId,
		status: toolResult.isError ? "error" : "completed",
		response: toolResultPretty,
		error: toolResult.isError ? "Error executing MCP tool" : undefined,
	})

	await mcpBroadcast(task.taskId, "mcp_server_response", toolResultPretty, images)
	pushToolResult(formatResponse.toolResult(toolResultPretty, images))
}

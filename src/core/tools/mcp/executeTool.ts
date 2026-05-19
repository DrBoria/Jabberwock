import { Task } from "../../../features/chat/task/Task"
import { formatResponse } from "../../prompts/responses"
import type { ToolResponse } from "../../../shared/tools"
import { processToolContent, sendExecutionStatus } from "./processToolContent"
import { processDeterministicDelegation } from "./deterministicDelegation"

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
export async function executeToolAndProcessResult(
	task: Task,
	serverName: string,
	toolName: string,
	parsedArguments: Record<string, unknown> | undefined,
	executionId: string,
	pushToolResult: (content: ToolResponse) => void,
): Promise<ExecutionResult | void> {
	await task.say("mcp_server_request_started")

	// Send started status
	await sendExecutionStatus(task, {
		executionId,
		status: "started",
		serverName,
		toolName,
	})

	// Core Phase 1: Inject _meta context into MCP payload
	// Avoids LLM context bloat/hallucinations by algorthmically providing execution details
	const activeAgentRole = await task.getTaskMode()
	const argsWithMeta = {
		...(parsedArguments || {}),
		_meta: {
			workspacePath: task.workspacePath,
			activeAgentRole,
			taskId: task.taskId,
		},
	}

	const mcpHub = await task.providerRef.deref()?.getMcpHub()
	const toolResult = await mcpHub?.callTool(serverName, toolName, argsWithMeta)

	let toolResultPretty = "(No response)"
	let images: string[] = []

	// Track interactive app metadata for frontend rendering
	let interactiveAppMeta: Record<string, unknown> | undefined

	if (toolResult) {
		if (toolResult._meta?.ui) {
			// Interactive App: Elicitation handling
			// Pause execution, send the UI metadata to the webview, and wait for user response
			//
			// NOTE: We do NOT release presentAssistantMessageLocked here. The blocking
			// task.ask() is called from within presentAssistantMessage, which holds the lock.
			// The outer pWaitFor in toolCallExecutor.ts has a 60s timeout, but the inner
			// pWaitFor in ask/store.ts has no timeout — it waits indefinitely for user response.
			//
			// To prevent the 60s timeout from firing while waiting for interactive app user input,
			// toolCallExecutor.ts checks for pending interactive_app asks and extends the timeout.
			const uiMeta = {
				...toolResult._meta.ui,
				input: parsedArguments,
			}
			// Store interactive app metadata so we can include it in the say message
			interactiveAppMeta = {
				resourceUri: toolResult._meta.ui.resourceUri,
				input: parsedArguments,
			}
			const { response, text } = await task.ask("interactive_app", JSON.stringify(uiMeta))

			if (response !== "yesButtonClicked") {
				toolResultPretty = "User cancelled the interactive app."
				toolResult.isError = true
				toolResult.content = [{ type: "text", text: toolResultPretty }]
			} else {
				toolResultPretty = text || "Interactive app completed successfully."
				toolResult.content = [{ type: "text", text: toolResultPretty }]

				// Deterministic delegation: after manage_todo_plan approval, bypass LLM and
				// programmatically create subtasks for each approved task.
				if (serverName === "md-todo-mcp" && toolName === "manage_todo_plan" && typeof text === "string") {
					try {
						const delegationResult = await processDeterministicDelegation(task, text)

						if (delegationResult === null) {
							// All tasks deleted by user — plan cancelled
							toolResultPretty =
								"Plan cancelled: the user removed all tasks during review. No tasks to execute. Use attempt_completion to inform the user."
							toolResult.content = [{ type: "text", text: toolResultPretty }]
							task.todoList = []
						} else {
							toolResultPretty = delegationResult.toolResultPretty
							toolResult.content = [{ type: "text", text: toolResultPretty }]

							if (delegationResult.isDelegated) {
								// CRITICAL: Return early with isDelegated=true to signal
								// presentAssistantMessage.ts:1040 to abort the orchestration loop.
								// The parent task has been aborted by delegateParentAndOpenChild,
								// so we must NOT call task.say() or pushToolResult() on the
								// now-aborted parent — those calls would be lost anyway.
								console.log(
									"[DeterministicDelegation] Delegation complete, parent aborted. Returning isDelegated=true to stop orchestration loop.",
								)
								return { isDelegated: true }
							}

							// CRITICAL: Even for async-only tasks (no sync delegation), we must still
							// return isDelegated=true to prevent the orchestration loop from continuing.
							// Without this, the LLM sees the tool result + rewritten history and may
							// re-issue the same manage_todo_plan call, causing duplicate messages.
							// The parent task should be aborted after delegation regardless of sync/async.
							console.log(
								"[DeterministicDelegation] Async-only delegation complete. Returning isDelegated=true to stop orchestration loop and prevent duplicate tool calls.",
							)
							return { isDelegated: true }
						}
					} catch (e) {
						console.error("[DeterministicDelegation] Failed to process approved plan", e)
					}
				}
			}
		} else {
			const { text: outputText, images: extractedImages } = processToolContent(toolResult)
			images = extractedImages

			if (outputText || images.length > 0) {
				await sendExecutionStatus(task, {
					executionId,
					status: "output",
					response: outputText || (images.length > 0 ? `[${images.length} image(s)]` : ""),
				})

				toolResultPretty =
					(toolResult.isError ? "Error:\n" : "") +
					(outputText || (images.length > 0 ? `[${images.length} image(s) received]` : ""))
			}
		}

		// Send completion status
		await sendExecutionStatus(task, {
			executionId,
			status: toolResult.isError ? "error" : "completed",
			response: toolResultPretty,
			error: toolResult.isError ? "Error executing MCP tool" : undefined,
		})
	} else {
		// Send error status if no result
		await sendExecutionStatus(task, {
			executionId,
			status: "error",
			error: "No response from MCP server",
		})
	}

	// If this was an interactive app, wrap the response with metadata so the frontend
	// can render the iframe (e.g., md-todo-mcp UI) instead of raw JSON text.
	const sayText = interactiveAppMeta
		? JSON.stringify({
				_interactiveMeta: interactiveAppMeta,
				response: toolResultPretty,
			})
		: toolResultPretty

	await task.say("mcp_server_response", sayText, images)
	pushToolResult(formatResponse.toolResult(toolResultPretty, images))
}

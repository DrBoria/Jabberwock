import type { ClineAskUseMcpServer, McpExecutionStatus } from "@jabberwock/types"

import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { t } from "../../i18n"
import type { ToolUse } from "../../shared/tools"
import { toolNamesMatch } from "../../utils/mcp-name"

import { BaseTool, ToolCallbacks } from "./BaseTool"

interface UseMcpToolParams {
	server_name: string
	tool_name: string
	arguments?: Record<string, unknown>
}

type ValidationResult =
	| { isValid: false }
	| {
			isValid: true
			serverName: string
			toolName: string
			parsedArguments?: Record<string, unknown>
	  }

export class UseMcpToolTool extends BaseTool<"use_mcp_tool"> {
	readonly name = "use_mcp_tool" as const

	async execute(params: UseMcpToolParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { askApproval, handleError, pushToolResult } = callbacks

		try {
			// Validate parameters
			const validation = await this.validateParams(task, params, pushToolResult)
			if (!validation.isValid) {
				return
			}

			const { serverName, toolName, parsedArguments } = validation

			// Validate that the tool exists on the server
			const toolValidation = await this.validateToolExists(task, serverName, toolName, pushToolResult)
			if (!toolValidation.isValid) {
				return
			}

			// Use the resolved tool name (original name from the server) for MCP calls
			// This handles cases where models mangle hyphens to underscores
			const resolvedToolName = toolValidation.resolvedToolName ?? toolName

			// Reset mistake count on successful validation
			task.consecutiveMistakeCount = 0

			// Get user approval
			const completeMessage = JSON.stringify({
				type: "use_mcp_tool",
				serverName,
				toolName: resolvedToolName,
				arguments: params.arguments ? JSON.stringify(params.arguments) : undefined,
			} satisfies ClineAskUseMcpServer)

			const executionId = task.lastMessageTs?.toString() ?? Date.now().toString()

			// Approval always uses standard MCP approval flow
			// Interactive app UI rendering happens in executeToolAndProcessResult when tool returns _meta.ui
			const didApprove = await askApproval("use_mcp_server", completeMessage)

			if (!didApprove) {
				return
			}

			// Execute the tool and process results
			await this.executeToolAndProcessResult(
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

	override async handlePartial(task: Task, block: ToolUse<"use_mcp_tool">): Promise<void> {
		const params = block.params
		const partialMessage = JSON.stringify({
			type: "use_mcp_tool",
			serverName: params.server_name ?? "",
			toolName: params.tool_name ?? "",
			arguments: params.arguments,
		} satisfies ClineAskUseMcpServer)

		await task.ask("use_mcp_server", partialMessage, true).catch(() => {})
	}

	private async validateParams(
		task: Task,
		params: UseMcpToolParams,
		pushToolResult: (content: string) => void,
	): Promise<ValidationResult> {
		if (!params.server_name) {
			task.consecutiveMistakeCount++
			task.recordToolError("use_mcp_tool")
			pushToolResult(await task.sayAndCreateMissingParamError("use_mcp_tool", "server_name"))
			return { isValid: false }
		}

		if (!params.tool_name) {
			task.consecutiveMistakeCount++
			task.recordToolError("use_mcp_tool")
			pushToolResult(await task.sayAndCreateMissingParamError("use_mcp_tool", "tool_name"))
			return { isValid: false }
		}

		// Native-only: arguments are already a structured object.
		let parsedArguments: Record<string, unknown> | undefined
		if (params.arguments !== undefined) {
			if (typeof params.arguments !== "object" || params.arguments === null || Array.isArray(params.arguments)) {
				task.consecutiveMistakeCount++
				task.recordToolError("use_mcp_tool")
				await task.say("error", t("mcp:errors.invalidJsonArgument", { toolName: params.tool_name }))
				task.didToolFailInCurrentTurn = true
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

	private async validateToolExists(
		task: Task,
		serverName: string,
		toolName: string,
		pushToolResult: (content: string) => void,
	): Promise<{ isValid: boolean; availableTools?: string[]; resolvedToolName?: string }> {
		try {
			// Get the MCP hub to access server information
			const provider = task.providerRef.deref()
			const mcpHub = provider?.getMcpHub()

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

				task.consecutiveMistakeCount++
				task.recordToolError("use_mcp_tool")
				await task.say("error", t("mcp:errors.serverNotFound", { serverName, availableServers }))
				task.didToolFailInCurrentTurn = true

				pushToolResult(formatResponse.unknownMcpServerError(serverName, availableServersArray))
				return { isValid: false, availableTools: [] }
			}

			// Check if the server has tools defined
			if (!server.tools || server.tools.length === 0) {
				// No tools available on this server
				task.consecutiveMistakeCount++
				task.recordToolError("use_mcp_tool")
				await task.say(
					"error",
					t("mcp:errors.toolNotFound", {
						toolName,
						serverName,
						availableTools: "No tools available",
					}),
				)
				task.didToolFailInCurrentTurn = true

				pushToolResult(formatResponse.unknownMcpToolError(serverName, toolName, []))
				return { isValid: false, availableTools: [] }
			}

			// Check if the requested tool exists (using fuzzy matching to handle model mangling of hyphens)
			const tool = server.tools.find((t) => toolNamesMatch(t.name, toolName))

			if (!tool) {
				// Tool not found - provide list of available tools
				const availableToolNames = server.tools.map((tool) => tool.name)

				task.consecutiveMistakeCount++
				task.recordToolError("use_mcp_tool")
				await task.say(
					"error",
					t("mcp:errors.toolNotFound", {
						toolName,
						serverName,
						availableTools: availableToolNames.join(", "),
					}),
				)
				task.didToolFailInCurrentTurn = true

				pushToolResult(formatResponse.unknownMcpToolError(serverName, toolName, availableToolNames))
				return { isValid: false, availableTools: availableToolNames }
			}

			// Check if the tool is disabled (enabledForPrompt is false)
			if (tool.enabledForPrompt === false) {
				// Tool is disabled - only show enabled tools
				const enabledTools = server.tools.filter((t) => t.enabledForPrompt !== false)
				const enabledToolNames = enabledTools.map((t) => t.name)

				task.consecutiveMistakeCount++
				task.recordToolError("use_mcp_tool")
				await task.say(
					"error",
					t("mcp:errors.toolDisabled", {
						toolName,
						serverName,
						availableTools:
							enabledToolNames.length > 0 ? enabledToolNames.join(", ") : "No enabled tools available",
					}),
				)
				task.didToolFailInCurrentTurn = true

				pushToolResult(formatResponse.unknownMcpToolError(serverName, toolName, enabledToolNames))
				return { isValid: false, availableTools: enabledToolNames }
			}

			// Tool exists and is enabled - return the original tool name for use with the MCP server
			return { isValid: true, availableTools: server.tools.map((t) => t.name), resolvedToolName: tool.name }
		} catch (error) {
			// If there's an error during validation, log it but don't block the tool execution
			// The actual tool call might still fail with a proper error
			console.error("Error validating MCP tool existence:", error)
			return { isValid: true }
		}
	}

	private async sendExecutionStatus(task: Task, status: McpExecutionStatus): Promise<void> {
		const clineProvider = await task.providerRef.deref()
		clineProvider?.postMessageToWebview({
			type: "mcpExecutionStatus",
			text: JSON.stringify(status),
		})
	}

	private processToolContent(toolResult: any): { text: string; images: string[] } {
		if (!toolResult?.content || toolResult.content.length === 0) {
			return { text: "", images: [] }
		}

		const images: string[] = []

		const textContent = toolResult.content
			.map((item: any) => {
				if (item.type === "text") {
					return item.text
				}
				if (item.type === "resource") {
					const { blob: _, ...rest } = item.resource
					return JSON.stringify(rest, null, 2)
				}
				if (item.type === "image") {
					// Handle image content (MCP image content has mimeType and data properties)
					if (item.mimeType && item.data) {
						if (item.data.startsWith("data:")) {
							images.push(item.data)
						} else {
							images.push(`data:${item.mimeType};base64,${item.data}`)
						}
					}
					return ""
				}
				return ""
			})
			.filter(Boolean)
			.join("\n\n")

		return { text: textContent, images }
	}

	private async executeToolAndProcessResult(
		task: Task,
		serverName: string,
		toolName: string,
		parsedArguments: Record<string, unknown> | undefined,
		executionId: string,
		pushToolResult: (content: string | Array<any>) => void,
	): Promise<void> {
		await task.say("mcp_server_request_started")

		// Send started status
		await this.sendExecutionStatus(task, {
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

		const toolResult = await task.providerRef.deref()?.getMcpHub()?.callTool(serverName, toolName, argsWithMeta)

		let toolResultPretty = "(No response)"
		let images: string[] = []

		if (toolResult) {
			if (toolResult._meta?.ui) {
				// Interactive App: Elicitation handling
				// Pause execution, send the UI metadata to the webview, and wait for user response
				const uiMeta = {
					...toolResult._meta.ui,
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
							const newPlan = JSON.parse(text)
							const approvedTasks = (newPlan.initialTasks || newPlan.tasks || []) as {
								id: string
								title: string
								description?: string
								assignedTo: string
								isAsync?: boolean
							}[]

							console.log(
								`[DeterministicDelegation] Approved tasks count: ${approvedTasks.length}`,
								approvedTasks.map((t) => `${t.id}:${t.assignedTo}:${t.title}`),
							)

							if (approvedTasks.length === 0) {
								console.log(
									"[DeterministicDelegation] All tasks deleted by user. Signaling plan cancellation.",
								)
								toolResultPretty =
									"Plan cancelled: the user removed all tasks during review. No tasks to execute. Use attempt_completion to inform the user."
								toolResult.content = [{ type: "text", text: toolResultPretty }]
								task.todoList = [] as any
							} else {
								task.todoList = approvedTasks.map((t) => ({
									id: t.id,
									content: `${t.title}${t.description ? ": " + t.description : ""}`,
									status: "pending",
									assignedTo: t.assignedTo,
								}))

								// Bypass LLM: programmatically create subtasks for each approved task
								const provider = task.providerRef.deref()
								if (!provider) {
									console.error("[DeterministicDelegation] Provider reference lost, cannot delegate")
								} else {
									const delegationResults: string[] = []
									let isDelegated = false

									for (const todoTask of approvedTasks) {
										// Wrap task in EXECUTION ONLY directive to prevent child re-planning
										const delegationMessage = `[EXECUTION ONLY - DO NOT RE-PLAN]\nYou have been assigned this task from an approved master plan. Do NOT create a new TODO list or re-plan. Execute the following task immediately:\n\n${todoTask.title}${todoTask.description ? "\n\n" + todoTask.description : ""}`

										console.log(
											`[DeterministicDelegation] Delegating task ${todoTask.id} to ${todoTask.assignedTo}: ${todoTask.title}`,
										)

										try {
											if (todoTask.isAsync) {
												const child = await provider.startBackgroundTask({
													parentTaskId: task.taskId,
													message: delegationMessage,
													initialTodos: [],
													mode: todoTask.assignedTo,
												})

												// Store the created subtask's ID in the local todoList
												const todoItem = task.todoList?.find((todo) => todo.id === todoTask.id)
												if (todoItem) {
													todoItem.taskId = child.taskId
												}

												delegationResults.push(
													`✓ ${todoTask.id} → ${todoTask.assignedTo} (async, child: ${child.taskId})`,
												)
											} else {
												const child = await provider.delegateParentAndOpenChild({
													parentTaskId: task.taskId,
													message: delegationMessage,
													initialTodos: [],
													mode: todoTask.assignedTo,
												})

												// Store the created subtask's ID in the local todoList
												const todoItem = task.todoList?.find((todo) => todo.id === todoTask.id)
												if (todoItem) {
													todoItem.taskId = child.taskId
												}

												delegationResults.push(
													`✓ ${todoTask.id} → ${todoTask.assignedTo} (sync, child: ${child.taskId})`,
												)
												// delegateParentAndOpenChild is blocking
												console.log(
													`[DeterministicDelegation] Sync delegation complete for ${todoTask.id}.`,
												)
												isDelegated = true
												break
											}
										} catch (delegationError) {
											const errMsg =
												delegationError instanceof Error
													? delegationError.message
													: String(delegationError)
											console.error(
												`[DeterministicDelegation] Failed to delegate ${todoTask.id}: ${errMsg}`,
											)
											delegationResults.push(
												`✗ ${todoTask.id} → ${todoTask.assignedTo} FAILED: ${errMsg}`,
											)
										}
									}

									const summary = delegationResults.join("\n")
									toolResultPretty = `Plan approved. Deterministic delegation initiated:\n${summary}`
									toolResult.content = [{ type: "text", text: toolResultPretty }]

									// History Hack: Rewrite history to eliminate traces of the original mutation conversation
									const firstUserMsgIndex = task.apiConversationHistory.findIndex(
										(m) => m.role === "user",
									)
									const firstUserMsg =
										firstUserMsgIndex !== -1
											? task.apiConversationHistory[firstUserMsgIndex]
											: undefined

									const toolUseBlock = task.assistantMessageContent.find(
										(block) =>
											block.type === "tool_use" &&
											(block as any).name === "mcp--md-todo-mcp--manage_todo_plan",
									)
									const toolUseId = (toolUseBlock as any)?.id || "unknown-id"

									const environmentDetailsBlock = (firstUserMsg?.content as unknown[])?.find(
										(c) =>
											(c as { type: string; text?: string }).type === "text" &&
											(c as { type: string; text?: string }).text?.includes(
												"<environment_details>",
											),
									)

									const originalReasoning = task.assistantMessageContent
										.slice(0, task.currentStreamingContentIndex)
										.filter((block) => block.type === "text")
										.map((block) => (block as any).text || "")
										.join("\n\n")
										.trim()

									const synthesizedUserText = `${originalReasoning ? originalReasoning + "\n\n" : ""}I have updated my plan. Here are the approved tasks:\n${approvedTasks
										.map((t) => `- [${t.assignedTo}] ${t.title}`)
										.join("\n")}`

									const userMsg = {
										role: "user" as const,
										content: [
											{ type: "text" as const, text: synthesizedUserText },
											...(environmentDetailsBlock ? [environmentDetailsBlock] : []),
										],
										ts: firstUserMsg
											? (firstUserMsg as { ts?: number }).ts || Date.now()
											: Date.now(),
									}

									const assistantMsg = {
										role: "assistant" as const,
										content: [
											{
												type: "tool_use" as const,
												id: toolUseId,
												name: "mcp--md-todo-mcp--manage_todo_plan",
												input: { initialTasks: approvedTasks },
											},
										],
										ts: Date.now(),
									}

									const cleanHistory = [userMsg, assistantMsg]
									await task.overwriteApiConversationHistory(cleanHistory as any)
									console.log(
										"[HistoryRewrite] Successfully rebuilt clean history after plan approval.",
									)

									if (isDelegated) {
										return { isDelegated: true } as any
									}
								}
							}
						} catch (e) {
							console.error("[DeterministicDelegation] Failed to process approved plan", e)
						}
					}
				}
			} else {
				const { text: outputText, images: extractedImages } = this.processToolContent(toolResult)
				images = extractedImages

				if (outputText || images.length > 0) {
					await this.sendExecutionStatus(task, {
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
			await this.sendExecutionStatus(task, {
				executionId,
				status: toolResult.isError ? "error" : "completed",
				response: toolResultPretty,
				error: toolResult.isError ? "Error executing MCP tool" : undefined,
			})
		} else {
			// Send error status if no result
			await this.sendExecutionStatus(task, {
				executionId,
				status: "error",
				error: "No response from MCP server",
			})
		}

		await task.say("mcp_server_response", toolResultPretty, images)
		pushToolResult(formatResponse.toolResult(toolResultPretty, images))
	}
}

export const useMcpToolTool = new UseMcpToolTool()

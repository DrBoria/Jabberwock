import { z } from "zod"
import * as vscode from "vscode"

export function registerUiTools(mcpServer, provider) {
	mcpServer.tool(
		"interact_with_ui",
		{
			action: z
				.enum(["continue", "cancel", "approve_todo"])
				.describe("Action to take: continue, cancel, or approve_todo (executes the current interactive plan)"),
			state: z.any().optional().describe("Optional state to pass to the UI (e.g. mutated todo plan)"),
		},
		async ({ action, state }) => {
			try {
				const currentTask = provider.getCurrentTask()
				if (!currentTask) {
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify({ hasTask: false, error: "No active task available" }),
							},
						],
					}
				}

				if (action === "continue") {
					await provider.postMessageToWebview({ type: "invoke", invoke: "primaryButtonClick" })
					return { content: [{ type: "text", text: "Successfully invoked primary button (Continue)." }] }
				} else if (action === "cancel") {
					await provider.postMessageToWebview({ type: "invoke", invoke: "secondaryButtonClick" })
					return { content: [{ type: "text", text: "Successfully invoked secondary button (Cancel)." }] }
				} else if (action === "approve_todo") {
					// Step 1: Send the plan to the webview (triggers elicitationResponse → resolveElicitation)
					await provider.postMessageToWebview({ type: "invoke", invoke: "approveTodoPlan", values: state })
					// Step 2: Wait for the interactive_app ask to appear, then respond with the plan data
					// The interactive_app ask is created by UseMcpToolTool.ts when md-todo-mcp returns _meta.ui
					// We must wait for it because handleWebviewAskResponse sets askResponse, but
					// ask("interactive_app", ...) resets askResponse to undefined at the start.
					// If we call handleWebviewAskResponse before ask() resets it, the response is lost.
					const planJson = typeof state === "string" ? state : JSON.stringify(state)
					const deadline = Date.now() + 10000 // 10 second timeout
					let responded = false
					while (Date.now() < deadline) {
						// Check if the interactive_app ask exists in clineMessages
						const lastMsg = currentTask.clineMessages?.at(-1)
						if (lastMsg?.type === "ask" && lastMsg.ask === "interactive_app" && !lastMsg.partial) {
							currentTask.handleWebviewAskResponse("yesButtonClicked", planJson, undefined)
							responded = true
							break
						}
						// Wait 100ms before checking again
						await new Promise((resolve) => setTimeout(resolve, 100))
					}
					if (!responded) {
						// Fallback: try responding anyway (may work if timing is right)
						try {
							currentTask.handleWebviewAskResponse("yesButtonClicked", planJson, undefined)
						} catch (e) {
							// Ignore
						}
					}
					return { content: [{ type: "text", text: "Successfully invoked Todo Plan approval." }] }
				}

				return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)

	mcpServer.tool(
		"respond_to_ask",
		{
			response: z
				.enum(["yesButtonClicked", "noButtonClicked", "messageResponse", "objectResponse"])
				.describe("The type of response for the current question/ask"),
			text: z.string().optional().describe("Optional feedback text for the response"),
		},
		async ({ response, text }) => {
			try {
				const currentTask = provider.getCurrentTask()
				if (!currentTask) {
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify({ hasTask: false, error: "No active task to respond to" }),
							},
						],
					}
				}

				currentTask.askShownAt = undefined

				if (response === "objectResponse") {
					// objectResponse carries a JSON payload (e.g. a mutated todo plan).
					// Parse it and respond as "yesButtonClicked" with the plan data,
					// mirroring the approve_todo pattern in interact_with_ui.
					const planJson = text ?? "{}"
					currentTask.handleWebviewAskResponse("yesButtonClicked", planJson, undefined)
					return {
						content: [
							{
								type: "text",
								text: `Successfully sent objectResponse (parsed as yesButtonClicked with plan data).`,
							},
						],
					}
				}

				currentTask.handleWebviewAskResponse(response, text, undefined)
				return {
					content: [{ type: "text", text: `Successfully sent response "${response}" to current task.` }],
				}
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error responding to task: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				}
			}
		},
	)

	mcpServer.tool(
		"switch_mode",
		{
			mode: z.string().describe("The slug of the mode to switch to (e.g. 'architect', 'coder', 'ask')"),
		},
		async ({ mode }) => {
			try {
				await provider.handleModeSwitch(mode)
				return { content: [{ type: "text", text: `Successfully switched to mode: ${mode}` }] }
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error switching mode: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				}
			}
		},
	)
	mcpServer.tool("get_active_ask", {}, async () => {
		try {
			const currentTask = provider.getCurrentTask()
			if (!currentTask) {
				return { content: [{ type: "text", text: JSON.stringify({ hasTask: false, ask: null }) }] }
			}

			const lastMessage = currentTask.clineMessages.at(-1)
			if (lastMessage?.type === "ask" && !lastMessage.partial) {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									ask: lastMessage.ask,
									text: lastMessage.text,
									ts: lastMessage.ts,
								},
								null,
								2,
							),
						},
					],
				}
			}

			return { content: [{ type: "text", text: "No active ask message" }] }
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `Error getting active ask: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			}
		}
	})

	mcpServer.tool(
		"get_dom",
		{
			maxDepth: z
				.number()
				.optional()
				.describe("Maximum DOM depth to return (default: unlimited). Use lower values for a shallow overview."),
			maxChildren: z
				.number()
				.optional()
				.describe("Max children per node to show (default: all). Truncates wide nodes."),
		},
		async ({ maxDepth, maxChildren }) => {
			try {
				const dom = await provider.getWebviewDom(maxDepth, maxChildren)
				// The webview now returns CSS-selector format with aggressive compression.
				// Prepend [Webview] marker for context.
				const output = `[Webview]\n${dom}`
				return { content: [{ type: "text", text: output }] }
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error getting DOM: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				}
			}
		},
	)

	mcpServer.tool(
		"navigate_to_node",
		{
			nodeId: z
				.string()
				.describe("The ID of the task node to navigate to (empty string to return to active chat)"),
		},
		async ({ nodeId }) => {
			try {
				if (nodeId) {
					// Navigate to a specific task by rehydrating it from history
					const { historyItem } = await provider.getTaskWithId(nodeId)
					if (!historyItem) {
						return { content: [{ type: "text", text: `Task with ID ${nodeId} not found.` }], isError: true }
					}

					// Fire-and-forget: don't block SSE response channel with heavy operations.
					// createTaskWithHistoryItem, postStateToWebview, and postMessageToWebview
					// are all heavy (mode restore, API config restore, state serialization…)
					// and can take >60s, causing MCP timeout. Same pattern as create_new_task.
					provider
						.createTaskWithHistoryItem(historyItem)
						.then(async () => {
							await provider.postStateToWebview()
							await provider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
						})
						.catch((err: Error) => {
							console.error(`[navigate_to_node] background error: ${err.message}`)
						})
				} else {
					// Empty nodeId = return to active chat (lightweight, safe to await)
					await provider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
				}

				return {
					content: [
						{
							type: "text",
							text: `Successfully navigating to ${nodeId ? `node ${nodeId}` : "active chat"}`,
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error navigating: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				}
			}
		},
	)

	mcpServer.tool("navigate_to_history", {}, async () => {
		try {
			const p = provider as any
			const requestId = Math.random().toString(36).substring(7)
			const navResult = await new Promise<string>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error("Timeout waiting for navigation confirmation after 5s"))
				}, 5000)

				p.pendingActivePageRequests.set(requestId, (result: string) => {
					clearTimeout(timeout)
					resolve(result)
				})

				p.postMessageToWebview({
					type: "action",
					action: "historyButtonClicked",
					requestId,
				})
			})

			return {
				content: [{ type: "text", text: `Successfully navigated to History page (confirmed: ${navResult})` }],
			}
		} catch (error) {
			return { content: [{ type: "text", text: `Error: ${error}` }], isError: true }
		}
	})

	mcpServer.tool("navigate_to_settings", {}, async () => {
		try {
			const p = provider as any
			const requestId = Math.random().toString(36).substring(7)
			const navResult = await new Promise<string>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error("Timeout waiting for navigation confirmation after 5s"))
				}, 5000)

				p.pendingActivePageRequests.set(requestId, (result: string) => {
					clearTimeout(timeout)
					resolve(result)
				})

				p.postMessageToWebview({
					type: "action",
					action: "settingsButtonClicked",
					requestId,
				})
			})

			return {
				content: [{ type: "text", text: `Successfully navigated to Settings page (confirmed: ${navResult})` }],
			}
		} catch (error) {
			return { content: [{ type: "text", text: `Error: ${error}` }], isError: true }
		}
	})

	mcpServer.tool("navigate_to_marketplace", {}, async () => {
		try {
			const p = provider as any
			const requestId = Math.random().toString(36).substring(7)
			const navResult = await new Promise<string>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error("Timeout waiting for navigation confirmation after 5s"))
				}, 5000)

				p.pendingActivePageRequests.set(requestId, (result: string) => {
					clearTimeout(timeout)
					resolve(result)
				})

				p.postMessageToWebview({
					type: "action",
					action: "marketplaceButtonClicked",
					requestId,
				})
			})

			return {
				content: [
					{ type: "text", text: `Successfully navigated to Marketplace page (confirmed: ${navResult})` },
				],
			}
		} catch (error) {
			return { content: [{ type: "text", text: `Error: ${error}` }], isError: true }
		}
	})

	mcpServer.tool(
		"switch_agent_mode",
		{
			mode: z.string().describe("The slug of the mode to switch to"),
		},
		async (args) => {
			try {
				await provider.handleModeSwitch(args.mode)
				return { content: [{ type: "text", text: `Successfully switched to mode: ${args.mode}` }] }
			} catch (error) {
				return { content: [{ type: "text", text: `Error: ${error}` }], isError: true }
			}
		},
	)

	mcpServer.tool(
		"execute_vscode_command",
		{
			command: z
				.string()
				.describe(
					"The VS Code command ID to execute (e.g. 'jabberwock.historyButtonClicked', 'jabberwock.settingsButtonClicked', 'jabberwock.plusButtonClicked')",
				),
			args: z.any().optional().describe("Optional arguments to pass to the command"),
		},
		async ({ command, args }) => {
			try {
				const p = provider as any
				const requestId = Math.random().toString(36).substring(7)

				// Extract action name from command (e.g., "jabberwock.historyButtonClicked" -> "historyButtonClicked")
				const actionName = command.includes(".") ? command.split(".").pop()! : command

				const result = await new Promise<string>((resolve, reject) => {
					const timeout = setTimeout(() => {
						reject(new Error(`Timeout waiting for command '${command}' confirmation after 5s`))
					}, 5000)

					p.pendingActivePageRequests.set(requestId, (result: string) => {
						clearTimeout(timeout)
						resolve(result)
					})

					p.postMessageToWebview({
						type: "action",
						action: actionName,
						requestId,
					})
				})

				return {
					content: [
						{
							type: "text",
							text: `Successfully executed VS Code command: ${command} (confirmed: ${result})`,
						},
					],
				}
			} catch (error) {
				return { content: [{ type: "text", text: `Error executing VS Code command: ${error}` }], isError: true }
			}
		},
	)

	mcpServer.tool("get_available_agents", {}, async () => {
		try {
			const { customModes } = await provider.getState()
			const { getAllModes } = await import("../../../shared/modes")
			const modes = getAllModes(customModes)
			// Strip to minimal payload: only slug, name, description
			const stripped = modes.map((m) => ({
				slug: m.slug,
				name: m.name,
				...(m.description ? { description: m.description } : {}),
			}))
			return { content: [{ type: "text", text: JSON.stringify(stripped, null, 2) }] }
		} catch (error) {
			return { content: [{ type: "text", text: `Error: ${error}` }], isError: true }
		}
	})

	mcpServer.tool("get_window_stack", {}, async () => {
		try {
			const currentTask = provider.getCurrentTask()
			if (!currentTask) {
				return { content: [{ type: "text", text: JSON.stringify([]) }] }
			}

			// Build a simple window stack from the task hierarchy
			const stack: Array<{ taskId: string; mode: string; title?: string }> = []
			let task = currentTask
			while (task) {
				stack.push({
					taskId: task.taskId,
					mode: task.taskMode,
					title: task.clineMessages?.[0]?.text?.substring(0, 100),
				})
				task = (task as any).parentTask
			}

			return { content: [{ type: "text", text: JSON.stringify(stack, null, 2) }] }
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `Error getting window stack: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			}
		}
	})

	mcpServer.tool("get_active_page", {}, async () => {
		try {
			// Ask the webview for the active page via a dedicated message
			const activePage = await new Promise<string>((resolve, reject) => {
				const requestId = Math.random().toString(36).substring(7)
				const timeout = setTimeout(() => {
					reject(new Error("Timeout waiting for active page response after 3s"))
				}, 3000)

				const p = provider as any

				// Register a one-time pending request on the provider
				p.pendingActivePageRequests.set(requestId, (result: string) => {
					clearTimeout(timeout)
					resolve(result)
				})

				// Send request to webview
				p.postMessageToWebview({
					type: "action",
					action: "getActivePage",
					requestId,
				})
			})

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({ activePage }, null, 2),
					},
				],
			}
		} catch (error) {
			return { content: [{ type: "text", text: `Error: ${error}` }], isError: true }
		}
	})
}

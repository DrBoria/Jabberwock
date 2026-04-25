import { z } from "zod"
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ClineProvider } from "../../webview/ClineProvider"
import { getSnapshot } from "mobx-state-tree"
import { getNativeTools } from "../../prompts/tools/native-tools"
import { diagnosticsManager } from "../DiagnosticsManager"
import { Package } from "../../../shared/package"
import { agentStore } from "../../state/AgentStore"
import { getWorkspacePath } from "../../../utils/path"

export function registerStateTools(mcpServer: McpServer, provider: ClineProvider) {
	mcpServer.tool(
		"get_mst_state",
		{ nodeId: z.string().optional().describe("Optional: specific node ID to inspect. Omit for full tree.") },
		async ({ nodeId }) => {
			try {
				const snapshot = getSnapshot(provider.chatStore)
				if (nodeId) {
					const node = (snapshot.nodes as any)[nodeId]
					if (!node)
						return { content: [{ type: "text", text: `Node '${nodeId}' not found.` }], isError: true }
					return { content: [{ type: "text", text: JSON.stringify(node, null, 2) }] }
				}
				return { content: [{ type: "text", text: JSON.stringify(snapshot, null, 2) }] }
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

	mcpServer.tool("get_extension_info", {}, async () => {
		try {
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								name: Package.name,
								version: Package.version,
								stackSize: provider.getTaskStackSize(),
								activeNodeId: provider.chatStore.activeNodeId,
								nodesCount: Object.keys(getSnapshot(provider.chatStore).nodes || {}).length,
							},
							null,
							2,
						),
					},
				],
			}
		} catch (error) {
			return {
				content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true,
			}
		}
	})

	mcpServer.tool("get_available_native_tools", {}, async () => {
		try {
			return { content: [{ type: "text", text: JSON.stringify(getNativeTools(), null, 2) }] }
		} catch (error) {
			return {
				content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true,
			}
		}
	})

	mcpServer.tool("get_devtools_state", {}, async () => {
		try {
			const snapshot = diagnosticsManager.getSnapshot()
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								extension: {
									name: Package.name,
									version: Package.version,
									stackSize: provider.getTaskStackSize(),
									activeNodeId: provider.chatStore.activeNodeId,
								},
								diagnostics: snapshot,
							},
							null,
							2,
						),
					},
				],
			}
		} catch (error) {
			return {
				content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true,
			}
		}
	})
	mcpServer.tool("get_internal_state", {}, async () => {
		try {
			const providerState = await provider.getState()
			const agentsSnapshot = getSnapshot(provider.chatStore)

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								tasks: Object.values(agentsSnapshot.nodes || {}),
								agents: Array.from(agentStore.agents.values()),
								settings: providerState,
								workspace: getWorkspacePath(),
								activeTaskId: provider.getCurrentTask()?.taskId,
								stackSize: provider.getTaskStackSize(),
							},
							null,
							2,
						),
					},
				],
			}
		} catch (error) {
			return {
				content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true,
			}
		}
	})

	// ============================================================
	// Phase 2: High-level state tools for E2E testing
	// ============================================================

	mcpServer.tool("get_current_state", {}, async () => {
		try {
			const targetTask = provider.getCurrentTask()

			if (!targetTask) {
				return {
					content: [{ type: "text", text: JSON.stringify({ hasTask: false }, null, 2) }],
				}
			}

			const state = {
				hasTask: true,
				taskId: targetTask.taskId,
				mode: targetTask.taskMode || (await targetTask.getTaskMode()),
				isStreaming: targetTask.isStreaming,
				todoCount: targetTask.todoList?.length ?? 0,
				todoItems: (targetTask.todoList || []).map((t: any) => ({
					id: t.id,
					title: t.title,
					description: t.description,
					status: t.status,
					assignedTo: t.assignedTo,
				})),
				askType: targetTask.idleAsk?.ask || targetTask.resumableAsk?.ask || null,
				askText: targetTask.idleAsk?.text || targetTask.resumableAsk?.text || null,
				childTaskCount: targetTask.childTasks?.length ?? 0,
				childTasks: (targetTask.childTasks || []).map((c: any) => ({
					id: c.taskId,
					mode: c.taskMode,
					isStreaming: c.isStreaming,
					todoCount: c.todoList?.length ?? 0,
				})),
			}

			return { content: [{ type: "text", text: JSON.stringify(state, null, 2) }] }
		} catch (error) {
			return {
				content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true,
			}
		}
	})

	mcpServer.tool(
		"get_last_model_message",
		{
			maxLength: z.number().optional().describe("Max characters to return (default: 2000)"),
		},
		async ({ maxLength = 2000 }) => {
			try {
				const targetTask = provider.getCurrentTask()

				if (!targetTask) {
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify({ hasTask: false, message: "No active task" }, null, 2),
							},
						],
					}
				}

				// Get the last assistant message from clineMessages
				const messages = (targetTask as any).clineMessages || []
				const assistantMessages = messages.filter((m: any) => m.type === "say" && m.say === "text")
				const lastAssistantMsg = assistantMessages[assistantMessages.length - 1]

				if (!lastAssistantMsg) {
					return {
						content: [
							{ type: "text", text: JSON.stringify({ message: "No model messages found" }, null, 2) },
						],
					}
				}

				const text = lastAssistantMsg.text || ""
				const truncated = text.length > maxLength ? text.slice(0, maxLength) + "..." : text

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									ts: lastAssistantMsg.ts,
									text: truncated,
									truncated: text.length > maxLength,
									fullLength: text.length,
								},
								null,
								2,
							),
						},
					],
				}
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
		"wait_for_todo",
		{
			timeoutMs: z.number().optional().describe("Max wait time in ms (default: 30000)"),
			minCount: z.number().optional().describe("Minimum todo count to wait for (default: 1)"),
		},
		async ({ timeoutMs = 30000, minCount = 1 }) => {
			try {
				const startTime = Date.now()

				while (Date.now() - startTime < timeoutMs) {
					const targetTask = provider.getCurrentTask()

					if (!targetTask) {
						await new Promise((r) => setTimeout(r, 500))
						continue
					}

					const todoCount = targetTask.todoList?.length ?? 0
					if (todoCount >= minCount) {
						return {
							content: [
								{
									type: "text",
									text: JSON.stringify(
										{
											success: true,
											todoCount,
											todoItems: (targetTask.todoList || []).map((t: any) => ({
												id: t.id,
												title: t.title,
												description: t.description,
												status: t.status,
												assignedTo: t.assignedTo,
											})),
											elapsedMs: Date.now() - startTime,
										},
										null,
										2,
									),
								},
							],
						}
					}

					await new Promise((r) => setTimeout(r, 500))
				}

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: false,
									error: `Timeout waiting for todo count >= ${minCount}`,
									elapsedMs: Date.now() - startTime,
								},
								null,
								2,
							),
						},
					],
					isError: true,
				}
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
		"wait_for_ask_type",
		{
			askType: z.string().describe("The ask type to wait for (e.g., 'use_mcp_server', 'tool', 'followup')"),
			timeoutMs: z.number().optional().describe("Max wait time in ms (default: 30000)"),
		},
		async ({ askType, timeoutMs = 30000 }) => {
			try {
				const startTime = Date.now()
				let targetTask: any = null

				while (Date.now() - startTime < timeoutMs) {
					targetTask = provider.getCurrentTask()

					if (!targetTask) {
						await new Promise((r) => setTimeout(r, 500))
						continue
					}

					const currentAskType = targetTask.idleAsk?.ask || targetTask.resumableAsk?.ask || null

					if (currentAskType === askType) {
						return {
							content: [
								{
									type: "text",
									text: JSON.stringify(
										{
											success: true,
											askType: currentAskType,
											askText: targetTask.idleAsk?.text || targetTask.resumableAsk?.text || null,
											elapsedMs: Date.now() - startTime,
										},
										null,
										2,
									),
								},
							],
						}
					}

					await new Promise((r) => setTimeout(r, 500))
				}

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: false,
									error: `Timeout waiting for ask type '${askType}'`,
									lastAskType: targetTask?.idleAsk?.ask || targetTask?.resumableAsk?.ask || null,
									elapsedMs: Date.now() - startTime,
								},
								null,
								2,
							),
						},
					],
					isError: true,
				}
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
		"verify_state",
		{
			expectations: z
				.string()
				.describe(
					'JSON object describing expected state. Example: {"hasTodo": true, "askType": "use_mcp_server", "mode": "orchestrator"}',
				),
		},
		async ({ expectations }) => {
			try {
				const parsed = JSON.parse(expectations)
				const targetTask = provider.getCurrentTask()

				if (!targetTask) {
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{ verified: false, errors: ["No active task found"], hasTask: false },
									null,
									2,
								),
							},
						],
					}
				}

				const errors: string[] = []
				const actual: Record<string, any> = {}

				if ("hasTodo" in parsed) {
					const hasTodo = (targetTask.todoList?.length ?? 0) > 0
					actual.hasTodo = hasTodo
					if (hasTodo !== parsed.hasTodo) {
						errors.push(`hasTodo: expected ${parsed.hasTodo}, got ${hasTodo}`)
					}
				}

				if ("todoCount" in parsed) {
					const todoCount = targetTask.todoList?.length ?? 0
					actual.todoCount = todoCount
					if (todoCount !== parsed.todoCount) {
						errors.push(`todoCount: expected ${parsed.todoCount}, got ${todoCount}`)
					}
				}

				if ("askType" in parsed) {
					const askType = targetTask.idleAsk?.ask || targetTask.resumableAsk?.ask || null
					actual.askType = askType
					if (askType !== parsed.askType) {
						errors.push(`askType: expected ${parsed.askType}, got ${askType}`)
					}
				}

				if ("isStreaming" in parsed) {
					actual.isStreaming = targetTask.isStreaming
					if (targetTask.isStreaming !== parsed.isStreaming) {
						errors.push(`isStreaming: expected ${parsed.isStreaming}, got ${targetTask.isStreaming}`)
					}
				}

				if ("mode" in parsed) {
					const mode = targetTask.taskMode || (await targetTask.getTaskMode())
					actual.mode = mode
					if (mode !== parsed.mode) {
						errors.push(`mode: expected ${parsed.mode}, got ${mode}`)
					}
				}

				if ("childTaskCount" in parsed) {
					const count = targetTask.childTasks?.length ?? 0
					actual.childTaskCount = count
					if (count !== parsed.childTaskCount) {
						errors.push(`childTaskCount: expected ${parsed.childTaskCount}, got ${count}`)
					}
				}

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									verified: errors.length === 0,
									errors: errors.length > 0 ? errors : undefined,
									actual,
								},
								null,
								2,
							),
						},
					],
				}
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
}

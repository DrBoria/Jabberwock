import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { MessageInterceptor } from "../interceptor.js"

/**
 * Register event bus tools on the MCP server.
 * These tools provide message interception, tracing, and sending for integration testing.
 *
 * The interceptor instance is shared with ClineProvider via the same MessageInterceptor
 * reference — hooks in postMessageToWebview() and setWebviewMessageListener() check
 * the same interceptor map that these tools modify.
 */
export function registerEventBusTools(mcpServer: McpServer, interceptor: MessageInterceptor) {
	// ── Send message to webview ──────────────────────────────────────────

	mcpServer.tool(
		"send_message_to_webview",
		{
			type: z.string().describe("Message type (e.g. 'action', 'command')"),
			action: z.string().describe("Action/command name (e.g. 'chatButtonClicked')"),
			payload: z.any().optional().describe("Optional payload to include in the message"),
		},
		async ({ type, action, payload }) => {
			try {
				const message = { type, action, ...(payload ? { payload } : {}) }
				const result = interceptor.sendMessage(message)
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								sent: true,
								intercepted: result.intercepted,
								message,
							}),
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

	// ── Set interceptor ──────────────────────────────────────────────────

	mcpServer.tool(
		"set_message_interceptor",
		{
			direction: z
				.enum(["backend→webview", "webview→backend"])
				.describe("Direction: 'backend→webview' (send) or 'webview→backend' (receive)"),
			type: z.string().describe("Message type to match (e.g. 'action', 'command')"),
			action: z.string().optional().describe("Optional action/command name to match (e.g. 'chatButtonClicked')"),
			response: z.any().describe("Mock response to return when intercepted"),
		},
		async ({ direction, type, action, response }) => {
			try {
				interceptor.set({ direction, type, action, response })
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								success: true,
								interceptor: { direction, type, action: action || "*" },
							}),
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

	// ── Remove interceptor ───────────────────────────────────────────────

	mcpServer.tool(
		"remove_message_interceptor",
		{
			direction: z
				.enum(["backend→webview", "webview→backend"])
				.describe("Direction of the interceptor to remove"),
			type: z.string().describe("Message type of the interceptor to remove"),
			action: z.string().optional().describe("Optional action name of the interceptor to remove"),
		},
		async ({ direction, type, action }) => {
			try {
				const removed = interceptor.removeMany(direction, type, action)
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({ success: true, removed }),
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

	// ── Get active interceptors ──────────────────────────────────────────

	mcpServer.tool("get_active_interceptors", {}, async () => {
		try {
			const interceptors = interceptor.getAll()
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(interceptors, null, 2),
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

	// ── Get message trace ────────────────────────────────────────────────

	mcpServer.tool(
		"get_message_trace",
		{
			direction: z.enum(["backend→webview", "webview→backend"]).optional().describe("Filter by direction"),
			type: z.string().optional().describe("Filter by message type"),
			action: z.string().optional().describe("Filter by action/command name"),
		},
		async ({ direction, type, action }) => {
			try {
				const hasFilter = direction !== undefined || type !== undefined || action !== undefined
				const limit = hasFilter ? 5 : 3
				const { entries, totalCount } = interceptor.getTrace({ direction, type, action }, limit)
				const result: Record<string, unknown> = {
					entries,
					count: entries.length,
				}
				if (hasFilter) {
					result.totalMatched = totalCount
				}
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(result, null, 2),
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

	// ── Clear message trace ──────────────────────────────────────────────

	mcpServer.tool("clear_message_trace", {}, async () => {
		try {
			interceptor.clearTrace()
			return {
				content: [{ type: "text", text: JSON.stringify({ success: true }) }],
			}
		} catch (error) {
			return {
				content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true,
			}
		}
	})
}

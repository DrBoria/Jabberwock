import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { ExtensionBridge } from "../bridge.js"

/**
 * Register state inspection tools on the MCP server.
 * These tools provide access to MST stores, extension info, and current state.
 */
export function registerStateTools(mcpServer: McpServer, bridge: ExtensionBridge) {
	// ── get_store_state ────────────────────────────────────────────
	mcpServer.tool(
		"get_store_state",
		{
			env: z
				.enum(["backend", "frontend"])
				.optional()
				.describe("Which environment to query. Omit for top-level helper listing available environments."),
			store: z
				.string()
				.optional()
				.describe(
					"Store name or dot-separated path (e.g. 'chat', 'chat.isRunning'). Requires `env` to be set.",
				),
			limit: z.number().min(1).max(10).default(10).describe("Items per page"),
			cursor: z.number().min(0).default(0).describe("Pagination cursor"),
		},
		async (params) => {
			try {
				const result = await bridge.getStoreState({
					env: params.env,
					store: params.store,
					limit: params.limit,
					cursor: params.cursor,
				})
				return { content: [{ type: "text", text: result }] }
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

	// ── get_store_actions ──────────────────────────────────────────
	mcpServer.tool(
		"get_store_actions",
		{
			env: z.enum(["backend", "frontend"]).describe("Which environment to query"),
			limit: z.number().min(1).max(10).default(10).describe("Items per page"),
			cursor: z.number().min(0).default(0).describe("Pagination cursor"),
		},
		async (params) => {
			try {
				const result = await bridge.getStoreActions({
					env: params.env,
					limit: params.limit,
					cursor: params.cursor,
				})
				return { content: [{ type: "text", text: result }] }
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

	// ── search_state (replaces filter_state) ───────────────────────
	mcpServer.tool(
		"search_state",
		{
			env: z.enum(["backend", "frontend"]).describe("Which environment to query"),
			query: z
				.string()
				.describe(
					"Search by content, ID, or partial text match (e.g. a message fragment, taskId, property value)",
				),
			limit: z.number().min(1).max(20).default(10).describe("Maximum results"),
			cursor: z.number().min(0).default(0).describe("Pagination cursor"),
		},
		async (params) => {
			try {
				const result = await bridge.searchState({
					env: params.env,
					query: params.query,
					limit: params.limit,
					cursor: params.cursor,
				})
				return { content: [{ type: "text", text: result }] }
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

	// ── filter_actions ─────────────────────────────────────────────
	mcpServer.tool(
		"filter_actions",
		{
			env: z.enum(["backend", "frontend"]).describe("Which environment to query"),
			pattern: z.string().describe("Action name pattern to filter by (e.g. 'set', 'toggle')"),
			limit: z.number().min(1).max(10).default(10).describe("Items per page"),
			cursor: z.number().min(0).default(0).describe("Pagination cursor"),
		},
		async (params) => {
			try {
				const result = await bridge.filterActions({
					env: params.env,
					pattern: params.pattern,
					limit: params.limit,
					cursor: params.cursor,
				})
				return { content: [{ type: "text", text: result }] }
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

	// ── search_actions ─────────────────────────────────────────────
	mcpServer.tool(
		"search_actions",
		{
			env: z.enum(["backend", "frontend"]).describe("Which environment to query"),
			query: z.string().describe("Search query for action names"),
			limit: z.number().min(1).max(10).default(10).describe("Items per page"),
			cursor: z.number().min(0).default(0).describe("Pagination cursor"),
		},
		async (params) => {
			try {
				const result = await bridge.searchActions({
					env: params.env,
					query: params.query,
					limit: params.limit,
					cursor: params.cursor,
				})
				return { content: [{ type: "text", text: result }] }
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

	// ── count_actions ──────────────────────────────────────────────
	mcpServer.tool(
		"count_actions",
		{
			env: z.enum(["backend", "frontend"]).describe("Which environment to query"),
		},
		async (params) => {
			try {
				const result = await bridge.countActions({ env: params.env })
				return { content: [{ type: "text", text: result }] }
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

	// ── apply_previous_state (undo) ────────────────────────────────
	mcpServer.tool(
		"apply_previous_state",
		{
			env: z.enum(["backend", "frontend"]).describe("Which environment to query"),
		},
		async (params) => {
			try {
				const result = await bridge.applyPreviousState({ env: params.env })
				return { content: [{ type: "text", text: result }] }
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

	// ── apply_next_state (redo) ────────────────────────────────────
	mcpServer.tool(
		"apply_next_state",
		{
			env: z.enum(["backend", "frontend"]).describe("Which environment to query"),
		},
		async (params) => {
			try {
				const result = await bridge.applyNextState({ env: params.env })
				return { content: [{ type: "text", text: result }] }
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

	// ── get_store_actions_log ─────────────────────────────────────
	mcpServer.tool(
		"get_store_actions_log",
		{
			env: z.enum(["backend", "frontend"]).describe("Which environment to query"),
			before: z.number().optional().describe("Number of entries before cursor"),
			after: z.number().optional().describe("Number of entries after cursor"),
		},
		async (params) => {
			try {
				const result = await bridge.getStoreActionsLog({
					env: params.env,
					before: params.before,
					after: params.after,
				})
				return { content: [{ type: "text", text: result }] }
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

	// ── Keep legacy tools for backward compatibility ───────────────
	mcpServer.tool("get_extension_info", {}, async () => {
		try {
			const result = await bridge.getExtensionInfo()
			return { content: [{ type: "text", text: result }] }
		} catch (error) {
			return {
				content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true,
			}
		}
	})

	mcpServer.tool("get_current_state", {}, async () => {
		try {
			const result = await bridge.getCurrentState()
			return { content: [{ type: "text", text: result }] }
		} catch (error) {
			return {
				content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true,
			}
		}
	})
}

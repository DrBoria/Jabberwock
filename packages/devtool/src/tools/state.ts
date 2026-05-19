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
			store: z.enum(["backend", "frontend"]).describe("Which store to query"),
			path: z.string().optional().describe("Dot-separated path for nested state (e.g. 'chat.ui')"),
			limit: z.number().min(1).max(100).default(10).describe("Items per page"),
			cursor: z.number().min(0).default(0).describe("Pagination cursor"),
		},
		async (params) => {
			try {
				const result = await bridge.getStoreState({
					store: params.store,
					path: params.path,
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

	// ── get_mst_state ─────────────────────────────────────────────
	mcpServer.tool(
		"get_mst_state",
		{
			store: z.string().optional().describe("Store name (e.g. 'chatStore', 'diagnosticsStoreMst')"),
			mode: z
				.enum(["graph", "query"])
				.optional()
				.default("graph")
				.describe("Query mode: 'graph' for structure, 'query' for value"),
			depth: z.number().optional().describe("Traversal depth for graph mode"),
			path: z.string().optional().describe("Dot-separated path for query mode (e.g. 'activeNodeId.id')"),
			nodeId: z.string().optional().describe("Node ID to look up in query mode"),
			fields: z.string().optional().describe("Comma-separated field names to retrieve"),
		},
		async (params) => {
			try {
				const result = await bridge.getMstState({
					store: params.store,
					mode: params.mode,
					depth: params.depth,
					path: params.path,
					nodeId: params.nodeId,
					fields: params.fields,
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
			store: z.enum(["backend", "frontend"]).describe("Which store to query"),
			limit: z.number().min(1).max(100).default(10).describe("Items per page"),
			cursor: z.number().min(0).default(0).describe("Pagination cursor"),
		},
		async (params) => {
			try {
				const result = await bridge.getStoreActions({
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

	// ── filter_state ───────────────────────────────────────────────
	mcpServer.tool(
		"filter_state",
		{
			store: z.enum(["backend", "frontend"]).describe("Which store to query"),
			path: z.string().describe("Dot-separated path filter, e.g. 'chat.ui' or 'settings'"),
			limit: z.number().min(1).max(100).default(10).describe("Items per page"),
			cursor: z.number().min(0).default(0).describe("Pagination cursor"),
		},
		async (params) => {
			try {
				const result = await bridge.filterState({
					store: params.store,
					path: params.path,
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
			store: z.enum(["backend", "frontend"]).describe("Which store to query"),
			pattern: z.string().describe("Action name pattern to filter by (e.g. 'set', 'toggle')"),
			limit: z.number().min(1).max(100).default(10).describe("Items per page"),
			cursor: z.number().min(0).default(0).describe("Pagination cursor"),
		},
		async (params) => {
			try {
				const result = await bridge.filterActions({
					store: params.store,
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
			store: z.enum(["backend", "frontend"]).describe("Which store to query"),
			query: z.string().describe("Search query for action names"),
			limit: z.number().min(1).max(100).default(10).describe("Items per page"),
			cursor: z.number().min(0).default(0).describe("Pagination cursor"),
		},
		async (params) => {
			try {
				const result = await bridge.searchActions({
					store: params.store,
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
			store: z.enum(["backend", "frontend"]).describe("Which store to query"),
		},
		async (params) => {
			try {
				const result = await bridge.countActions({ store: params.store })
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
			store: z.enum(["backend", "frontend"]).describe("Which store to query"),
		},
		async (params) => {
			try {
				const result = await bridge.applyPreviousState({ store: params.store })
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
			store: z.enum(["backend", "frontend"]).describe("Which store to query"),
		},
		async (params) => {
			try {
				const result = await bridge.applyNextState({ store: params.store })
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
			store: z.enum(["backend", "frontend"]).describe("Which store to query"),
			before: z.number().optional().describe("Number of entries before cursor"),
			after: z.number().optional().describe("Number of entries after cursor"),
		},
		async (params) => {
			try {
				const result = await bridge.getStoreActionsLog({
					store: params.store,
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

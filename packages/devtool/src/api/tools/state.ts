import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { ExtensionBridge } from "../bridge.js"
import { wrapBridge } from "./tool-utils.js"

export function registerStateTools(mcpServer: McpServer, bridge: ExtensionBridge) {
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
			path: z
				.string()
				.optional()
				.describe(
					"Path within the store to query (e.g. 'tasks[0]' to access first task). Overrides `store` when specified.",
				),
			limit: z.number().min(1).max(10).default(10).describe("Items per page"),
			cursor: z.number().min(0).default(0).describe("Pagination cursor"),
			fields: z
				.string()
				.optional()
				.describe("Comma-separated field names to extract from array elements (e.g. 'id,tokensOut')"),
		},
		async (params) =>
			wrapBridge(() =>
				bridge.getStoreState({
					env: params.env,
					store: params.store,
					path: params.path,
					limit: params.limit,
					cursor: params.cursor,
					fields: params.fields,
				}),
			),
	)

	mcpServer.tool(
		"get_store_actions",
		{
			env: z.enum(["backend", "frontend"]).describe("Which environment to query"),
			limit: z.number().min(1).max(10).default(10).describe("Items per page"),
			cursor: z.number().min(0).default(0).describe("Pagination cursor"),
		},
		async (params) =>
			wrapBridge(() =>
				bridge.getStoreActions({
					env: params.env,
					limit: params.limit,
					cursor: params.cursor,
				}),
			),
	)

	mcpServer.tool(
		"search_state",
		{
			env: z.enum(["backend", "frontend"]).describe("Which environment to query"),
			query: z
				.string()
				.describe(
					"Search by content, ID, or partial text match (e.g. a message fragment, taskId, property value)",
				),
			store: z
				.string()
				.optional()
				.describe(
					"Optional specific store to search within (e.g. 'chat', 'chat.tasks'). If omitted, searches all stores.",
				),
			limit: z.number().min(1).max(10).default(10).describe("Maximum results"),
			cursor: z.number().min(0).default(0).describe("Pagination cursor"),
		},
		async (params) =>
			wrapBridge(() =>
				bridge.searchState({
					env: params.env,
					query: params.query,
					store: params.store,
					limit: params.limit,
					cursor: params.cursor,
				}),
			),
	)

	mcpServer.tool(
		"filter_actions",
		{
			env: z.enum(["backend", "frontend"]).describe("Which environment to query"),
			pattern: z.string().describe("Action name pattern to filter by (e.g. 'set', 'toggle')"),
			limit: z.number().min(1).max(10).default(10).describe("Items per page"),
			cursor: z.number().min(0).default(0).describe("Pagination cursor"),
		},
		async (params) =>
			wrapBridge(() =>
				bridge.filterActions({
					env: params.env,
					pattern: params.pattern,
					limit: params.limit,
					cursor: params.cursor,
				}),
			),
	)

	mcpServer.tool(
		"search_actions",
		{
			env: z.enum(["backend", "frontend"]).describe("Which environment to query"),
			query: z.string().describe("Search query for action names"),
			limit: z.number().min(1).max(10).default(10).describe("Items per page"),
			cursor: z.number().min(0).default(0).describe("Pagination cursor"),
		},
		async (params) =>
			wrapBridge(() =>
				bridge.searchActions({
					env: params.env,
					query: params.query,
					limit: params.limit,
					cursor: params.cursor,
				}),
			),
	)

	mcpServer.tool(
		"count_actions",
		{
			env: z.enum(["backend", "frontend"]).describe("Which environment to query"),
		},
		async (params) => wrapBridge(() => bridge.countActions({ env: params.env })),
	)

	mcpServer.tool(
		"apply_previous_state",
		{
			env: z.enum(["backend", "frontend"]).describe("Which environment to query"),
		},
		async (params) => wrapBridge(() => bridge.applyPreviousState({ env: params.env })),
	)

	mcpServer.tool(
		"apply_next_state",
		{
			env: z.enum(["backend", "frontend"]).describe("Which environment to query"),
		},
		async (params) => wrapBridge(() => bridge.applyNextState({ env: params.env })),
	)

	mcpServer.tool(
		"get_store_actions_log",
		{
			env: z.enum(["backend", "frontend"]).describe("Which environment to query"),
			before: z.number().optional().describe("Number of entries before cursor"),
			after: z.number().optional().describe("Number of entries after cursor"),
		},
		async (params) =>
			wrapBridge(() =>
				bridge.getStoreActionsLog({
					env: params.env,
					before: params.before,
					after: params.after,
				}),
			),
	)

	mcpServer.tool("get_extension_info", {}, async () => wrapBridge(() => bridge.getExtensionInfo()))

	mcpServer.tool("get_current_state", {}, async () => wrapBridge(() => bridge.getCurrentState()))
}

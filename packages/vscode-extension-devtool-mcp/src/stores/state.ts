import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { DevtoolMethods } from "../mcp/server.js"
import type { StoreEnv } from "../types.js"
import { wrapBridge } from "../mcp/server.js"

/**
 * Register the state MCP tools, gated on which store environments are
 * configured.
 *
 * - If no env has a store adapter, the env-based state tools are NOT
 *   registered at all — the agent never sees them.
 * - If only one env is configured, the `env` parameter is constrained to that
 *   single value.
 * - `get_extension_info` (the single full health check) is always registered.
 */
export function registerStateTools(
	mcpServer: McpServer,
	methods: DevtoolMethods,
	envs: StoreEnv[] = ["backend", "frontend"],
) {
	mcpServer.tool("get_extension_info", {}, async () => wrapBridge(() => methods.getExtensionInfo()))

	// No store configured for any env → the env-based state tools are invisible.
	if (envs.length === 0) {
		return
	}

	const envSchema = z.enum(envs as [StoreEnv, ...StoreEnv[]]).describe("Which environment to query")

	mcpServer.tool(
		"get_store_state",
		{
			env: envSchema
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
				methods.getStoreState({
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
			env: envSchema,
			limit: z.number().min(1).max(10).default(10).describe("Items per page"),
			cursor: z.number().min(0).default(0).describe("Pagination cursor"),
		},
		async (params) =>
			wrapBridge(() =>
				methods.getStoreActions({
					env: params.env,
					limit: params.limit,
					cursor: params.cursor,
				}),
			),
	)

	mcpServer.tool(
		"search_state",
		{
			env: envSchema,
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
				methods.searchState({
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
			env: envSchema,
			pattern: z.string().describe("Action name pattern to filter by (e.g. 'set', 'toggle')"),
			limit: z.number().min(1).max(10).default(10).describe("Items per page"),
			cursor: z.number().min(0).default(0).describe("Pagination cursor"),
		},
		async (params) =>
			wrapBridge(() =>
				methods.filterActions({
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
			env: envSchema,
			query: z.string().describe("Search query for action names"),
			limit: z.number().min(1).max(10).default(10).describe("Items per page"),
			cursor: z.number().min(0).default(0).describe("Pagination cursor"),
		},
		async (params) =>
			wrapBridge(() =>
				methods.searchActions({
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
			env: envSchema,
		},
		async (params) => wrapBridge(() => methods.countActions({ env: params.env })),
	)

	mcpServer.tool(
		"apply_previous_state",
		{
			env: envSchema,
		},
		async (params) => wrapBridge(() => methods.applyPreviousState({ env: params.env })),
	)

	mcpServer.tool(
		"apply_next_state",
		{
			env: envSchema,
		},
		async (params) => wrapBridge(() => methods.applyNextState({ env: params.env })),
	)

	mcpServer.tool(
		"get_store_actions_log",
		{
			env: envSchema,
			store: z.string().optional().describe("Optional store to scope the log to"),
			cursor: z.number().min(0).default(0).describe("Pagination cursor"),
			limit: z.number().min(1).max(10).default(10).describe("Items per page"),
		},
		async (params) =>
			wrapBridge(() =>
				methods.getStoreActionsLog({
					env: params.env,
					store: params.store,
					cursor: params.cursor,
					limit: params.limit,
				}),
			),
	)
}

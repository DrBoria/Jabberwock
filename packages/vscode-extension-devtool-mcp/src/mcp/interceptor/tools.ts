/**
 * Shared MCP tool registration for the message interceptor.
 *
 * The backend and frontend interceptors expose the same six operations
 * (send, set, remove, list, trace, clear trace) — only the tool names, the
 * direction vocabulary, the send transport, and the trace shape differ. This
 * selector registers all six against any {@link MessageInterceptor} subclass,
 * so both sides stay in sync without duplicating the schemas.
 */
import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { MessageInterceptor, TraceFilter } from "./index.js"

const ok = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data) }] })
const fail = (error: unknown) => ({
	content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
	isError: true,
})

const run = (fn: () => unknown) => {
	try {
		return ok(fn())
	} catch (error) {
		return fail(error)
	}
}

interface InterceptorMessage {
	type: string
	action: string
	payload?: unknown
}

interface SendResult {
	intercepted: boolean
	response?: unknown
}

interface TraceResult {
	entries: unknown[]
	totalCount: number
}

export interface InterceptorToolsOptions {
	/** Prefix for all tool names ("" for the backend, "frontend_" for the webview). */
	prefix?: string
	/** Tool-facing direction labels, mapped to the interceptor's "send"/"receive". */
	directions: { send: string; receive?: string }
	/** Send-transport tool name, description, and the transport itself. */
	sendTool: {
		name: string
		description: string
		send: (message: InterceptorMessage) => SendResult
	}
	/**
	 * Trace reader. The backend reads the raw trace (oldest-first tail); the
	 * frontend reads a newest-first page via `getTracePage`.
	 */
	trace:
		| { kind: "getTrace"; getTrace: (filter: TraceFilter, limit: number) => TraceResult }
		| { kind: "getTracePage"; getTracePage: (filter: TraceFilter, limit: number, cursor: number) => TraceResult }
}

export function registerInterceptorTools(
	mcpServer: McpServer,
	interceptor: MessageInterceptor,
	options: InterceptorToolsOptions,
): void {
	const { prefix = "", directions, sendTool, trace } = options
	const dirEnum = directions.receive ? z.enum([directions.send, directions.receive]) : z.literal(directions.send)
	const toDirection = (d: string) => (d === directions.send ? "send" : "receive")

	mcpServer.tool(
		`${prefix}${sendTool.name}`,
		sendTool.description,
		{
			type: z.string().describe("Message type (e.g. 'action', 'command')"),
			action: z.string().describe("Action/command name (e.g. 'chatButtonClicked')"),
			payload: z.any().optional().describe("Optional payload to include in the message"),
		},
		async ({ type, action, payload }) =>
			run(() => {
				const message = { type, action, ...(payload ? { payload } : {}) }
				const result = sendTool.send(message)

				return { sent: true, intercepted: result.intercepted, response: result.response, message }
			}),
	)

	mcpServer.tool(
		`${prefix}set_message_interceptor`,
		"Install an interceptor that matches (and can short-circuit) messages of a direction",
		{
			direction: dirEnum.describe(
				`Direction to intercept: ${directions.receive ? `'${directions.send}' or '${directions.receive}'` : `'${directions.send}'`}`,
			),
			type: z.string().describe("Message type to match (e.g. 'action', 'command')"),
			action: z.string().optional().describe("Optional action/command name to match"),
			response: z.any().describe("Mock response to return when intercepted"),
		},
		async ({ direction, type, action, response }) =>
			run(() => {
				interceptor.set({ direction: toDirection(direction), type, action, response })

				return { success: true, interceptor: { direction, type, action: action || "*" } }
			}),
	)

	mcpServer.tool(
		`${prefix}remove_message_interceptor`,
		"Remove interceptors matching a direction/type/action",
		{
			direction: dirEnum.describe("Direction of the interceptor to remove"),
			type: z.string().describe("Message type of the interceptor to remove"),
			action: z.string().optional().describe("Optional action name of the interceptor to remove"),
		},
		async ({ direction, type, action }) =>
			run(() => ({ success: true, removed: interceptor.removeMany(toDirection(direction), type, action) })),
	)

	mcpServer.tool(`${prefix}get_active_interceptors`, "List all currently installed interceptors", {}, async () =>
		run(() => interceptor.getActive()),
	)

	const traceSchema: Record<string, z.ZodTypeAny> = {
		type: z.string().optional().describe("Filter by message type"),
		action: z.string().optional().describe("Filter by action/command name"),
	}
	if (directions.receive) traceSchema.direction = dirEnum.optional().describe("Filter by direction")
	if (trace.kind === "getTracePage") {
		traceSchema.limit = z.number().optional().describe("Max entries to return (default 10)")
		traceSchema.cursor = z.number().optional().describe("Offset for pagination")
	}

	mcpServer.tool(
		`${prefix}get_message_trace`,
		"Read the message trace; optionally filter by direction/type/action",
		traceSchema,
		async (args) =>
			run(() => {
				const { type, action, direction, limit, cursor } = args as {
					type?: string
					action?: string
					direction?: string
					limit?: number
					cursor?: number
				}
				const filter: TraceFilter = {
					type,
					action,
					...(direction ? { direction: toDirection(direction) } : {}),
				}
				const result =
					trace.kind === "getTracePage"
						? trace.getTracePage(filter, limit ?? 10, cursor ?? 0)
						: trace.getTrace(filter, type || action || direction ? 5 : 3)

				return { entries: result.entries, count: result.entries.length, totalMatched: result.totalCount }
			}),
	)

	mcpServer.tool(`${prefix}clear_message_trace`, "Clear the message trace", {}, async () =>
		run(() => {
			interceptor.clearTrace()

			return { success: true }
		}),
	)
}

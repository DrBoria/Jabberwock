/**
 * AgentEntrypoint — the stdio MCP entry: mirrors the extension host's toolset
 * over `WebSocketClientTransport`, prefixing every proxied result with the
 * target label. Two tools are answered LOCALLY: `get_target_info` (host
 * identity) and `get_console` with `env: "debug"` (CDP renderer console).
 */

import { pathToFileURL } from "node:url"
import type { ZodRawShape } from "zod"
import { z } from "zod"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { WebSocketClientTransport } from "@modelcontextprotocol/sdk/client/websocket.js"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
	BREAKPOINT_GUARD_TIMEOUT_MS,
	CLIENT_REQUEST_TIMEOUT_MS,
	CLIENT_RECONNECT_DELAY_MS,
	ERR,
	WS_PORT,
	pollExtensionStatus,
	sleep,
} from "./errors.js"
import { getBuildTimestamp } from "./http.js"
import { getTargetInfo, probeTargetStatus, targetLabel } from "./target-identity.js"
import { getDebugConsole, startRendererConsoleListener } from "../console/index.js"

let client: Client | null = null

// Ensure a live connection to the extension host (polls status, opens the
// WebSocket when not connected). Throws ERR.DISCONNECTED / ERR.BREAKPOINT_ACTIVE.
async function ensureConnection(): Promise<Client> {
	if (client) return client

	const status = await pollExtensionStatus()
	if (status === "not_running") throw new Error(ERR.DISCONNECTED)
	if (status === "breakpoint") throw new Error(ERR.BREAKPOINT_ACTIVE)

	const c = new Client({ name: "vscode-extension-devtool-mcp", version: "1.0.0" })
	try {
		await c.connect(new WebSocketClientTransport(new URL(`ws://127.0.0.1:${WS_PORT}/ws`)))
		client = c
		void probeTargetStatus(1_000)
		return c
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		throw new Error(
			/econnrefused|connection refused|connect ECONN|websocket closed/i.test(msg)
				? ERR.DISCONNECTED
				: ERR.BREAKPOINT_ACTIVE,
		)
	}
}

/** JSON-Schema property → zod field (best-effort; the host validates anyway). */
const propToZod = (prop: Record<string, unknown>): z.ZodTypeAny => {
	const schema = prop.type === "number" ? z.number() : prop.type === "boolean" ? z.boolean() : z.string()
	const described = typeof prop.description === "string" ? schema.describe(prop.description) : schema
	return described.optional()
}

/** JSON-Schema inputSchema → zod shape for the mirrored tool. */
const schemaToShape = (inputSchema: Record<string, unknown> | undefined): ZodRawShape => {
	const props = (inputSchema?.properties ?? {}) as Record<string, Record<string, unknown>>

	return Object.fromEntries(Object.entries(props).map(([name, prop]) => [name, propToZod(prop)]))
}

/** Tools answered locally instead of being proxied to the host. */
const LOCAL_TOOLS = new Set(["get_target_info", "get_console"])

/** List the host's tools and re-register them on the local server. */
async function mirrorTools(server: McpServer): Promise<void> {
	const c = await ensureConnection()
	const { tools } = await c.listTools()
	for (const tool of tools) {
		if (LOCAL_TOOLS.has(tool.name)) continue
		server.tool(
			tool.name,
			tool.description ?? "",
			schemaToShape(tool.inputSchema as Record<string, unknown>),
			async (args) => {
				try {
					return { content: [{ type: "text" as const, text: await callLocalOrProxy(tool.name, args) }] }
				} catch (error) {
					return errorResult(error)
				}
			},
		)
	}
}

// The host may start after this entry, so retry until its toolset is up.
const mirrorUntilUp = async (server: McpServer): Promise<void> => {
	for (;;) {
		try {
			await mirrorTools(server)
			return
		} catch {
			await sleep(2_000)
		}
	}
}

/** Call a tool on the host and join its text content into one string. */
async function callToolOnHost(name: string, args: Record<string, unknown>): Promise<string> {
	const c = await ensureConnection()
	const result = (await c.callTool({ name, arguments: args }, undefined, {
		timeout: CLIENT_REQUEST_TIMEOUT_MS,
	})) as CallToolResult

	return (result.content ?? [])
		.filter((p) => p.type === "text")
		.map((p) => ("text" in p ? p.text : ""))
		.join("\n")
}

const isCanonical = (msg: string): boolean => msg.startsWith("BREAKPOINT_ACTIVE") || msg.startsWith("DISCONNECTED")

// Route a tool call: local tools are answered here, everything else is proxied
// to the host (guard timer around the connection phase). A non-canonical
// failure drops the connection and retries once.
async function callLocalOrProxy(name: string, args: Record<string, unknown>): Promise<string> {
	if (name === "get_target_info") return getTargetInfo()
	if (name === "get_console" && args.env === "debug") {
		return `${targetLabel()}\n${getDebugConsole({
			level: args.level as string | undefined,
			search: args.search as string | undefined,
			limit: args.limit as number | undefined,
			cursor: args.cursor as number | undefined,
		})}`
	}
	try {
		const guard = new Promise<never>((_, reject) =>
			setTimeout(() => reject(new Error(ERR.BREAKPOINT_ACTIVE)), BREAKPOINT_GUARD_TIMEOUT_MS),
		)
		await Promise.race([ensureConnection(), guard])
		const text = await callToolOnHost(name, args)

		return `${targetLabel()}\n${text}`
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error)
		if (isCanonical(msg)) throw error
		client = null
		await sleep(CLIENT_RECONNECT_DELAY_MS)
		const text = await callToolOnHost(name, args)

		return `${targetLabel()}\n${text}`
	}
}

const errorResult = (error: unknown) => ({
	content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
	isError: true,
})

/** Start the stdio MCP server: local tools + background mirror over stdio. */
export async function startStdioProxy(): Promise<void> {
	console.error(`[AgentEntrypoint] starting (build ${getBuildTimestamp()})`)
	startRendererConsoleListener()

	const server = new McpServer({ name: "vscode-extension-devtool-mcp", version: "1.0.0" })
	void mirrorUntilUp(server)

	server.tool(
		"get_target_info",
		"Identify which extension host this entry is connected to (workspace, pid, ports)",
		{} as ZodRawShape,
		async () => {
			try {
				return { content: [{ type: "text" as const, text: await callLocalOrProxy("get_target_info", {}) }] }
			} catch (error) {
				return errorResult(error)
			}
		},
	)

	server.tool(
		"get_console",
		'Read the renderer (webview/workbench) console captured over CDP (env: "debug")',
		{
			env: z.literal("debug").describe('Always "debug" for this CDP-captured console'),
			level: z.string().optional().describe("Filter by level (log, warn, error, info)"),
			search: z.string().optional().describe("Substring search in message text"),
			limit: z.number().optional().describe("Max entries to return (default 10)"),
			cursor: z.number().optional().describe("Offset for pagination"),
		},
		async (args) => {
			try {
				return { content: [{ type: "text" as const, text: await callLocalOrProxy("get_console", args) }] }
			} catch (error) {
				return errorResult(error)
			}
		},
	)

	await server.connect(new StdioServerTransport())
}

// Auto-start when this file is the entry point (e.g. `bun stdio.ts`).
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
	void startStdioProxy()
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"
import * as http from "http"
import { ClineProvider } from "../webview/ClineProvider"
import { registerUiTools } from "./tools/uiTools"
import { registerDiagnosticTools } from "./tools/diagnosticTools"
import { registerTaskTools } from "./tools/taskTools/index"
import { registerSettingsTools } from "./tools/settingsTools"
import { registerAgentTools } from "./tools/agentTools"
import { registerPromptTools } from "./tools/promptTools"
import { diagnosticsManager } from "./DiagnosticsManager"

// ── globalThis state ──────────────────────────────────────────────────────────
// Module-scoped variables are re-created on every extension hot-reload, but the
// old HTTP server (and its SSE transports) may still be alive and bound to the
// same port.  We store everything in globalThis so the reloaded module can find
// and tear down the previous incarnation before starting a new one.
interface McpGlobalState {
	serverInstance: http.Server | undefined
	sseTransports: Map<string, SSEServerTransport>
	activeProvider: ClineProvider | undefined
}

const GLOBAL_KEY = "__jabberwock_mcp_global_state"

function getOrCreateGlobalState(): McpGlobalState {
	if (!(globalThis as any)[GLOBAL_KEY]) {
		;(globalThis as any)[GLOBAL_KEY] = {
			serverInstance: undefined,
			sseTransports: new Map<string, SSEServerTransport>(),
			activeProvider: undefined,
		} satisfies McpGlobalState
	}
	return (globalThis as any)[GLOBAL_KEY] as McpGlobalState
}

const gs = getOrCreateGlobalState()

// ── provider proxy ────────────────────────────────────────────────────────────
/**
 * A proxy that always delegates to the currently active provider instance.
 * This ensures that if the sidebar is reloaded or a new instance is created,
 * the MCP tools (which are registered once) still talk to the correct instance.
 */
const providerProxy = new Proxy({} as any, {
	get: (target, prop) => {
		// Prioritize the visible instance (the one the user is looking at in the extension host)
		const active = ClineProvider.getVisibleInstance() || gs.activeProvider
		if (!active) {
			throw new Error("Jabberwock MCP Error: No active provider instance found.")
		}
		const val = (active as any)[prop]
		if (typeof val === "function") {
			return val.bind(active)
		}
		return val
	},
})

const STATIC_PORT = 60060

export async function startJabberwockMcpServer(provider: ClineProvider, port: number = STATIC_PORT): Promise<number> {
	diagnosticsManager.log(`[Jabberwock DevTools] startJabberwockMcpServer called for port ${port}`, "info")

	// If the server is already running (survived across hot-reload via globalThis),
	// just update the active provider and return the existing port.
	// DO NOT stop & restart — that would kill active SSE connections that the McpHub
	// relies on, causing "Connection closed" errors.
	if (gs.serverInstance) {
		diagnosticsManager.log(
			`[Jabberwock DevTools] Server already running. Updating active provider and returning existing port ${port}.`,
			"info",
		)
		gs.activeProvider = provider
		const address = gs.serverInstance.address()
		if (typeof address === "object" && address !== null) {
			return address.port
		}
		// If address is weird, fall through and restart
		diagnosticsManager.log(`[Jabberwock DevTools] Existing server has no valid address, will restart.`, "warn")
		await stopJabberwockMcpServer()
		await new Promise((resolve) => setTimeout(resolve, 100))
	}

	diagnosticsManager.log(`[Jabberwock DevTools] Initializing new MCP server instance...`, "info")
	const mcpServer = new McpServer({ name: "Jabberwock DevTools", version: "1.0.0" })

	const bridge: any = providerProxy

	mcpServer.tool("debug_get_provider_state", {}, async () => {
		if (!gs.activeProvider) return { content: [{ type: "text", text: "No active provider" }] }
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(
						{
							stackSize: (gs.activeProvider as any).clineStack.length,
							currentTaskId: gs.activeProvider.getCurrentTask()?.taskId,
							instanceId: (gs.activeProvider as any).instanceId || "N/A",
						},
						null,
						2,
					),
				},
			],
		}
	})

	diagnosticsManager.log(
		`[Jabberwock DevTools] Registering groups: ui, diagnostic, task, settings, agent, prompt...`,
		"info",
	)
	registerUiTools(mcpServer, bridge)
	registerDiagnosticTools(mcpServer, bridge)
	registerTaskTools(mcpServer, bridge)
	registerSettingsTools(mcpServer, bridge)
	registerAgentTools(mcpServer, bridge)
	registerPromptTools(mcpServer, bridge)

	diagnosticsManager.log(`[Jabberwock DevTools] Creating HTTP/SSE server instance...`, "info")
	return new Promise((resolve, reject) => {
		gs.serverInstance = http.createServer((req, res) => {
			const parsedUrl = new URL(req.url || "", `http://${req.headers.host || "localhost"}`)
			const pathname = parsedUrl.pathname

			if (pathname === "/sse") {
				diagnosticsManager.log(`[Jabberwock DevTools] Incoming SSE connection request`, "info")
				const transport = new SSEServerTransport("/messages", res)
				const sessionId = transport.sessionId
				gs.sseTransports.set(sessionId, transport)
				diagnosticsManager.log(
					`[Jabberwock DevTools] SSE client connected, sessionId=${sessionId}, total transports=${gs.sseTransports.size}`,
					"info",
				)

				mcpServer.connect(transport).catch((err) => {
					diagnosticsManager.log(`[Jabberwock DevTools] MCP connect error: ${err.message}`, "error")
					gs.sseTransports.delete(sessionId)
				})

				// When the SSE connection closes, clean up the transport
				res.on("close", () => {
					diagnosticsManager.log(
						`[Jabberwock DevTools] SSE client disconnected, sessionId=${sessionId}`,
						"info",
					)
					gs.sseTransports.delete(sessionId)
				})
			} else if (pathname === "/messages" && req.method === "POST") {
				const sessionId = parsedUrl.searchParams.get("sessionId")
				if (sessionId && gs.sseTransports.has(sessionId)) {
					const transport = gs.sseTransports.get(sessionId)!
					transport.handlePostMessage(req, res).catch((err) => {
						const isConnectionNotEstablished = err.message?.includes("SSE connection not established")
						diagnosticsManager.log(
							`[Jabberwock DevTools] SSE message handling error for sessionId=${sessionId}: ${err.message}`,
							isConnectionNotEstablished ? "warn" : "error",
						)
						if (isConnectionNotEstablished) {
							gs.sseTransports.delete(sessionId)
						}
					})
				} else if (gs.sseTransports.size > 0) {
					// Fallback: if no sessionId provided or not found, use the first available transport
					// This handles the case where the client doesn't include sessionId in POST
					const firstTransport = gs.sseTransports.values().next().value
					if (firstTransport) {
						diagnosticsManager.log(
							`[Jabberwock DevTools] POST /messages without valid sessionId=${sessionId}, routing to first available transport`,
							"warn",
						)
						firstTransport.handlePostMessage(req, res).catch((err) => {
							diagnosticsManager.log(
								`[Jabberwock DevTools] SSE message handling error (fallback): ${err.message}`,
								"error",
							)
						})
					} else {
						res.writeHead(503).end("SSE transport not initialized")
					}
				} else {
					diagnosticsManager.log(
						`[Jabberwock DevTools] Received POST /messages but no SSE transports available`,
						"warn",
					)
					res.writeHead(503).end("SSE transport not initialized")
				}
			} else {
				res.writeHead(404).end("Not found")
			}
		})

		gs.serverInstance.on("error", (err: NodeJS.ErrnoException) => {
			diagnosticsManager.log(`[Jabberwock DevTools] Server instance error: ${err.message}`, "error")

			// EADDRINUSE → try the next port
			if ((err as any).code === "EADDRINUSE") {
				diagnosticsManager.log(
					`[Jabberwock DevTools] Port ${port} is in use, trying port ${port + 1}...`,
					"warn",
				)
				gs.serverInstance = undefined
				resolve(startJabberwockMcpServer(provider, port + 1))
				return
			}

			gs.serverInstance = undefined
			reject(err)
		})

		diagnosticsManager.log(`[Jabberwock DevTools] Attempting to listen on 127.0.0.1:${port}...`, "info")
		gs.serverInstance.listen(port, "127.0.0.1", () => {
			const address = gs.serverInstance?.address()
			if (typeof address === "object" && address !== null) {
				diagnosticsManager.log(
					`[Jabberwock DevTools] MCP Server SUCCESS: listening on static port ${address.port}`,
					"info",
				)
				resolve(address.port)
			} else {
				diagnosticsManager.log(`[Jabberwock DevTools] Server started but address is null/invalid`, "error")
				reject(new Error("Failed to get port"))
			}
		})
	})
}

export async function stopJabberwockMcpServer(): Promise<void> {
	diagnosticsManager.log(`[Jabberwock DevTools] stopJabberwockMcpServer called`, "info")

	// Close all transports first so existing SSE clients get a clean disconnect
	const closePromises: Promise<void>[] = []
	for (const [sessionId, transport] of gs.sseTransports.entries()) {
		diagnosticsManager.log(`[Jabberwock DevTools] Closing SSE transport sessionId=${sessionId}`, "info")
		closePromises.push(
			transport.close().catch((err) => {
				diagnosticsManager.log(
					`[Jabberwock DevTools] Error closing transport ${sessionId}: ${err.message}`,
					"error",
				)
			}),
		)
	}
	await Promise.allSettled(closePromises)
	gs.sseTransports.clear()

	// Close the HTTP server and wait for the callback so the port is actually released
	if (gs.serverInstance) {
		await new Promise<void>((resolve) => {
			gs.serverInstance!.close(() => {
				diagnosticsManager.log(`[Jabberwock DevTools] HTTP server closed`, "info")
				gs.serverInstance = undefined
				resolve()
			})
		})
	}

	diagnosticsManager.log(`[Jabberwock DevTools] stopJabberwockMcpServer completed`, "info")
}

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
import { registerProviderTools } from "./tools/providerTools"
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
			`[Jabberwock DevTools] Server already running (hot-reload). Clearing stale SSE transports...`,
			"info",
		)
		// Clear all existing SSE transports — they belong to the old extension instance.
		// The new InternalMcpClientTransport will create a fresh SSE connection with a new
		// sessionId. Without this cleanup, stale transports with old sessionIds accumulate
		// and the POST /messages fallback iterates them unnecessarily.
		for (const [sid, transport] of gs.sseTransports.entries()) {
			try {
				transport.close()
			} catch {
				// Ignore close errors for already-dead transports
			}
		}
		gs.sseTransports.clear()
		diagnosticsManager.log(
			`[Jabberwock DevTools] Cleared ${gs.sseTransports.size} stale transports. Updating active provider.`,
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

	mcpServer.tool("_ping", {}, async () => {
		// Check real provider health — not just HTTP server liveness
		const provider = ClineProvider.getVisibleInstance() || gs.activeProvider
		const providerAlive = !!provider
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify({ ok: providerAlive, providerAlive, timestamp: Date.now() }),
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
	registerProviderTools(mcpServer, bridge)

	diagnosticsManager.log(`[Jabberwock DevTools] Creating HTTP/SSE server instance...`, "info")
	return new Promise((resolve, reject) => {
		gs.serverInstance = http.createServer((req, res) => {
			const parsedUrl = new URL(req.url || "", `http://${req.headers.host || "localhost"}`)
			const pathname = parsedUrl.pathname

			// Healthcheck endpoint: used by InternalMcpClientTransport to detect stale connections
			if (pathname === "/health" && req.method === "GET") {
				// Check real provider health — not just HTTP server liveness
				const provider = ClineProvider.getVisibleInstance() || gs.activeProvider
				const providerAlive = !!provider
				res.writeHead(providerAlive ? 200 : 503, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ ok: providerAlive, providerAlive, timestamp: Date.now() }))
				return
			}

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

				// Heartbeat: detect stale connections and clean them up.
				// When McpHub calls restartConnection, the old SSE transport is closed
				// but the client may still send POST /messages with the old sessionId.
				// The heartbeat lets us detect dead connections proactively.
				const heartbeatInterval = setInterval(() => {
					try {
						res.write(": heartbeat\n\n")
					} catch {
						clearInterval(heartbeatInterval)
						gs.sseTransports.delete(sessionId)
					}
				}, 15000)

				// When the SSE connection closes, clean up the transport and heartbeat
				res.on("close", () => {
					clearInterval(heartbeatInterval)
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
					// Fallback: if no sessionId provided or not found, try ALL available transports.
					// When McpHub calls restartConnection, the old SSE transport is closed and a new
					// one is opened with a different sessionId. The client may still send POST /messages
					// with the old sessionId. Iterating all transports ensures we find the active one.
					// Use IIFE because http.createServer callback cannot be async.
					;(async () => {
						let handled = false
						for (const [sid, transport] of gs.sseTransports.entries()) {
							try {
								await transport.handlePostMessage(req, res)
								handled = true
								diagnosticsManager.log(
									`[Jabberwock DevTools] POST /messages fallback: routed to sessionId=${sid}`,
									"info",
								)
								break
							} catch (err: any) {
								diagnosticsManager.log(
									`[Jabberwock DevTools] POST /messages fallback: transport sessionId=${sid} failed: ${err.message}`,
									"warn",
								)
								// Remove stale transport so we don't keep trying it
								gs.sseTransports.delete(sid)
							}
						}
						if (!handled) {
							diagnosticsManager.log(
								`[Jabberwock DevTools] POST /messages fallback: no working transport found`,
								"warn",
							)
							res.writeHead(404, { "Content-Type": "application/json" })
							res.end(
								JSON.stringify({
									error: "Session not found",
									message:
										"No SSE transport matched the sessionId. The client may need to re-establish the SSE connection.",
								}),
							)
						}
					})()
				} else {
					diagnosticsManager.log(
						`[Jabberwock DevTools] Received POST /messages but no SSE transports available`,
						"warn",
					)
					res.writeHead(404, { "Content-Type": "application/json" })
					res.end(
						JSON.stringify({
							error: "No transports",
							message: "SSE transport not initialized",
						}),
					)
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

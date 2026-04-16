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

let serverInstance: http.Server | undefined
let sseTransport: SSEServerTransport | undefined
let activeProvider: ClineProvider | undefined

/**
 * A proxy that always delegates to the currently active provider instance.
 * This ensures that if the sidebar is reloaded or a new instance is created,
 * the MCP tools (which are registered once) still talk to the correct instance.
 */
const providerProxy = new Proxy({} as any, {
	get: (target, prop) => {
		// Prioritize the visible instance (the one the user is looking at in the extension host)
		const active = ClineProvider.getVisibleInstance() || activeProvider
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
	activeProvider = provider

	if (serverInstance) {
		const address = serverInstance.address()
		if (typeof address === "object" && address !== null) {
			diagnosticsManager.log(
				`[Jabberwock DevTools] MCP Server already running on port ${address.port}. Updating provider.`,
				"info",
			)
			return address.port
		}
	}

	diagnosticsManager.log(`[Jabberwock DevTools] Initializing new MCP server instance...`, "info")
	const mcpServer = new McpServer({ name: "Jabberwock DevTools", version: "1.0.0" })

	const bridge: any = providerProxy

	mcpServer.tool("debug_get_provider_state", {}, async () => {
		if (!activeProvider) return { content: [{ type: "text", text: "No active provider" }] }
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(
						{
							stackSize: (activeProvider as any).clineStack.length,
							currentTaskId: activeProvider.getCurrentTask()?.taskId,
							instanceId: (activeProvider as any).instanceId || "N/A",
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
		serverInstance = http.createServer((req, res) => {
			const parsedUrl = new URL(req.url || "", `http://${req.headers.host || "localhost"}`)
			const pathname = parsedUrl.pathname

			if (pathname === "/sse") {
				diagnosticsManager.log(`[Jabberwock DevTools] Incoming SSE connection request`, "info")
				sseTransport = new SSEServerTransport("/messages", res)
				mcpServer.connect(sseTransport).catch((err) => {
					diagnosticsManager.log(`[Jabberwock DevTools] MCP connect error: ${err.message}`, "error")
				})
			} else if (pathname === "/messages" && req.method === "POST") {
				if (sseTransport) {
					sseTransport.handlePostMessage(req, res).catch((err) => {
						diagnosticsManager.log(
							`[Jabberwock DevTools] SSE message handling error: ${err.message}`,
							"error",
						)
					})
				} else {
					diagnosticsManager.log(
						`[Jabberwock DevTools] Received POST /messages but SSE transport not ready`,
						"warn",
					)
					res.writeHead(503).end("SSE transport not initialized")
				}
			} else {
				res.writeHead(404).end("Not found")
			}
		})

		serverInstance.on("error", (err) => {
			diagnosticsManager.log(`[Jabberwock DevTools] Server instance error: ${err.message}`, "error")
			serverInstance = undefined
			reject(err)
		})

		diagnosticsManager.log(`[Jabberwock DevTools] Attempting to listen on 127.0.0.1:${port}...`, "info")
		serverInstance.listen(port, "127.0.0.1", () => {
			const address = serverInstance?.address()
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

export function stopJabberwockMcpServer() {
	if (sseTransport) {
		sseTransport.close().catch(console.error)
		sseTransport = undefined
	}
	if (serverInstance) {
		serverInstance.close()
		serverInstance = undefined
	}
}

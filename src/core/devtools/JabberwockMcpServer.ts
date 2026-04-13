import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"
import * as http from "http"
import { type ClineProvider } from "../webview/ClineProvider"
import { registerUiTools } from "./tools/uiTools"
import { registerDiagnosticTools } from "./tools/diagnosticTools"
import { registerTaskTools } from "./tools/taskTools/index"
import { registerSettingsTools } from "./tools/settingsTools"

let serverInstance: http.Server | undefined
let sseTransport: SSEServerTransport | undefined

const STATIC_PORT = 60060

export async function startJabberwockMcpServer(provider: ClineProvider): Promise<number> {
	if (serverInstance) {
		const address = serverInstance.address()
		if (typeof address === "object" && address !== null) {
			return address.port
		}
	}

	const mcpServer = new McpServer({ name: "Jabberwock DevTools", version: "1.0.0" })

	registerUiTools(mcpServer, provider)
	registerDiagnosticTools(mcpServer, provider)
	registerTaskTools(mcpServer, provider)
	registerSettingsTools(mcpServer, provider)

	return new Promise((resolve, reject) => {
		serverInstance = http.createServer((req, res) => {
			const parsedUrl = new URL(req.url || "", `http://${req.headers.host || "localhost"}`)
			const pathname = parsedUrl.pathname

			if (pathname === "/sse") {
				sseTransport = new SSEServerTransport("/messages", res)
				mcpServer.connect(sseTransport).catch(console.error)
			} else if (pathname === "/messages" && req.method === "POST") {
				if (sseTransport) {
					sseTransport.handlePostMessage(req, res).catch(console.error)
				} else {
					res.writeHead(503).end("SSE transport not initialized")
				}
			} else {
				res.writeHead(404).end("Not found")
			}
		})

		serverInstance.on("error", (err) => {
			serverInstance = undefined
			reject(err)
		})

		serverInstance.listen(STATIC_PORT, "127.0.0.1", () => {
			const address = serverInstance?.address()
			if (typeof address === "object" && address !== null) {
				console.log(`[Jabberwock DevTools] MCP Server listening on static port ${address.port}`)
				resolve(address.port)
			} else {
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

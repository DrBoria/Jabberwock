#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { DevtoolClient } from "../../client.js"
import { getBuildTimestamp } from "../http-server.js"
import { registerAllTools } from "./schemas.js"

const WS_PORT = 60060
const HTTP_STATUS_PORT = 60061
const RECONNECT_INTERVAL_MS = 2000
const MAX_RECONNECT_ATTEMPTS = 30

let client: DevtoolClient
let connected = false

async function waitForExtension(maxAttempts: number = MAX_RECONNECT_ATTEMPTS): Promise<boolean> {
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			const response = await fetch(`http://127.0.0.1:${HTTP_STATUS_PORT}/status`)
			if (response.ok) {
				const data = await response.json()
				console.error(
					`[devtools] Extension available (build: ${data.buildTimestamp}, uptime: ${Math.floor(data.uptime)}s)`,
				)
				return true
			}
		} catch {
			// Extension not ready yet
		}
		if (attempt < maxAttempts) {
			await new Promise((r) => setTimeout(r, RECONNECT_INTERVAL_MS))
		}
	}
	return false
}

async function ensureConnection(): Promise<void> {
	if (connected && client) return

	const available = await waitForExtension()
	if (!available) {
		throw new Error("Extension not available after maximum wait time")
	}

	if (!client) {
		client = new DevtoolClient({ port: WS_PORT })
	}

	try {
		await client.connect()
		connected = true
		console.error("[devtools] Connected to extension WebSocket MCP server")
	} catch (err) {
		connected = false
		console.error("[devtools] Failed to connect:", err)
		throw err
	}
}

export async function proxyToolCall(name: string, args: Record<string, unknown> = {}): Promise<string> {
	await ensureConnection()
	try {
		const result = await client.callTool(name, args)
		if (typeof result === "string") {
			return result
		}
		return JSON.stringify(result)
	} catch (error) {
		console.error(`[devtools] Tool call failed: ${name}`, error)
		connected = false
		await ensureConnection()
		const result = await client.callTool(name, args)
		if (typeof result === "string") {
			return result
		}
		return JSON.stringify(result)
	}
}

async function main() {
	const banner = `
╔══════════════════════════════════════╗
║  Jabberwock DevTools (Stdio)         ║
║  Build: ${getBuildTimestamp()}         ║
╚══════════════════════════════════════╝`
	console.error(banner)

	const server = new McpServer({
		name: "jabberwock-devtools",
		version: "1.0.0",
	})

	registerAllTools(server, proxyToolCall)

	const transport = new StdioServerTransport()
	console.error("[devtools] Starting stdio MCP server...")
	await server.connect(transport)
	console.error("[devtools] Stdio MCP server ready")
}

main().catch((err) => {
	console.error("[devtools] Fatal error:", err)
	process.exit(1)
})

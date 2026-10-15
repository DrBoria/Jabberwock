import { describe, it, expect, afterAll } from "vitest"
import { WebSocket, WebSocketServer } from "ws"
import { WsMcpServer, WebSocketServerTransport } from "./ws.js"
import { isEaddrinuse, backoff } from "./errors.js"

const FREE_PORT = 61990

const servers: WsMcpServer[] = []
const rawServers: WebSocketServer[] = []
const closeAll = async () => {
	for (const s of servers.splice(0)) await s.stop()
	for (const s of rawServers.splice(0)) await new Promise((r) => s.close(() => r(undefined)))
}
afterAll(closeAll)

const connect = (port: number) =>
	new Promise<WebSocket>((resolve, reject) => {
		const ws = new WebSocket(`ws://127.0.0.1:${port}`)
		ws.once("open", () => resolve(ws))
		ws.once("error", reject)
	})

const nextMessage = (ws: WebSocket) =>
	new Promise<unknown>((resolve) => ws.once("message", (data) => resolve(JSON.parse(data.toString()))))

describe("WsMcpServer", () => {
	it("serves MCP over WebSocket: initialize + tools/list round-trip", async () => {
		const server = new WsMcpServer(FREE_PORT)
		const mcpServer = server.createServer()
		mcpServer.tool("ping_tool", "replies pong", {}, async () => ({ content: [{ type: "text", text: "pong" }] }))
		await server.start()
		servers.push(server)

		const ws = await connect(FREE_PORT)
		ws.send(
			JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "initialize",
				params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "1" } },
			}),
		)
		const init = await nextMessage(ws)
		expect((init as { result?: { serverInfo?: { name: string } } }).result?.serverInfo?.name).toBe(
			"vscode-extension-devtool-mcp",
		)
		ws.send(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }))
		ws.send(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }))
		const tools = await nextMessage(ws)
		expect(JSON.stringify(tools)).toContain("ping_tool")
		ws.close()
		await server.stop()
	})

	it("fails with EADDRINUSE after exhausting retries", async () => {
		const first = new WsMcpServer(FREE_PORT)
		await first.start()
		servers.push(first)

		const second = new WsMcpServer(FREE_PORT)
		await expect(second.start(1)).rejects.toThrow(/EADDRINUSE|address already in use/i)
	})

	it("stop() releases the port for a new server", async () => {
		const holder = servers.pop()
		if (holder) await holder.stop()

		const second = new WsMcpServer(FREE_PORT)
		servers.push(second)
		await expect(second.start(0)).resolves.toBe(FREE_PORT)
	})
})

describe("WebSocketServerTransport", () => {
	it("delivers parsed JSON messages and reports malformed input as an error", async () => {
		const received: unknown[] = []
		const errors: unknown[] = []
		const wss = new WebSocketServer({ port: FREE_PORT + 1, host: "127.0.0.1" })
		rawServers.push(wss)
		wss.on("connection", (ws) => {
			const transport = new WebSocketServerTransport(ws)
			transport.onmessage = (m) => received.push(m)
			transport.onerror = (e) => errors.push(e)
		})

		const ws = await connect(FREE_PORT + 1)
		ws.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }))
		ws.send("not json")
		await new Promise((r) => setTimeout(r, 100))

		expect(received).toEqual([{ jsonrpc: "2.0", id: 1, method: "ping" }])
		expect(errors).toHaveLength(1)

		ws.close()
	})
})

describe("errors helpers", () => {
	it("isEaddrinuse detects EADDRINUSE errors only", () => {
		const eaddr = new Error("listen EADDRINUSE: address already in use 127.0.0.1:60060")
		;(eaddr as NodeJS.ErrnoException).code = "EADDRINUSE"
		expect(isEaddrinuse(eaddr)).toBe(true)
		expect(isEaddrinuse(new Error("something else"))).toBe(false)
		expect(isEaddrinuse("not an error")).toBe(false)
	})

	it("backoff is a fixed short delay", () => {
		expect(backoff(0)).toBe(50)
		expect(backoff(3)).toBe(50)
	})
})

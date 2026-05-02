import { describe, it, expect, vi, beforeAll, afterAll } from "vitest"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import WebSocket from "ws"
import { WsMcpServer } from "@jabberwock/devtool"
import { diagnosticsManager } from "../core/devtools/DiagnosticsManager"
import { setTimeout } from "timers/promises"

/**
 * Minimal MCP Transport adapter for WebSocket clients.
 * Connects to a ws:// endpoint and wraps the WebSocket into the Transport interface.
 */
class WebSocketClientTransport implements Transport {
	private ws!: WebSocket
	onclose?: () => void
	onerror?: (error: Error) => void
	onmessage?: (message: any) => void

	constructor(private url: string) {}

	async start(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.ws = new WebSocket(this.url)
			this.ws.on("open", () => resolve())
			this.ws.on("error", (err) => reject(err))
			this.ws.on("message", (data) => {
				try {
					const message = JSON.parse(data.toString())
					this.onmessage?.(message)
				} catch (err) {
					this.onerror?.(err as Error)
				}
			})
			this.ws.on("close", () => this.onclose?.())
		})
	}

	async send(message: any): Promise<void> {
		this.ws.send(JSON.stringify(message))
	}

	async close(): Promise<void> {
		this.ws.close()
	}
}

// 2. Mock vscode and other node dependencies
vi.mock("vscode", () => ({
	Uri: {
		joinPath: vi.fn((base, path) => ({ fsPath: `/tmp/mock-mcp-log-${path}` })),
	},
}))

const TEST_PORT_MCP = 60062

describe("Jabberwock MCP Protocol E2E", () => {
	let mcpServer: WsMcpServer
	let mcpClient: Client
	let transport: WebSocketClientTransport

	beforeAll(async () => {
		// Mock Provider
		const mockProvider = {
			contextProxy: {
				globalStorageUri: { fsPath: "/tmp/jabberwock-test-logs" },
				getGlobalState: () => ({}),
			},
			getState: async () => ({}),
			getCurrentTask: () => null,
		} as any

		// Start actual WebSocket MCP Server on test port
		mcpServer = new WsMcpServer(TEST_PORT_MCP)
		await mcpServer.start()

		// Connect client via WebSocket
		transport = new WebSocketClientTransport(`ws://127.0.0.1:${TEST_PORT_MCP}/ws`)
		await transport.start()
		mcpClient = new Client({ name: "McpTestRunner", version: "1.0.0" }, { capabilities: { tools: {} } })
		await mcpClient.connect(transport)
	}, 15000)

	afterAll(async () => {
		await mcpClient.close()
		await mcpServer.stop()
	})

	it("should verify Phase 1: Execution Tracing over MCP protocol", async () => {
		diagnosticsManager.clear()
		diagnosticsManager.recordTaskStart("mcp-root", "primary", "Root Task")
		const tid = diagnosticsManager.recordToolStart("mcp-root", "ls", { path: "/test" })
		diagnosticsManager.recordToolEnd(tid, "success")

		const response = await mcpClient.callTool({ name: "get_execution_trace", arguments: {} })
		const traces = JSON.parse((response.content as any)[0].text)

		expect(traces.length).toBeGreaterThan(0)
		expect(traces[0].id).toBe("mcp-root")
		expect(traces[0].toolCalls).toContain(tid)
	})

	it("should verify Phase 2: Performance Metrics over MCP protocol", async () => {
		const tid = diagnosticsManager.recordToolStart("mcp-root", "timed-tool", {})
		await setTimeout(200) // Delay to ensure duration > 0
		diagnosticsManager.recordToolEnd(tid, "success")

		const response = await mcpClient.callTool({ name: "get_performance_metrics", arguments: {} })
		const metrics = JSON.parse((response.content as any)[0].text)

		// DiagnosticsManager prepends 'tool:' to the name
		const timedTool = metrics.find((m: any) => m.name === "tool:timed-tool")
		expect(timedTool).toBeDefined()
		expect(timedTool.durationMs).toBeGreaterThanOrEqual(150)
	})

	it("should verify Phase 3: Cycle Detection over MCP protocol", async () => {
		// Simulations repeated calls in diagnosticsManager
		const taskId = "cycle-task"
		diagnosticsManager.recordTaskStart(taskId, "primary", "Loop Check")

		// 3 identical calls
		for (let i = 0; i < 3; i++) {
			const tid = diagnosticsManager.recordToolStart(taskId, "repeat-me", { val: 1 })
			diagnosticsManager.recordToolEnd(tid, "success")
		}

		const response = await mcpClient.callTool({ name: "get_diagnostics_snapshot", arguments: {} })
		const text = (response.content as any)[0].text

		expect(text).toContain("Potential Cycle Detected")
		expect(text).toContain("repeat-me")
	})
})

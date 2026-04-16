import { describe, it, expect, vi, beforeAll, afterAll } from "vitest"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import { startJabberwockMcpServer, stopJabberwockMcpServer } from "../core/devtools/JabberwockMcpServer"
import { diagnosticsManager } from "../core/devtools/DiagnosticsManager"
import { setTimeout } from "timers/promises"

// 2. Mock vscode and other node dependencies
vi.mock("vscode", () => ({
	Uri: {
		joinPath: vi.fn((base, path) => ({ fsPath: `/tmp/mock-mcp-log-${path}` })),
	},
}))

const TEST_PORT_MCP = 60062

describe("Jabberwock MCP Protocol E2E", () => {
	let mcpClient: Client
	let transport: SSEClientTransport

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

		// Start actual MCP Server on test port
		await startJabberwockMcpServer(mockProvider, TEST_PORT_MCP)

		// Connect client
		transport = new SSEClientTransport(new URL(`http://127.0.0.1:${TEST_PORT_MCP}/sse`))
		mcpClient = new Client({ name: "McpTestRunner", version: "1.0.0" }, { capabilities: { tools: {} } })
		await mcpClient.connect(transport)
	}, 15000)

	afterAll(async () => {
		stopJabberwockMcpServer()
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

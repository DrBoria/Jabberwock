import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { createFrontendInterceptor } from "./index.js"
import { registerFrontendInterceptorTools } from "./tools.js"

const FRONTEND_TOOL_NAMES = [
	"frontend_clear_message_trace",
	"frontend_get_active_interceptors",
	"frontend_get_message_trace",
	"frontend_remove_message_interceptor",
	"frontend_send_message_to_backend",
	"frontend_set_message_interceptor",
].sort()

describe("registerFrontendInterceptorTools", () => {
	let client: Client
	let interceptor: ReturnType<typeof createFrontendInterceptor>
	let posted: unknown[]

	beforeAll(async () => {
		const mcpServer = new McpServer(
			{ name: "frontend-tools-test", version: "1.0.0" },
			{ capabilities: { tools: {} } },
		)
		posted = []
		interceptor = createFrontendInterceptor((message) => posted.push(message))
		registerFrontendInterceptorTools(mcpServer, interceptor)
		const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
		client = new Client({ name: "test-client", version: "1.0.0" })
		await Promise.all([client.connect(clientTransport), mcpServer.connect(serverTransport)])
	})

	afterAll(async () => {
		await client.close()
	})

	it("registers exactly the six frontend_ prefixed tools", async () => {
		const names = (await client.listTools()).tools.map((t) => t.name).sort()
		expect(names).toEqual(FRONTEND_TOOL_NAMES)
	})

	it("delivers an unmatched message to the postMessage transport", async () => {
		const sent = await client.callTool({
			name: "frontend_send_message_to_backend",
			arguments: { type: "action", action: "ping" },
		})
		const text = JSON.parse((sent.content as Array<{ type: string; text?: string }>)[0]?.text ?? "null")
		expect(text.sent).toBe(true)
		expect(text.intercepted).toBe(false)
		expect(posted).toEqual([{ type: "action", action: "ping" }])
	})

	it("short-circuits a matching send interceptor and does not post", async () => {
		await client.callTool({
			name: "frontend_set_message_interceptor",
			arguments: { direction: "frontend→backend", type: "action", action: "ping", response: { stub: true } },
		})
		const sent = await client.callTool({
			name: "frontend_send_message_to_backend",
			arguments: { type: "action", action: "ping" },
		})
		const text = JSON.parse((sent.content as Array<{ type: string; text?: string }>)[0]?.text ?? "null")
		expect(text.intercepted).toBe(true)
		expect(text.response).toEqual({ stub: true })
		expect(posted).toHaveLength(1)
	})
})

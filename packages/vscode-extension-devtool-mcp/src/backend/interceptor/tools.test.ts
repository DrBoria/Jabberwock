import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { MessageInterceptor } from "../../mcp/interceptor/index.js"
import { registerBackendInterceptorTools } from "./tools.js"

const BACKEND_TOOL_NAMES = [
	"clear_message_trace",
	"get_active_interceptors",
	"get_message_trace",
	"remove_message_interceptor",
	"send_message_to_webview",
	"set_message_interceptor",
].sort()

describe("registerBackendInterceptorTools", () => {
	let client: Client
	let interceptor: MessageInterceptor

	beforeAll(async () => {
		const mcpServer = new McpServer(
			{ name: "backend-tools-test", version: "1.0.0" },
			{ capabilities: { tools: {} } },
		)
		interceptor = new MessageInterceptor()
		registerBackendInterceptorTools(mcpServer, interceptor)
		const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
		client = new Client({ name: "test-client", version: "1.0.0" })
		await Promise.all([client.connect(clientTransport), mcpServer.connect(serverTransport)])
	})

	afterAll(async () => {
		await client.close()
	})

	it("registers exactly the six backend interceptor tools without a prefix", async () => {
		const names = (await client.listTools()).tools.map((t) => t.name).sort()
		expect(names).toEqual(BACKEND_TOOL_NAMES)
	})

	it("sends a message through the interceptor and short-circuits a matching one", async () => {
		const result = await client.callTool({
			name: "set_message_interceptor",
			arguments: { direction: "backend→webview", type: "action", action: "click", response: { stub: true } },
		})
		expect(result.isError).toBeUndefined()

		const sent = await client.callTool({
			name: "send_message_to_webview",
			arguments: { type: "action", action: "click" },
		})
		const text = JSON.parse((sent.content as Array<{ type: string; text?: string }>)[0]?.text ?? "null")
		expect(text.intercepted).toBe(true)
		expect(text.response).toEqual({ stub: true })
	})

	it("accepts both backend directions in set_message_interceptor", async () => {
		const receive = await client.callTool({
			name: "set_message_interceptor",
			arguments: { direction: "webview→backend", type: "command", response: {} },
		})
		expect(receive.isError).toBeUndefined()
		const active = interceptor.getActive()
		expect(active.some((i) => i.direction === "receive" && i.type === "command")).toBe(true)
	})
})

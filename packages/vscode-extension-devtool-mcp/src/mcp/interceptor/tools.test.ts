import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { MessageInterceptor } from "./index.js"
import { registerInterceptorTools, InterceptorToolsOptions } from "./tools.js"

interface Harness {
	client: Client
	interceptor: MessageInterceptor
}

const makeHarness = async (options: InterceptorToolsOptions): Promise<Harness> => {
	const mcpServer = new McpServer({ name: "test", version: "1.0.0" }, { capabilities: { tools: {} } })
	const interceptor = new MessageInterceptor()
	registerInterceptorTools(mcpServer, interceptor, options)
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
	const client = new Client({ name: "test-client", version: "1.0.0" })
	await Promise.all([client.connect(clientTransport), mcpServer.connect(serverTransport)])
	return { client, interceptor }
}

const call = async (client: Client, name: string, args: Record<string, unknown> = {}) => {
	const result = await client.callTool({ name, arguments: args })
	const text = (result.content as Array<{ type: string; text?: string }>)[0]?.text
	return JSON.parse(text ?? "null") as Record<string, unknown>
}

describe("registerInterceptorTools (backend variant)", () => {
	let h: Harness

	beforeAll(async () => {
		const mcpServer = new McpServer({ name: "test", version: "1.0.0" }, { capabilities: { tools: {} } })
		const interceptor = new MessageInterceptor()
		registerInterceptorTools(mcpServer, interceptor, {
			directions: { send: "backend→webview", receive: "webview→backend" },
			sendTool: { name: "send_message_to_webview", description: "send", send: (m) => interceptor.sendMessage(m) },
			trace: { kind: "getTrace", getTrace: (filter, limit) => interceptor.getTrace(filter, limit) },
		})
		const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
		const client = new Client({ name: "test-client", version: "1.0.0" })
		await Promise.all([client.connect(clientTransport), mcpServer.connect(serverTransport)])
		h = { client, interceptor }
	})

	afterAll(async () => {
		await h.client.close()
	})

	it("registers the six backend tools", async () => {
		const tools = await h.client.listTools()
		const names = tools.tools.map((t) => t.name).sort()
		expect(names).toEqual(
			[
				"clear_message_trace",
				"get_active_interceptors",
				"get_message_trace",
				"remove_message_interceptor",
				"send_message_to_webview",
				"set_message_interceptor",
			].sort(),
		)
	})

	it("set → send short-circuits with the mock response", async () => {
		await call(h.client, "set_message_interceptor", {
			direction: "backend→webview",
			type: "action",
			action: "click",
			response: { mock: true },
		})
		const sent = await call(h.client, "send_message_to_webview", {
			type: "action",
			action: "click",
			payload: { x: 1 },
		})
		expect(sent.intercepted).toBe(true)
		expect(sent.response).toEqual({ mock: true })
		expect(sent.message).toEqual({ type: "action", action: "click", payload: { x: 1 } })
	})

	it("rejects an unknown direction with a zod error", async () => {
		await expect(
			h.client.callTool({
				name: "set_message_interceptor",
				arguments: { direction: "bogus", type: "action", response: {} },
			}),
		).rejects.toThrow()
	})

	it("get_active_interceptors lists installed interceptors", async () => {
		const active = (await call(h.client, "get_active_interceptors")) as unknown
		expect(Array.isArray(active)).toBe(true)
		expect((active as Array<Record<string, unknown>>).some((i) => i.type === "action")).toBe(true)
	})

	it("get_message_trace returns the trace and clear_message_trace empties it", async () => {
		const trace = await call(h.client, "get_message_trace", { direction: "backend→webview" })
		expect(trace.totalMatched).toBeGreaterThanOrEqual(1)
		expect((trace.entries as unknown[]).length).toBeGreaterThan(0)
		await call(h.client, "clear_message_trace")
		const cleared = await call(h.client, "get_message_trace")
		expect(cleared.totalMatched).toBe(0)
	})

	it("remove_message_interceptor reports how many were removed", async () => {
		const removed = await call(h.client, "remove_message_interceptor", {
			direction: "backend→webview",
			type: "action",
		})
		expect(removed.removed).toBeGreaterThanOrEqual(1)
	})
})

describe("registerInterceptorTools (frontend variant)", () => {
	it("registers frontend_-prefixed tools with a single direction", async () => {
		const h = await makeHarness({
			prefix: "frontend_",
			directions: { send: "frontend→backend" },
			sendTool: {
				name: "send_message_to_backend",
				description: "send",
				send: (m) => new MessageInterceptor().sendMessage(m),
			},
			trace: {
				kind: "getTracePage",
				getTracePage: (filter, limit) => {
					const r = new MessageInterceptor().getTrace(filter, limit)
					return { entries: [...r.entries].reverse(), totalCount: r.totalCount }
				},
			},
		})
		const names = (await h.client.listTools()).tools.map((t) => t.name).sort()
		expect(names).toContain("frontend_send_message_to_backend")
		expect(names).toContain("frontend_get_message_trace")
		expect(names).not.toContain("send_message_to_webview")

		const sent = await call(h.client, "frontend_send_message_to_backend", { type: "action", action: "ping" })
		expect(sent.sent).toBe(true)
		await h.client.close()
	})
})

import { describe, expect, it, vi } from "vitest"
import { registerStateTools } from "./state.js"
import type { DevtoolMethods } from "../mcp/server.js"
import type { StoreEnv } from "../types.js"

/** A minimal McpServer double that records the tools registered on it. */
function makeMcpDouble() {
	const registered = new Map<string, unknown>()
	return {
		registered,
		tool: (name: string, _schema: unknown, handler: unknown) => {
			registered.set(name, handler)
			return { name }
		},
	}
}

/** A minimal DevtoolMethods double — only the members the tools call. */
function makeMethods(): DevtoolMethods {
	const noop = async () => "{}"
	return {
		getExtensionInfo: vi.fn(async () => "info"),
		getStoreState: vi.fn(noop),
		getStoreActions: vi.fn(noop),
		searchState: vi.fn(noop),
		filterActions: vi.fn(noop),
		searchActions: vi.fn(noop),
		countActions: vi.fn(noop),
		getStoreActionsLog: vi.fn(noop),
		applyPreviousState: vi.fn(noop),
		applyNextState: vi.fn(noop),
		getLogs: vi.fn(noop),
		getDiagnosticsSnapshot: vi.fn(noop),
		clearDiagnostics: vi.fn(noop),
		getConsole: vi.fn(noop),
		searchConsole: vi.fn(noop),
		executeVscodeCommand: vi.fn(noop),
		runCommand: vi.fn(noop),
		findElement: vi.fn(noop),
		clickElement: vi.fn(noop),
		scrollElement: vi.fn(noop),
		typeText: vi.fn(noop),
		selectOption: vi.fn(noop),
		getScreenshot: vi.fn(noop),
		dragElement: vi.fn(noop),
		dragFromTo: vi.fn(noop),
		getActivePage: vi.fn(noop),
	}
}

describe("registerStateTools gating", () => {
	it("always registers the health check tool", () => {
		const mcp = makeMcpDouble()
		registerStateTools(mcp as never, makeMethods(), [])
		expect(mcp.registered.has("get_extension_info")).toBe(true)
	})

	it("registers no env-based state tools when no env has a store", () => {
		const mcp = makeMcpDouble()
		registerStateTools(mcp as never, makeMethods(), [] as StoreEnv[])
		expect(mcp.registered.has("get_store_state")).toBe(false)
		expect(mcp.registered.has("get_store_actions")).toBe(false)
		expect(mcp.registered.has("search_state")).toBe(false)
	})

	it("registers the env-based state tools when at least one env is configured", () => {
		const mcp = makeMcpDouble()
		registerStateTools(mcp as never, makeMethods(), ["backend"])
		expect(mcp.registered.has("get_store_state")).toBe(true)
		expect(mcp.registered.has("get_store_actions")).toBe(true)
		expect(mcp.registered.has("search_state")).toBe(true)
	})
})

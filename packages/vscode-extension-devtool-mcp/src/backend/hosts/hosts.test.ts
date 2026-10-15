import { describe, expect, it, vi } from "vitest"
import { createDevtool as createExpressDevtool, devtoolMiddleware } from "./express.js"
import { createDevtool as createNestDevtool, DevtoolNestMiddleware } from "./nest.js"
import { DevtoolServer } from "../../mcp/server.js"
import type { DevtoolBridgeProvider } from "../../mcp/server.js"
import { createMobxAdapter } from "../../stores/mobx/store.js"
import { t } from "mobx-state-tree"

function makeProvider(): DevtoolBridgeProvider {
	return {
		findElement: vi.fn(async () => ""),
		getActivePage: vi.fn(),
		setActivePageRequestCallback: vi.fn(),
		setDomRequestCallback: vi.fn(),
		postMessageToWebview: vi.fn(),
		getModes: () => ["agent"],
		getMode: () => "agent",
	}
}

const mobxStore = t.model("Root", { count: t.optional(t.number, 0) }).create()
const mobxAdapter = createMobxAdapter(mobxStore)

describe("express createDevtool", () => {
	it("returns a DevtoolServer instance", () => {
		const devtool = createExpressDevtool({ provider: makeProvider(), config: {} })
		expect(devtool).toBeInstanceOf(DevtoolServer)
	})

	it("accepts a config with a backend store", () => {
		const devtool = createExpressDevtool({
			provider: makeProvider(),
			config: { backend: { store: mobxAdapter }, port: 7100 },
		})
		expect(devtool).toBeInstanceOf(DevtoolServer)
	})
})

describe("devtoolMiddleware", () => {
	it("attaches the devtool to res.locals and calls next", () => {
		const devtool = createExpressDevtool({ provider: makeProvider(), config: {} })
		const next = vi.fn()
		const res = { locals: {} as Record<string, unknown> }
		devtoolMiddleware(devtool)({}, res, next)
		expect(res.locals.devtool).toBe(devtool)
		expect(next).toHaveBeenCalledTimes(1)
	})
})

describe("nest createDevtool", () => {
	it("returns a DevtoolServer instance", () => {
		const devtool = createNestDevtool({ provider: makeProvider(), config: {} })
		expect(devtool).toBeInstanceOf(DevtoolServer)
	})
})

describe("DevtoolNestMiddleware", () => {
	it("attaches the devtool to the response and calls next", () => {
		const devtool = createNestDevtool({ provider: makeProvider(), config: {} })
		const mw = new DevtoolNestMiddleware(devtool)
		const next = vi.fn()
		const res: Record<string, unknown> = {}
		mw.use({}, res, next)
		expect(res.devtool).toBe(devtool)
		expect(next).toHaveBeenCalledTimes(1)
	})
})

import { describe, expect, it } from "vitest"
import { availableStoreEnvs, DEFAULT_MCP_PORT, DEFAULT_STATUS_PORT, resolveConfig } from "./config.js"
import { createMobxAdapter } from "../stores/mobx/store.js"
import { createPlainAdapter } from "../stores/redux/store.js"
import { t } from "mobx-state-tree"

const mobxStore = t.model("Root", { count: t.optional(t.number, 0) }).create()
const mobxAdapter = createMobxAdapter(mobxStore)

const reduxAdapter = createPlainAdapter({
	framework: "redux",
	getState: () => ({ counter: 1 }),
})

describe("resolveConfig", () => {
	it("defaults to no sides and default ports", () => {
		const resolved = resolveConfig()
		expect(resolved.backendEnabled).toBe(false)
		expect(resolved.frontendEnabled).toBe(false)
		expect(resolved.backendStore).toBeUndefined()
		expect(resolved.frontendStore).toBeUndefined()
		expect(resolved.port).toBe(DEFAULT_MCP_PORT)
		expect(resolved.statusPort).toBe(DEFAULT_STATUS_PORT)
	})

	it("resolves explicit ports", () => {
		const resolved = resolveConfig({ port: 7000, statusPort: 7001 })
		expect(resolved.port).toBe(7000)
		expect(resolved.statusPort).toBe(7001)
	})

	it("marks a side enabled when present, even without a store", () => {
		const resolved = resolveConfig({ backend: {}, frontend: { store: reduxAdapter } })
		expect(resolved.backendEnabled).toBe(true)
		expect(resolved.frontendEnabled).toBe(true)
		expect(resolved.backendStore).toBeUndefined()
		expect(resolved.frontendStore).toBe(reduxAdapter)
		expect(resolved.frontendFramework).toBe("redux")
	})

	it("captures framework ids from the store adapters", () => {
		const resolved = resolveConfig({ backend: { store: mobxAdapter } })
		expect(resolved.backendFramework).toBe("mobx")
		expect(resolved.backendStore).toBe(mobxAdapter)
	})
})

describe("availableStoreEnvs", () => {
	it("returns no envs when no stores are configured", () => {
		expect(availableStoreEnvs(resolveConfig({}))).toEqual([])
	})

	it("returns only the envs that have a store", () => {
		expect(availableStoreEnvs(resolveConfig({ backend: { store: mobxAdapter } }))).toEqual(["backend"])
		expect(
			availableStoreEnvs(resolveConfig({ backend: { store: mobxAdapter }, frontend: { store: reduxAdapter } })),
		).toEqual(["backend", "frontend"])
	})

	it("does not include a side that has no store", () => {
		expect(availableStoreEnvs(resolveConfig({ backend: {}, frontend: { store: reduxAdapter } }))).toEqual([
			"frontend",
		])
	})
})

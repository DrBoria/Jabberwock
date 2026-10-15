import { describe, expect, it, vi } from "vitest"
import { t } from "mobx-state-tree"
import { createMobxAdapter } from "./mobx/store.js"
import { createReduxAdapter, type ReduxStoreLike } from "./redux/store.js"
import { createZustandAdapter, type ZustandStoreLike } from "./zustand/store.js"
import { createApolloAdapter } from "./apollo/store.js"
import { createPlainAdapter } from "./redux/store.js"

// ── MobX (mobx-state-tree) ─────────────────────────────────────────────

const Counter = t
	.model("Counter", {
		count: t.optional(t.number, 0),
	})
	.actions((self) => ({
		increment() {
			self.count += 1
		},
	}))

describe("createMobxAdapter", () => {
	it("reports the mobx framework and a plain snapshot", () => {
		const store = Counter.create()
		const adapter = createMobxAdapter(store)
		expect(adapter.framework).toBe("mobx")
		expect(adapter.getSnapshot()).toEqual({ count: 0 })
	})

	it("records a history entry and change event per action", () => {
		const store = Counter.create()
		const adapter = createMobxAdapter(store)
		store.increment()
		// The MobX adapter always implements history + change log.
		const history = adapter.getHistory!()
		const log = adapter.getChangeLog!()
		expect(history.length).toBe(1)
		expect(history[0]?.label).toBe("increment")
		// `onAction` fires before the action body runs, so the recorded
		// snapshot is the pre-action state (the "previous version").
		expect(history[0]?.snapshot).toEqual({ count: 0 })
		// The live store has moved on to the post-action state.
		expect(adapter.getSnapshot()).toEqual({ count: 1 })
		expect(log.length).toBe(1)
		expect(log[0]?.action).toBe("increment")
	})

	it("notifies subscribers on change and stops after unsubscribe", () => {
		const store = Counter.create()
		const adapter = createMobxAdapter(store)
		const cb = vi.fn()
		const unsub = adapter.subscribeChanges?.(cb)
		store.increment()
		expect(cb).toHaveBeenCalledTimes(1)
		unsub?.()
		store.increment()
		expect(cb).toHaveBeenCalledTimes(1)
	})

	it("applies a snapshot back into the store", () => {
		const store = Counter.create()
		const adapter = createMobxAdapter(store)
		adapter.applySnapshot?.({ count: 7 })
		expect(adapter.getSnapshot()).toEqual({ count: 7 })
	})

	it("does not track changes when trackChanges is false", () => {
		const store = Counter.create()
		const adapter = createMobxAdapter(store, { trackChanges: false })
		store.increment()
		expect(adapter.getHistory?.()?.length ?? 0).toBe(0)
	})
})

// ── Redux ──────────────────────────────────────────────────────────────

function makeReduxStore(initial: Record<string, unknown>): ReduxStoreLike & {
	dispatch: (actionName: string, patch: Record<string, unknown>) => void
} {
	let state = { ...initial }
	const listeners = new Set<() => void>()
	return {
		getState: () => state,
		subscribe: (listener) => {
			listeners.add(listener)
			return () => listeners.delete(listener)
		},
		dispatch(actionName: string, patch: Record<string, unknown>) {
			// Record the action name before notifying listeners, mirroring a host
			// that wraps store.dispatch: by the time redux fires its listeners the
			// latest action name is available via getLastActionName.
			state = { ...state, ...patch, __lastAction: actionName }
			for (const l of listeners) l()
		},
	}
}

describe("createReduxAdapter", () => {
	it("reports the redux framework and current state", () => {
		const store = makeReduxStore({ count: 0 })
		const adapter = createReduxAdapter(store)
		expect(adapter.framework).toBe("redux")
		expect(adapter.getSnapshot()).toMatchObject({ count: 0 })
	})

	it("records history labeled with the last dispatched action", () => {
		const store = makeReduxStore({ count: 0 })
		const adapter = createReduxAdapter(store, {
			getLastActionName: () => (store.getState() as Record<string, unknown>).__lastAction as string,
		})
		store.dispatch("increment", { count: 1 })
		expect(adapter.getHistory?.()?.length).toBe(1)
		expect(adapter.getHistory?.()?.[0]?.label).toBe("increment")
	})
})

// ── Zustand ────────────────────────────────────────────────────────────

function makeZustandStore(initial: Record<string, unknown>): ZustandStoreLike {
	let state = { ...initial }
	const listeners = new Set<(s: Record<string, unknown>, p: Record<string, unknown>) => void>()
	return {
		getState: () => state,
		subscribe: (listener) => {
			listeners.add(listener)
			return () => listeners.delete(listener)
		},
		setState: (partial, replace) => {
			const prev = state
			state = replace ? { ...partial } : { ...state, ...partial }
			for (const l of listeners) l(state, prev)
		},
	}
}

describe("createZustandAdapter", () => {
	it("reports the zustand framework and current state", () => {
		const store = makeZustandStore({ count: 0 })
		const adapter = createZustandAdapter(store)
		expect(adapter.framework).toBe("zustand")
		expect(adapter.getSnapshot()).toEqual({ count: 0 })
	})

	it("labels history with the changed keys and supports applySnapshot", () => {
		const store = makeZustandStore({ count: 0, name: "x" })
		const adapter = createZustandAdapter(store)
		store.setState({ count: 5 })
		expect(adapter.getHistory?.()?.length).toBe(1)
		expect(adapter.getHistory?.()?.[0]?.label).toBe("count")
		adapter.applySnapshot?.({ count: 9, name: "y" })
		expect(adapter.getSnapshot()).toEqual({ count: 9, name: "y" })
	})
})

// ── Apollo ─────────────────────────────────────────────────────────────

describe("createApolloAdapter", () => {
	it("reports the apollo framework and the extracted cache", () => {
		const cache = { "User:1": { id: "User:1", name: "Ada" } }
		const adapter = createApolloAdapter({ extractCache: () => cache })
		expect(adapter.framework).toBe("apollo")
		expect(adapter.getSnapshot()).toBe(cache)
	})
})

// ── Plain adapter (shared base) ────────────────────────────────────────

describe("createPlainAdapter", () => {
	it("records history + change log when the subscribe hook fires", () => {
		let state = { n: 0 }
		const listeners = new Set<(actionName?: string) => void>()
		const adapter = createPlainAdapter({
			name: "my-store",
			framework: "custom",
			getState: () => state,
			subscribe: (cb) => {
				listeners.add(cb)
				return () => listeners.delete(cb)
			},
		})
		// simulate a change
		state = { n: 1 }
		for (const l of listeners) l("bump")
		expect(adapter.getHistory?.()?.length).toBe(1)
		expect(adapter.getHistory?.()?.[0]?.label).toBe("bump")
		expect(adapter.getChangeLog?.()?.[0]?.action).toBe("bump")
		expect(adapter.name).toBe("my-store")
	})

	it("omits optional members when not supplied", () => {
		const adapter = createPlainAdapter({ framework: "custom", getState: () => ({}) })
		expect(adapter.getActions).toBeUndefined()
		expect(adapter.applySnapshot).toBeUndefined()
		expect(adapter.subscribeChanges).toBeTypeOf("function")
	})
})

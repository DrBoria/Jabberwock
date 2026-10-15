import type { IStoreAdapter, HistoryEntry, StoreChange, ActionEntry } from "../../types.js"
import { SnapshotHistory, ChangeLog } from "./history.js"

export interface PlainAdapterOptions {
	/** Display name of the store (default "store"). */
	name?: string
	/** Framework identifier reported to the agent (e.g. "zustand"). */
	framework: string
	/** Ring-buffer capacity for history snapshots (default 50). */
	historyCapacity?: number
	/** Ring-buffer capacity for the change log (default 500). */
	changeLogCapacity?: number
	/**
	 * Return the current full state as a plain object. For redux this is
	 * `store.getState()`, for zustand `store.getState()`, for apollo the
	 * extracted cache.
	 */
	getState: () => Record<string, unknown>
	/**
	 * Optional subscribe hook. Called with a callback that fires whenever the
	 * store changes; the callback receives the action name (if known) so the
	 * adapter can label the history entry. Returns an unsubscribe function.
	 */
	subscribe?: (cb: (actionName?: string) => void) => () => void
	/** Return the actions/methods available on the store, if introspectable. */
	getActions?: () => ActionEntry[]
	/** Restore the store from a snapshot, if the framework supports it. */
	applySnapshot?: (snapshot: Record<string, unknown>) => void
}

/**
 * Build an {@link IStoreAdapter} on top of a framework that exposes its state
 * as a plain object (redux, zustand, apollo-graphql). This is the shared
 * implementation behind the `redux`, `zustand`, and `apollo` adapters.
 *
 * History ("previous versions") and the change log are recorded automatically
 * whenever the optional `subscribe` hook fires, so adapters that wire it up
 * get undo/redo + change events for free.
 */
export function createPlainAdapter(options: PlainAdapterOptions): IStoreAdapter {
	const {
		name = "store",
		framework,
		historyCapacity = 50,
		changeLogCapacity = 500,
		getState,
		subscribe,
		getActions,
		applySnapshot,
	} = options

	const history = new SnapshotHistory(historyCapacity)
	const changeLog = new ChangeLog(changeLogCapacity)
	const listeners = new Set<(change: StoreChange) => void>()

	const recordChange = (actionName?: string): void => {
		const change: StoreChange = { path: name, action: actionName, timestamp: Date.now() }
		changeLog.append(change)
		history.record(getState(), actionName)
		for (const cb of listeners) {
			try {
				cb(change)
			} catch {
				// A throwing subscriber must not break the store.
			}
		}
	}

	if (subscribe) {
		subscribe((actionName) => recordChange(actionName))
	}

	const adapter: IStoreAdapter = {
		name,
		framework,
		getSnapshot: getState,
	}
	if (getActions) adapter.getActions = getActions
	if (applySnapshot) adapter.applySnapshot = applySnapshot

	adapter.getHistory = (): HistoryEntry[] => history.list()
	adapter.getChangeLog = (): StoreChange[] => changeLog.list()
	adapter.subscribeChanges = (cb) => {
		listeners.add(cb)
		return () => {
			listeners.delete(cb)
		}
	}

	return adapter
}

export interface ZustandStoreLike {
	/** Return the current full state as a plain object. */
	getState(): Record<string, unknown>
	/** Zustand subscribe: listener receives (state, prevState); returns unsubscribe. */
	subscribe(listener: (state: Record<string, unknown>, prevState: Record<string, unknown>) => void): () => void
	/** Zustand setState: merge a partial state into the store. */
	setState(partial: Record<string, unknown>, replace?: boolean): void
}

export interface ZustandAdapterOptions {
	/** Display name of the store (default "zustand-store"). */
	name?: string
	/** Ring-buffer capacity for history snapshots (default 50). */
	historyCapacity?: number
	/** Ring-buffer capacity for the change log (default 500). */
	changeLogCapacity?: number
	/**
	 * Resolve a human-readable label for a (state, prevState) pair, e.g. the
	 * names of the keys that changed. Used to label history entries.
	 */
	describeChange?: (state: Record<string, unknown>, prevState: Record<string, unknown>) => string | undefined
}

/**
 * Adapt a Zustand store (or any object exposing `getState`/`subscribe`/
 * `setState`) into the devtool's {@link IStoreAdapter} contract.
 *
 * Zustand's `subscribe` receives `(state, prevState)`, so the adapter derives
 * a change label from the keys that differ between the two.
 */
export function createZustandAdapter(store: ZustandStoreLike, options: ZustandAdapterOptions = {}): IStoreAdapter {
	const { name = "zustand-store", historyCapacity, changeLogCapacity, describeChange } = options

	const label = (state: Record<string, unknown>, prevState: Record<string, unknown>): string | undefined => {
		if (describeChange) return describeChange(state, prevState)
		const keys = Object.keys(state).filter((k) => state[k] !== prevState[k])
		return keys.length > 0 ? keys.join(",") : undefined
	}

	const base: PlainAdapterOptions = {
		name,
		framework: "zustand",
		getState: () => store.getState(),
		historyCapacity,
		changeLogCapacity,
		subscribe: (cb) => store.subscribe((state, prevState) => cb(label(state, prevState))),
		applySnapshot: (snapshot) => store.setState(snapshot, true),
	}

	return createPlainAdapter(base)
}

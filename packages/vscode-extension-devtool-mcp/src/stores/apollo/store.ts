import type { IStoreAdapter, HistoryEntry, StoreChange, ActionEntry } from "../../types.js"
import { SnapshotHistory, ChangeLog } from "./history.js"

export interface PlainAdapterOptions {
	/** Display name of the store (default "store"). */
	name?: string
	/** Framework identifier reported to the agent (e.g. "apollo"). */
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

export interface ApolloAdapterOptions {
	/** Display name of the store (default "apollo-cache"). */
	name?: string
	/**
	 * Return the Apollo normalized cache as a plain object. For
	 * `@apollo/client` this is typically `client.cache.extract()`.
	 */
	extractCache: () => Record<string, unknown>
	/** Ring-buffer capacity for history snapshots (default 50). */
	historyCapacity?: number
	/** Ring-buffer capacity for the change log (default 500). */
	changeLogCapacity?: number
	/**
	 * Optional subscribe hook for change tracking. Apollo's cache does not
	 * expose a simple synchronous subscribe in every version, so the host may
	 * wire this up via `client.subscribeToMore` / result listeners.
	 */
	subscribe?: (cb: (actionName?: string) => void) => () => void
	/**
	 * Restore the cache from a snapshot, if the host supports it (e.g.
	 * `client.cache.restore(snapshot)`).
	 */
	restoreCache?: (snapshot: Record<string, unknown>) => void
}

/**
 * Adapt an Apollo GraphQL client's normalized cache into the devtool's
 * {@link IStoreAdapter} contract.
 *
 * Apollo's normalized cache is a plain object keyed by entity id, which maps
 * naturally onto the devtool's snapshot/search/tree algorithms.
 */
export function createApolloAdapter(options: ApolloAdapterOptions): IStoreAdapter {
	const { name = "apollo-cache", extractCache, historyCapacity, changeLogCapacity, subscribe, restoreCache } = options

	const base: PlainAdapterOptions = {
		name,
		framework: "apollo",
		getState: extractCache,
		historyCapacity,
		changeLogCapacity,
	}
	if (subscribe) base.subscribe = subscribe
	if (restoreCache) base.applySnapshot = restoreCache

	return createPlainAdapter(base)
}

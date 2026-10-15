import type { IStoreAdapter, HistoryEntry, StoreChange, ActionEntry } from "../../types.js"
import { SnapshotHistory, ChangeLog } from "./history.js"

export interface PlainAdapterOptions {
	/** Display name of the store (default "store"). */
	name?: string
	/** Framework identifier reported to the agent (e.g. "redux"). */
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

export interface ReduxStoreLike {
	/** Return the current full state as a plain object. */
	getState(): Record<string, unknown>
	/** Redux subscribe: returns an unsubscribe function. */
	subscribe(listener: () => void): () => void
}

export interface ReduxAdapterOptions {
	/** Display name of the store (default "redux-store"). */
	name?: string
	/** Ring-buffer capacity for history snapshots (default 50). */
	historyCapacity?: number
	/** Ring-buffer capacity for the change log (default 500). */
	changeLogCapacity?: number
	/**
	 * Resolve the dispatched action name for a given (last, current) state pair.
	 * Redux's `subscribe` callback receives no action, so to label history
	 * entries the host must wrap `dispatch` and record the latest action name.
	 * Return the most recently dispatched action name, if tracked.
	 */
	getLastActionName?: () => string | undefined
	/** Restore the store from a snapshot, if the host supports it. */
	applySnapshot?: (snapshot: Record<string, unknown>) => void
}

/**
 * Adapt a Redux store (or any object exposing `getState` + `subscribe`) into
 * the devtool's {@link IStoreAdapter} contract.
 *
 * Redux's `subscribe` fires with no action argument, so to capture action
 * names for the history/change log, the host should wrap `store.dispatch` and
 * record the latest action name, then expose it via `getLastActionName`.
 */
export function createReduxAdapter(store: ReduxStoreLike, options: ReduxAdapterOptions = {}): IStoreAdapter {
	const { name = "redux-store", historyCapacity, changeLogCapacity, getLastActionName, applySnapshot } = options

	const base: PlainAdapterOptions = {
		name,
		framework: "redux",
		getState: () => store.getState(),
		historyCapacity,
		changeLogCapacity,
		subscribe: (cb) => store.subscribe(() => cb(getLastActionName?.())),
	}
	if (applySnapshot) base.applySnapshot = applySnapshot

	return createPlainAdapter(base)
}

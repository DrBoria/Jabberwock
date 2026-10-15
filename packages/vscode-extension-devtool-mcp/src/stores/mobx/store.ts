import { getSnapshot, applySnapshot, onAction } from "mobx-state-tree"
import type { IStoreAdapter, ActionEntry, HistoryEntry, StoreChange } from "../../types.js"
import { SnapshotHistory, ChangeLog } from "./history.js"
import { extractActions } from "./actions.js"

export interface MobxAdapterOptions {
	/** Ring-buffer capacity for captured history snapshots (default 50). */
	historyCapacity?: number
	/** Ring-buffer capacity for the change log (default 500). */
	changeLogCapacity?: number
	/**
	 * When true, subscribe to `onAction` on the root store and record a
	 * history snapshot + change-log entry after every action. Default true.
	 */
	trackChanges?: boolean
}

/**
 * Wrap a MobX-State-Tree root store in the framework-agnostic
 * {@link IStoreAdapter} contract.
 *
 * This is the ONLY place in the devtool that imports `mobx-state-tree`. The
 * rest of the package operates on the plain snapshots this adapter produces,
 * which is what keeps the package usable as a generic npm library.
 *
 * @param rootStore - The MST root store instance (typed loosely so any MST
 *   root can be passed without importing the host's model types).
 */
export function createMobxAdapter(rootStore: unknown, options: MobxAdapterOptions = {}): IStoreAdapter {
	const { historyCapacity = 50, changeLogCapacity = 500, trackChanges = true } = options

	const history = new SnapshotHistory(historyCapacity)
	const changeLog = new ChangeLog(changeLogCapacity)
	const listeners = new Set<(change: StoreChange) => void>()

	const recordChange = (actionName: string, path: string): void => {
		const change: StoreChange = { path, action: actionName, timestamp: Date.now() }
		changeLog.append(change)
		history.record(getSnapshot(rootStore as never) as Record<string, unknown>, actionName)
		for (const cb of listeners) {
			try {
				cb(change)
			} catch {
				// A throwing subscriber must not break the store's action flow.
			}
		}
	}

	if (trackChanges) {
		onAction(rootStore as never, (action) => {
			recordChange(action.name, (action.path ?? "").replace(/^\//, ""))
		})
	}

	return {
		name: "mobx-store",
		framework: "mobx",

		getSnapshot() {
			return getSnapshot(rootStore as never) as Record<string, unknown>
		},

		getActions() {
			return extractActions(this.getSnapshot())
		},

		getHistory(): HistoryEntry[] {
			return history.list()
		},

		getChangeLog(): StoreChange[] {
			return changeLog.list()
		},

		subscribeChanges(cb: (change: StoreChange) => void) {
			listeners.add(cb)
			return () => {
				listeners.delete(cb)
			}
		},

		applySnapshot(snapshot: Record<string, unknown>) {
			applySnapshot(rootStore as never, snapshot)
		},
	}
}

export type { ActionEntry }

import { getSnapshot } from "mobx-state-tree"
import type { IBackendRootStore } from "./store"

let _rootStore: IBackendRootStore | undefined

export function getState(_provider?: unknown): IBackendRootStore {
	if (!_rootStore)
		throw new Error("BackendRootStore not initialized. Call createBackendRootStore() or setRootStore() first.")
	return _rootStore
}

export function setRootStore(store: IBackendRootStore): void {
	_rootStore = store
}

export function getBackendRootStore(): IBackendRootStore {
	if (!_rootStore) throw new Error("BackendRootStore not initialized. Call createBackendRootStore() first.")
	return _rootStore
}

/**
 * Full plain-object snapshot of the root store (MST 7.x module-level `getSnapshot`).
 *
 * Used by the web connector's hello -> state handshake to hand the client the complete
 * backend state. The instance method `store.getSnapshot()` does not exist in MST 7.x, so
 * this helper centralizes the module-level call.
 */
export function getBackendRootSnapshot(): Record<string, unknown> {
	if (!_rootStore) throw new Error("BackendRootStore not initialized. Call createBackendRootStore() first.")
	return getSnapshot(_rootStore) as Record<string, unknown>
}

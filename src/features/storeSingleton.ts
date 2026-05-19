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

import { createContext, useContext } from "react"
import type { IRootStore } from "./root-store"
import { getRootStore } from "./root-store"

const RootStoreContext = createContext<IRootStore | null>(null)

export function useRootStore(): IRootStore {
	const store = useContext(RootStoreContext)
	if (!store) {
		// Fallback to singleton if no provider (for backward compat during migration)
		return getRootStore()
	}
	return store
}

export { RootStoreContext }

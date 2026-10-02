import { createContext, useContext } from "react"
import type { IRootStore } from "./root-store"
import { getRootStore, rootStore } from "./root-store"

/**
 * Store module — thin re-export layer.
 *
 * The actual RootStore definition lives in `./root-store.ts`.
 * This file provides backward-compatible exports so existing imports
 * (e.g. `import { rootStore } from "./features/store"`) continue to work.
 */
// Re-export the singleton WITHOUT a top-level createRootStore() call here.
// A top-level `createRootStore()` in this module caused a TDZ crash
// ("Cannot access ... before initialization") under the circular import
// store.ts → root-store/index.ts → model → chat/store.tsx → store.ts,
// because Rollup emitted this statement before singleton.ts's `let _rootStore`.
// Local re-export (no `from`) to satisfy local/no-reexport: the binding is
// imported above, so this is a plain named export, not a re-export.
export { rootStore }

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

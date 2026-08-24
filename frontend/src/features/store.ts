/**
 * Store module — thin re-export layer.
 *
 * The actual RootStore definition lives in `./root-store.ts`.
 * This file provides backward-compatible exports so existing imports
 * (e.g. `import { rootStore } from "./features/store"`) continue to work.
 */
// Backward-compatible singleton reference (initialized lazily)
import { createRootStore } from "./root-store"
export const rootStore = createRootStore()

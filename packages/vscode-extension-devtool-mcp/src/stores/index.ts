/**
 * Stores domain barrel.
 *
 * The stores domain adapts the host's state stores (mobx-state-tree, redux,
 * zustand, apollo-graphql) into the devtool's framework-agnostic
 * {@link IStoreAdapter} contract and registers the store MCP tools.
 *
 * There is no shared root code here: the plain-object adapter base is
 * duplicated into each framework folder that uses it (`redux/`, `zustand/`,
 * `apollo/`), and each framework keeps its own `history.ts`.
 */
export * from "./tools.js"
export { registerStateTools } from "./state.js"

// Per-framework subfolders (explicit — the adapter names are already re-exported
// from `./tools.js`, so we only surface the framework-specific extras here).
export { extractActions } from "./mobx/actions.js"
export { discoverStoreTree, resolvePath, resolveNestedPath } from "./mobx/snapshot/tree.js"
export { SnapshotHistory, ChangeLog } from "./mobx/history.js"

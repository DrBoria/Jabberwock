/**
 * Zustand store tools.
 *
 * Exports the zustand store adapter (and its framework id) so the stores-domain
 * selector (`stores/tools.ts`) can decide whether zustand is active in this
 * project. The generic store tools (`get_store_state`, `search_state`, …) are
 * shared across frameworks and live in `stores/state.ts`.
 */
export const ZUSTAND_FRAMEWORK = "zustand"
export { createZustandAdapter, type ZustandAdapterOptions, type ZustandStoreLike } from "./store.js"

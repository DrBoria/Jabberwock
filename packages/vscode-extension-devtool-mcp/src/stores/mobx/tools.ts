/**
 * MobX store tools.
 *
 * Exports the mobx store adapter (and its framework id) so the stores-domain
 * selector (`stores/tools.ts`) can decide whether mobx is active in this
 * project. The generic store tools (`get_store_state`, `search_state`, …) are
 * shared across frameworks and live in `stores/state.ts`.
 */
export const MOBX_FRAMEWORK = "mobx"
export { createMobxAdapter, type MobxAdapterOptions } from "./store.js"

/**
 * Apollo store tools.
 *
 * Exports the apollo store adapter (and its framework id) so the stores-domain
 * selector (`stores/tools.ts`) can decide whether apollo is active in this
 * project. The generic store tools (`get_store_state`, `search_state`, …) are
 * shared across frameworks and live in `stores/state.ts`.
 */
export const APOLLO_FRAMEWORK = "apollo"
export { createApolloAdapter, type ApolloAdapterOptions } from "./store.js"

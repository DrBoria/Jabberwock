/**
 * Redux store tools.
 *
 * Exports the redux store adapter (and its framework id) so the stores-domain
 * selector (`stores/tools.ts`) can decide whether redux is active in this
 * project. The generic store tools (`get_store_state`, `search_state`, …) are
 * shared across frameworks and live in `stores/state.ts`.
 */
export const REDUX_FRAMEWORK = "redux"
export { createReduxAdapter, type ReduxAdapterOptions, type ReduxStoreLike } from "./store.js"

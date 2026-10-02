/**
 * Frontend History events — barrel exports.
 */
export { frontendHistoryEventConstants } from "./constants"
export type { FrontendHistoryEventKey } from "./constants"
export { registerOnFrontendHistoryIntents } from "./handlers/history-received"

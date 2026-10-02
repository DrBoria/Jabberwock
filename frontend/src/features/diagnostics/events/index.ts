/**
 * Frontend Diagnostics events — barrel exports.
 */
export { frontendDiagnosticsEventConstants } from "./constants"
export type { FrontendDiagnosticsEventKey } from "./constants"
export { registerOnFrontendDiagnosticsIntents } from "./handlers/diagnostics-received"

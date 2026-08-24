/**
 * Write protection utilities for Jabberwock configuration files.
 *
 * Pure functions — no module-level state, no side effects.
 * Pattern constants are imported from @features/settings/constants.
 */
export { isWriteProtected } from "./isWriteProtected"
export { getProtectedFiles } from "./getProtectedFiles"
export { annotatePathsWithProtection } from "./annotatePathsWithProtection"

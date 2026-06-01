/**
 * Ignore utilities — pure functions for .jabberwockignore file pattern matching.
 *
 * These are NOT feature-specific; they are used across chat tools, services,
 * and settings context. They live here as shared utilities.
 */
export { validateAccess } from "./validateAccess"
export { filterPaths } from "./filterPaths"
export { validateCommand } from "./validateCommand"
export { readIgnoreFile } from "./readIgnoreFile"

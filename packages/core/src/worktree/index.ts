/**
 * Worktree Module
 *
 * Platform-agnostic git worktree management functionality.
 * These exports are decoupled from VSCode and can be used by any consumer.
 */

// Types
export * from "./types.ts"

// Services
export { WorktreeService, worktreeService } from "./service.ts"
export { WorktreeIncludeService, worktreeIncludeService } from "./include.ts"
export type { CopyProgress, CopyProgressCallback } from "./include-helpers.ts"

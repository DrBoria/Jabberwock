/**
 * Barrel file for task feature.
 *
 * Re-exports TaskModel and related types so consumers import from
 * `../../features/chat/task` rather than from individual files.
 *
 * @module
 */

// ─── Store models & types ────────────────────────────────────────────────
export { TaskStateModel, TaskModel } from "./store"
export type { TaskStatus, LoopStackItem, ITaskStateModel, ITaskModel } from "./store"

/**
 * Barrel file for task feature.
 *
 * Re-exports TaskModel and related types so consumers import from
 * `../../features/chat/task` rather than from individual files.
 *
 * @module
 */

// ─── Store models & types (defined in store.ts) ──────────────────────────
export { TaskModelBase, TaskStateBase } from "./store"

// ─── Task model (defined via MST composition chain) ──────────────────────
export { TaskModel } from "./task-store/task-model/actions/task-model-actions-goals"
export type { ITaskModel } from "./task-store/task-model/actions/task-model-actions-goals"

// ─── Task state model ────────────────────────────────────────────────────
export { TaskStateModel } from "./task-store/task-state/actions-goals"
export type { ITaskStateModel } from "./task-store/task-state/actions-goals"

// ─── Task types ──────────────────────────────────────────────────────────
export type { TaskStatus, LoopStackItem } from "./task-store/task-state/task-types"

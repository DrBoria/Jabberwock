// ─── Barrel: re-exports everything the old store.ts exported ────────────
// All imports of @features/chat/task/store resolve here.

export { TaskStateModel } from "./task-state/actions-goals"
export { TaskModel } from "./task-model/actions/task-model-actions-goals"
export { TaskModelBase, TaskStateBase, TaskNotificationsModel } from "@features/chat/task/store"
export type { TaskStatus, LoopStackItem } from "./task-state/task-types"
export type { ITaskStateModel } from "./task-state/actions-goals"
export type { ITaskModel } from "./task-model/actions/task-model-actions-goals"

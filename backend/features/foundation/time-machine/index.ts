/**
 * Barrel for the `foundation/time-machine` feature (S5 no-deep / no-shadow-store debt).
 *
 * Re-exports the time-machine instance-slot accessors (`actions/getTimeMachine.ts`) so consumers
 * import `@features/foundation/time-machine` instead of the deep module path. Other modules
 * (`VirtualWorkspace`, `file-context`, `actions/checkpoints`, `apply`, `store`, `events`) stay
 * deep-imported until their own slices convert them.
 */

export * from "./actions/getTimeMachine"
// ─── Re-exports from "store.ts" (MST models) ─────────────────────
export { FilesModel, CheckpointStoreModel, FileContextTrackerStoreModel } from "./store"
export type { IFilesModel, FilesState, ICheckpointStoreModel, IFileContextTrackerStoreModel } from "./store"
export { sendCurrentCheckpointUpdated, sendCheckpointInitWarning } from "./events/actions/sendCheckpointEvent"
export { VirtualWorkspace, isVirtualWorkspace, virtualWorkspace } from "./VirtualWorkspace"

/**
 * History feature — events layer.
 *
 * Handles history-related IPC between frontend and backend.
 * - constants.ts: Event key constants
 * - actions/: Send events to frontend
 * - handlers/: Receive events from frontend, dispatch via IntentBus
 */
export { historyEventConstants } from "./constants"
export type { HistoryEventKey } from "./constants"
export { registerOnHistoryIntents } from "./handlers"

/**
 * Cloud feature — events layer.
 *
 * Handles cloud-related IPC between frontend and backend.
 * - constants.ts: Event key constants
 * - actions/: Send events to frontend
 * - handlers/: Receive events from frontend, dispatch via IntentBus
 */
export { cloudEventConstants } from "./constants"
export type { CloudEventKey } from "./constants"
export { registerOnCloudIntents } from "./handlers"

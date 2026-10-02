/**
 * Marketplace feature — events layer.
 *
 * Handles marketplace-related IPC between frontend and backend.
 * - constants.ts: Event key constants
 * - actions/: Send events to frontend
 * - handlers/: Receive events from "frontend", dispatch via IntentBus
 */
export * from "./constants"
export { registerOnMarketplaceIntents } from "./handlers/register"

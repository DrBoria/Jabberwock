import type { IntentBus } from "../../../../../intents/bus"
import { registerAllContextManagementHandlers } from "../../handlers"

/**
 * Register all file-context-related event handlers on the given IntentBus.
 *
 * Delegates to the existing registerAllContextManagementHandlers in the
 * file-context/handlers/ directory to avoid duplicating registration logic.
 */
export function registerOnContextManagementIntents(bus: IntentBus): void {
	registerAllContextManagementHandlers(bus)
}

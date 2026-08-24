import { type IntentBus } from "./bus"
import { registerOnFrontendFoundationIntents } from "../foundation/events/handlers"
import { registerOnFrontendChatIntents } from "../chat/events/handlers"
import { registerOnFrontendTaskIntents } from "../chat/task/events/handlers"
import { registerOnFrontendNotificationsIntents } from "../chat/task/notifications/events/handlers"
import { registerOnFrontendSettingsIntents } from "../settings/events/handlers"
import { registerOnFrontendMarketplaceIntents } from "../marketplace/events/handlers"
import { registerOnFrontendCloudIntents } from "../cloud/events/handlers"
import { registerOnFrontendHistoryIntents } from "../history/events/handlers"
import { registerOnFrontendDiagnosticsIntents } from "../diagnostics/events/handlers"
import { registerOnFrontendWindowManagerIntents } from "../foundation/window-manager/events/handlers"

/**
 * All frontend IntentBus handler registration functions.
 * Each entry is a function that receives the bus and registers its handlers.
 */
const registrations: ((bus: IntentBus) => void)[] = [
	registerOnFrontendFoundationIntents,
	registerOnFrontendChatIntents,
	registerOnFrontendTaskIntents,
	registerOnFrontendNotificationsIntents,
	registerOnFrontendSettingsIntents,
	registerOnFrontendMarketplaceIntents,
	registerOnFrontendCloudIntents,
	registerOnFrontendHistoryIntents,
	registerOnFrontendDiagnosticsIntents,
	registerOnFrontendWindowManagerIntents,
]

/**
 * Register all feature intent handlers on the given bus.
 * Called once from setupIntents() after the bus is created.
 */
export function registerAllFrontendIntents(bus: IntentBus): void {
	for (const register of registrations) {
		register(bus)
	}
}

import { type IntentBus } from "./bus"
import { registerOnFrontendFoundationIntents } from "@src/features/foundation/events"
import { registerOnFrontendChatIntents } from "@src/features/chat/events"
import { registerOnFrontendTaskIntents } from "@src/features/chat/task/events"
import { registerOnFrontendSettingsIntents } from "@src/features/settings/events"
import { registerOnFrontendMarketplaceIntents } from "@src/features/marketplace/events"
import { registerOnFrontendCloudIntents } from "@src/features/cloud/events"
import { registerOnFrontendHistoryIntents } from "@src/features/history/events"
import { registerOnFrontendDiagnosticsIntents } from "@src/features/diagnostics/events"

/**
 * All frontend IntentBus handler registration functions.
 * Each entry is a function that receives the bus and registers its handlers.
 */
const registrations: ((bus: IntentBus) => void)[] = [
	registerOnFrontendFoundationIntents,
	registerOnFrontendChatIntents,
	registerOnFrontendTaskIntents,
	registerOnFrontendSettingsIntents,
	registerOnFrontendMarketplaceIntents,
	registerOnFrontendCloudIntents,
	registerOnFrontendHistoryIntents,
	registerOnFrontendDiagnosticsIntents,
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

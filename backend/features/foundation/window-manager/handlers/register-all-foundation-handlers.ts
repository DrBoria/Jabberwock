import type { IntentBus } from "@features/intents"
import { registerOnFocusPanelRequested } from "./ui/focus-panel"
import { registerOnTabSwitch } from "./ui/on-tab-switch"
import { registerOnActivePageResponse } from "./ui/on-active-page-response"
import { registerOnStateRequested } from "./ui/on-state-requested"
import { registerOnTaskAggregatedCosts } from "./task/on-task-aggregated-costs"
import { registerOnTaskShow } from "./task/on-task-show"
import { registerOnTaskDelete, registerOnTaskDeleteMultiple } from "./task/delete"
import { registerOnTaskExport, registerOnTaskExportCurrent } from "./task/export"

/**
 * Register all foundation-related intent handlers on the bus.
 */
export function registerAllFoundationHandlers(bus: IntentBus): void {
	registerOnFocusPanelRequested(bus)
	registerOnTabSwitch(bus)
	registerOnActivePageResponse(bus)
	registerOnStateRequested(bus)
	registerOnTaskAggregatedCosts(bus)
	registerOnTaskShow(bus)
	registerOnTaskDelete(bus)
	registerOnTaskExport(bus)
	registerOnTaskExportCurrent(bus)
	registerOnTaskDeleteMultiple(bus)
}

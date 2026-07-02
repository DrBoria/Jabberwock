import type { IntentBus } from "@features/intents/bus"
import { registerOnFocusPanelRequested } from "./ui/on-focus-panel-requested"
import { registerOnTabSwitch } from "./ui/on-tab-switch"
import { registerOnActivePageResponse } from "./ui/on-active-page-response"
import { registerOnStateRequested } from "./ui/on-state-requested"
import { registerOnTaskAggregatedCosts } from "./task/on-task-aggregated-costs"
import { registerOnTaskShow } from "./task/on-task-show"
import { registerOnTaskDelete } from "./task/on-task-delete"
import { registerOnTaskExport } from "./task/on-task-export"
import { registerOnTaskExportCurrent } from "./task/on-task-export-current"
import { registerOnTaskDeleteMultiple } from "./task/on-task-delete-multiple"

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

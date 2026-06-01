import type { IntentBus } from "../../../intents/bus"
import { registerOnFocusPanelRequested } from "./on-focus-panel-requested"
import { registerOnTabSwitch } from "./on-tab-switch"
import { registerOnActivePageResponse } from "./on-active-page-response"
import { registerOnStateRequested } from "./on-state-requested"
import { registerOnTaskAggregatedCosts } from "./on-task-aggregated-costs"
import { registerOnTaskShow } from "./on-task-show"
import { registerOnTaskDelete } from "./on-task-delete"
import { registerOnTaskExport } from "./on-task-export"
import { registerOnTaskExportCurrent } from "./on-task-export-current"
import { registerOnTaskDeleteMultiple } from "./on-task-delete-multiple"

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

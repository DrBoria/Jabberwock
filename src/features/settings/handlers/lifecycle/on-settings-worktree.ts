import type { IntentBus } from "@features/intents/bus"

import { registerCrudRegistrations } from "@features/settings/handlers/on-settings-worktree/crud-registrations"
import { registerInfoRegistrations } from "@features/settings/handlers/on-settings-worktree/info-registrations"

/**
 * Register all worktree settings intent handlers.
 */
export function registerOnSettingsWorktree(bus: IntentBus): void {
	registerCrudRegistrations(bus)
	registerInfoRegistrations(bus)
}

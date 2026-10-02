import type { IntentBus } from "@features/intents"
import { registerCrudRegistrations } from "@features/settings"
import { registerInfoRegistrations } from "@features/settings"

/**
 * Register all worktree settings intent handlers.
 */
export function registerOnSettingsWorktree(bus: IntentBus): void {
	registerCrudRegistrations(bus)
	registerInfoRegistrations(bus)
}

import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import { getHostContext } from "@features/foundation/host-context/context"
import { getCommand } from "@utils/mcp/commands"

/**
 * Handles foundation.focus.panel.requested intent — focuses the Jabberwock panel.
 */
export function registerOnFocusPanelRequested(bus: IntentBus): void {
	bus.register(IntentType.FoundationFocusPanelRequested, async () => {
		getHostContext()?.hostCommands?.executeCommand?.(getCommand("focusPanel"))
	})
}

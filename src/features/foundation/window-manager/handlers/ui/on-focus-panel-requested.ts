import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import * as vscode from "vscode"
import { getCommand } from "@utils/mcp/commands"

/**
 * Handles foundation.focus.panel.requested intent — focuses the Jabberwock panel.
 */
export function registerOnFocusPanelRequested(bus: IntentBus): void {
	bus.register(IntentType.FoundationFocusPanelRequested, async () => {
		await vscode.commands.executeCommand(getCommand("focusPanel"))
	})
}

import { vscode } from "@jabberwock/devtool/webview"
import type { WebviewMessage } from "@jabberwock/types"
import { eventConstants } from "@jabberwock/types"

/**
 * Topic actions — switching modes and requesting slash commands.
 */
export function createTopicActions(_self: unknown) {
	return {
		// ── Mode switching ─────────────────────────────────────────
		switchMode(modeSlug: string) {
			vscode.postMessage({
				type: eventConstants.CHAT.TOPIC.MODE,
				text: modeSlug,
			} satisfies WebviewMessage)
		},

		// ── Request commands ───────────────────────────────────────
		requestCommands() {
			vscode.postMessage({
				type: eventConstants.CHAT.TOPIC.REQUEST_COMMANDS,
			} satisfies WebviewMessage)
		},
	}
}

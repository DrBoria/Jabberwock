import { vscode } from "@jabberwock/devtool/react"
import type { WebviewMessage } from "@jabberwock/types"
import { CHAT_TOPIC_MODE, CHAT_TOPIC_REQUEST_COMMANDS } from "@jabberwock/types"

/**
 * Topic actions — switching modes and requesting slash commands.
 */
export function createTopicActions(_self: unknown) {
	return {
		// ── Mode switching ─────────────────────────────────────────
		switchMode(modeSlug: string) {
			vscode.postMessage({
				type: CHAT_TOPIC_MODE,
				text: modeSlug,
			} satisfies WebviewMessage)
		},

		// ── Request commands ───────────────────────────────────────
		requestCommands() {
			vscode.postMessage({
				type: CHAT_TOPIC_REQUEST_COMMANDS,
			} satisfies WebviewMessage)
		},
	}
}

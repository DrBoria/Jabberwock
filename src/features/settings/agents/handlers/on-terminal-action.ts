import type { EventBridge } from "../../../foundation/webview/EventBridge"

/** Message payload for a terminal action forwarded from VS Code command handlers. */
export interface TerminalActionMessage {
	type: string
	command?: string
	promptType?: string
	params?: unknown
	[key: string]: unknown
}

/**
 * Forward a terminal action message to the webview.
 *
 * Called programmatically from VS Code command handlers (registerTerminalActions).
 * This is an outbound-only path (extension → webview).
 */
export async function handleTerminalAction(provider: EventBridge, message: TerminalActionMessage): Promise<void> {
	await provider.postMessageToWebview(message)
}

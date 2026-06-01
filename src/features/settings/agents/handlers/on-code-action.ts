import type { EventBridge } from "../../../foundation/webview/EventBridge"

/** Message payload for a code action forwarded from VS Code command handlers. */
export interface CodeActionMessage {
	type: string
	command?: string
	promptType?: string
	params?: unknown
	[key: string]: unknown
}

/**
 * Forward a code action message to the webview.
 *
 * Called programmatically from VS Code command handlers (registerCodeActions,
 * handleTask). This is an outbound-only path (extension → webview); the
 * webview never sends these types back.
 */
export async function handleCodeAction(provider: EventBridge, message: CodeActionMessage): Promise<void> {
	await provider.postMessageToWebview(message)
}

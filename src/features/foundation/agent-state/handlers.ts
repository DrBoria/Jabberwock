import type { EventBridge } from "../../../core/webview/EventBridge"
import type { WebviewMessage } from "@jabberwock/types"

/** WebviewMessage with index signature for dynamic property access. */
type HandlerMessage = WebviewMessage & Record<string, unknown>
export type HandlerFn = (provider: EventBridge, message: HandlerMessage) => Promise<void>

/**
 * Standalone handler for code actions.
 */
export async function handleCodeAction(provider: EventBridge, message: Record<string, unknown>): Promise<void> {
	const handler = handlerMap["handleCodeAction"]
	if (handler) {
		await handler(provider, message as HandlerMessage)
	}
}

/**
 * Standalone handler for terminal actions.
 */
export async function handleTerminalAction(provider: EventBridge, message: Record<string, unknown>): Promise<void> {
	const handler = handlerMap["handleTerminalAction"]
	if (handler) {
		await handler(provider, message as HandlerMessage)
	}
}

export const handlerMap: Record<string, HandlerFn> = {
	handleCodeAction: async (provider, message) => {
		await provider.postMessageToWebview(message as Record<string, unknown>)
	},

	handleTerminalAction: async (provider, message) => {
		await provider.postMessageToWebview(message as Record<string, unknown>)
	},
}

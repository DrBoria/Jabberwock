import type { ProviderHandle } from "@features/foundation/webview/EventBridge"
import { WebviewMessage } from "@jabberwock/types"

type WebviewMessageHandler = (provider: ProviderHandle, message: { [key: string]: unknown }) => Promise<void>

/**
 * Registry of per-type webview message handlers.
 *
 * Features register their own handlers via `onWebviewMessage()` during
 * initialization, replacing the monolithic WEBVIEW_TO_INTENT map approach.
 * Each handler receives the full message and is responsible for creating
 * the appropriate intent(s) on the IntentBus.
 */
const messageHandlers = new Map<string, (provider: ProviderHandle, message: WebviewMessage) => void>()

/**
 * Register a handler for a specific webview message type.
 *
 * Called by features during their `registerOn*Intents()` initialization
 * to self-register their slice of webview message routing. This replaces
 * the need for the centralized WEBVIEW_TO_INTENT map.
 *
 * @param type - The webview message type string to handle
 * @param handler - Called when a webview message of this type is received
 */
export function onWebviewMessage(
	type: string,
	handler: (provider: ProviderHandle, message: WebviewMessage) => void,
): void {
	if (messageHandlers.has(type)) {
		console.warn(`[jabberwock] [webviewMessageHandler] Overwriting existing handler for message type: "${type}"`)
	}
	messageHandlers.set(type, handler)
}

/**
 * Routes a webview message to its registered handler.
 *
 * Features self-register their handlers via `onWebviewMessage()` during
 * `registerOn*Intents()` initialization. If no handler is registered for
 * the message type, a warning is emitted to help identify unhandled messages.
 */
export const webviewMessageHandler: WebviewMessageHandler = async (provider, message) => {
	const typedMessage = message as never as WebviewMessage
	const type = typedMessage.type

	const handler = messageHandlers.get(type)
	if (handler) {
		handler(provider, typedMessage)
		return
	}

	console.warn(`[jabberwock] [webviewMessageHandler] No handler for message type: "${type}"`)
}

/**
 * Task event action creators.
 *
 * These are the ONLY code paths that may send task-related events
 * to the webview via postMessageToWebview. No other code may import or call
 * postMessageToWebview directly.
 */

import type { ClientTarget } from "@jabberwock/types"

import { getProvider } from "@features/foundation/webview"
import { postMessageToWebview } from "@features/foundation"

/**
 * Structural view of a webview-capable provider accepted by the provider-scoped
 * creators below. Assignable from `EventBridge`, `ProviderHandle`,
 * `WebviewProvider` and the structural webview-launched handle — so a single
 * creator signature serves every call site.
 */
export interface WebviewMessageTarget {
	postMessageToWebview(message: Record<string, unknown>, target?: ClientTarget): unknown
}

/**
 * Send an invoke command to the webview.
 */
export function sendInvoke(invoke: string): void {
	const provider = getProvider()
	postMessageToWebview(provider, { type: "invoke", invoke })
}

/**
 * Send an action command to the webview.
 */
export function sendAction(action: string): void {
	const provider = getProvider()
	postMessageToWebview(provider, { type: "action", action })
}

/**
 * Send a generic event to the webview with an arbitrary message payload.
 * Use this for message types that are not covered by a dedicated action creator.
 */
export function sendEvent(message: Record<string, unknown>): void {
	const provider = getProvider()
	postMessageToWebview(provider, message)
}

/**
 * Send a command execution status update.
 */
export function sendCommandExecutionStatus(status: Record<string, unknown>): void {
	const provider = getProvider()
	postMessageToWebview(provider, {
		type: "commandExecutionStatus",
		text: JSON.stringify(status),
	})
}

/**
 * Send a cancel task command to the webview.
 */
export function sendCancelTask(): void {
	const provider = getProvider()
	postMessageToWebview(provider, { type: "cancelTask" })
}

// ─── Provider-scoped creators ─────────────────────────────────────────────
// These take the in-scope `provider` as the first argument (the call site owns
// which provider to deliver to — e.g. `targetProvider` in newTab mode) and call
// `provider.postMessageToWebview` directly, preserving the original delivery path.

/**
 * Send the "chat button clicked" action to the webview.
 */
export function sendChatButtonClicked(provider: WebviewMessageTarget): unknown {
	return provider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
}

/**
 * Send a "newChat" invoke to the webview, optionally carrying text and images.
 */
export function sendNewChatInvoke(provider: WebviewMessageTarget, text?: string, images?: string[]): unknown {
	return provider.postMessageToWebview({ type: "invoke", invoke: "newChat", text, images })
}

/**
 * Send a "newChat" invoke (clear) to the webview.
 */
export function sendClearNewChat(provider: WebviewMessageTarget): unknown {
	return provider.postMessageToWebview({ type: "invoke", invoke: "newChat" })
}

/**
 * Send an enhanced prompt result to the webview.
 */
export function sendEnhancedPrompt(provider: WebviewMessageTarget, text?: string): unknown {
	return provider.postMessageToWebview({ type: "enhancedPrompt", text })
}

/**
 * Send file search results to the webview.
 */
export function sendFileSearchResults(
	provider: WebviewMessageTarget,
	payload: { results: unknown[]; requestId?: string; error?: string },
): unknown {
	return provider.postMessageToWebview({
		type: "fileSearchResults",
		results: payload.results,
		requestId: payload.requestId,
		error: payload.error,
	})
}

/**
 * Send dragged images to the webview.
 */
export function sendDraggedImages(provider: WebviewMessageTarget, images: string[]): unknown {
	return provider.postMessageToWebview({ type: "draggedImages", images })
}

/**
 * Send selected images (with context) to the webview.
 */
export function sendSelectedImages(
	provider: WebviewMessageTarget,
	payload: { images: string[]; context?: unknown; messageTs?: unknown },
): unknown {
	return provider.postMessageToWebview({
		type: "selectedImages",
		images: payload.images,
		context: payload.context,
		messageTs: payload.messageTs,
	})
}

/**
 * Send a full state snapshot to the webview.
 */
export function sendState(provider: WebviewMessageTarget, state: Record<string, unknown>): unknown {
	return provider.postMessageToWebview({ type: "state", state })
}

/**
 * Send a "sendMessage" invoke to the webview.
 */
export function sendSendMessageInvoke(provider: WebviewMessageTarget, text?: string, images?: string[]): unknown {
	return provider.postMessageToWebview({ type: "invoke", invoke: "sendMessage", text, images })
}

/**
 * Send an ask-response acknowledgement to a specific client.
 */
export function sendAskResponseAck(
	provider: WebviewMessageTarget,
	payload: { requestId: string; status: string },
	target?: ClientTarget,
): unknown {
	return provider.postMessageToWebview(
		{ type: "askResponseAck", requestId: payload.requestId, status: payload.status },
		target,
	)
}

/**
 * Broadcast a converged ask decision to all connected clients.
 */
export function sendNotificationAskResolved(
	provider: WebviewMessageTarget,
	payload: { requestId: string; askResponse: unknown; text?: unknown },
): unknown {
	return provider.postMessageToWebview({
		type: "notification.ask.resolved",
		requestId: payload.requestId,
		askResponse: payload.askResponse,
		text: payload.text,
	})
}

/**
 * Ask the webview to show the delete-message confirmation dialog.
 */
export function sendShowDeleteMessageDialog(
	provider: WebviewMessageTarget,
	payload: { messageTs: number; hasCheckpoint: boolean },
): unknown {
	return provider.postMessageToWebview({
		type: "showDeleteMessageDialog",
		messageTs: payload.messageTs,
		hasCheckpoint: payload.hasCheckpoint,
	})
}

/**
 * Ask the webview to show the edit-message dialog.
 */
export function sendShowEditMessageDialog(
	provider: WebviewMessageTarget,
	payload: { messageTs: number; text: string; hasCheckpoint: boolean; images?: string[] },
): unknown {
	return provider.postMessageToWebview({
		type: "showEditMessageDialog",
		messageTs: payload.messageTs,
		text: payload.text,
		hasCheckpoint: payload.hasCheckpoint,
		images: payload.images,
	})
}

/**
 * Send a TTS start signal to the webview.
 */
export function sendTtsStart(provider: WebviewMessageTarget, text: string): unknown {
	return provider.postMessageToWebview({ type: "ttsStart", text })
}

/**
 * Send a TTS stop signal to the webview.
 */
export function sendTtsStop(provider: WebviewMessageTarget, text: string): unknown {
	return provider.postMessageToWebview({ type: "ttsStop", text })
}

/**
 * Send an MCP execution status update to the webview.
 */
export function sendMcpExecutionStatus(provider: WebviewMessageTarget, status: unknown): unknown {
	return provider.postMessageToWebview({
		type: "mcpExecutionStatus",
		text: JSON.stringify(status),
	})
}

/**
 * Send the slash-command list to the webview.
 */
export function sendCommands(provider: WebviewMessageTarget, commands: unknown[]): unknown {
	return provider.postMessageToWebview({ type: "commands", commands })
}

/**
 * Send a "switchTab" action to the webview.
 */
export function sendSwitchTab(
	provider: WebviewMessageTarget,
	payload: { tab: string; values?: Record<string, unknown>; fromMCP?: boolean },
): unknown {
	return provider.postMessageToWebview({
		type: "action",
		action: "switchTab",
		tab: payload.tab,
		values: payload.values,
		fromMCP: payload.fromMCP,
	})
}

/**
 * Send a task with aggregated costs to the webview.
 */
export function sendTaskWithAggregatedCosts(
	provider: WebviewMessageTarget,
	payload: { text: string; historyItem?: unknown; aggregatedCosts?: unknown; error?: string },
): unknown {
	return provider.postMessageToWebview({
		type: "taskWithAggregatedCosts",
		text: payload.text,
		historyItem: payload.historyItem,
		aggregatedCosts: payload.aggregatedCosts,
		error: payload.error,
	})
}

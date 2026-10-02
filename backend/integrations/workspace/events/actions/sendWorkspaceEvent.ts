/**
 * Workspace event action creator.
 *
 * This is the ONLY code path that may send workspace-updated events to the
 * webview. No other code may call postMessageToWebview directly for workspace
 * updates.
 */

import type { ClientTarget } from "@jabberwock/types"

/**
 * Structural view of a webview-capable provider accepted by the creator below.
 * Assignable from `EventBridge`, `ProviderHandle` and `WebviewProvider`.
 */
export interface WebviewMessageTarget {
	postMessageToWebview(message: Record<string, unknown>, target?: ClientTarget): unknown
}

/**
 * Send a workspace-updated event (changed file paths + opened tabs) to the
 * webview.
 */
export function sendWorkspaceUpdated(
	provider: WebviewMessageTarget,
	payload: { uri: string; filePaths: string[]; openedTabs: unknown },
): unknown {
	return provider.postMessageToWebview({
		type: "workspaceUpdated",
		uri: payload.uri,
		filePaths: payload.filePaths,
		openedTabs: payload.openedTabs,
	})
}

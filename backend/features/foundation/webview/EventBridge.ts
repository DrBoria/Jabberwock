import type { BackendCapabilities, ClientTarget, IBackendConnector } from "@jabberwock/types"

import { Package } from "@shared/core/package"
import { getStore } from "@features/singleton"
import { getProvider } from "./providerRegistry"

/**
 * Narrow provider handle for use by action creators.
 * Action creators MUST NOT import the full EventBridge class.
 * Only event handlers and the messages exception may import EventBridge directly.
 */
export interface ProviderHandle {
	postMessageToWebview(message: Record<string, unknown>, target?: ClientTarget): Promise<boolean>
	context: { globalStorageUri: { fsPath: string } }
}

/**
 * v4 Phase B3 (§4.2): transport-agnostic webview bridge.
 *
 * The ONLY source of knowledge about the host is the injected connector surface
 * (`IBackendConnector`) + capabilities (`BackendCapabilities`) — this file contains
 * ZERO vscode types (purity rule G6). The vscode webview lifecycle (resolveWebviewView,
 * html, localResourceRoots) lives in `connectors/vscode/backend/connector.ts`.
 *
 * - OUTBOUND: `postMessageToWebview` → `connector.sendOutbound(...)`.
 * - INBOUND: subscribed at bootstrap via `connector.onInbound(...) → capabilities.queue`;
 *   the queue drain consumer calls the existing `webviewMessageHandler` resolver (§4.6).
 */
export function EventBridge(connector: IBackendConnector, caps: BackendCapabilities) {
	/**
	 * ProviderHandle-compatible context surface — sourced from "the" injected hostContext
	 * capability (storageDir), never from "a" host type.
	 */
	function context(): { globalStorageUri: { fsPath: string } } {
		return { globalStorageUri: { fsPath: caps.hostContext.storageDir } }
	}

	// ─── Public API — pure IPC over the connector ─────────────────────
	async function postMessageToWebview(
		message: { type: string; [key: string]: unknown },
		target?: ClientTarget,
	): Promise<boolean> {
		// Log to MST store for debug visibility via devtool MCP.
		try {
			const store = getStore()
			store.logEvent({
				type: message.type,
				ts: Date.now(),
				direction: "outgoing",
				payload: message,
			})
		} catch {
			// Store may not be initialized yet during early startup.
		}
		connector.sendOutbound(message, target)
		return true
	}

	// ─── Lifecycle ──────────────────────────────────────────────────
	function dispose(): void {
		// Transport/lifecycle ownership moved to the connector (§4.2) — nothing to release here.
	}

	return {
		connector,
		caps,
		context: context(),
		postMessageToWebview,
		dispose,
	}
}

export type EventBridge = ReturnType<typeof EventBridge>

// ─── Former statics, now module-level ─────────────────────────────────

export const sideBarId = `${Package.name}.SidebarProvider`
export const tabPanelId = `${Package.name}.TabPanel`

/**
 * @deprecated v4 §4.2 — kept until Phase E as a thin wrapper over the active connector
 * registered in providerRegistry, to minimize the ~58-file diff.
 */
export function getFirstAvailableInstance(): EventBridge | undefined {
	try {
		return getProvider() as EventBridge
	} catch {
		return undefined
	}
}

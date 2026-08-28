import EventEmitter from "events"
import type { TaskProviderEvents } from "@jabberwock/types"
import type { BackendCapabilities, ClientTarget, IBackendConnector } from "@jabberwock/types"

import { Package } from "@shared/package"
import { getBackendRootStore } from "@features/storeSingleton"
import { getProvider } from "./providerRegistry"

/**
 * Narrow provider handle for use by action creators.
 * Action creators MUST NOT import the full EventBridge class.
 * Only event handlers and the messages exception may import EventBridge directly.
 */
export interface ProviderHandle {
	postMessageToWebview(message: Record<string, unknown>): Promise<boolean>
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
export class EventBridge extends EventEmitter<TaskProviderEvents> {
	static readonly sideBarId = `${Package.name}.SidebarProvider`
	static readonly tabPanelId = `${Package.name}.TabPanel`

	constructor(
		readonly connector: IBackendConnector,
		readonly caps: BackendCapabilities,
	) {
		super()
	}

	/**
	 * ProviderHandle-compatible context surface — sourced from the injected hostContext
	 * capability (storageDir), never from a vscode type.
	 */
	get context(): { globalStorageUri: { fsPath: string } } {
		return { globalStorageUri: { fsPath: this.caps.hostContext.storageDir } }
	}

	// ─── Public API — pure IPC over the connector ─────────────────────
	async postMessageToWebview(
		message: { type: string; [key: string]: unknown },
		target?: ClientTarget,
	): Promise<boolean> {
		// Log to MST store for debug visibility via devtool MCP.
		try {
			const store = getBackendRootStore()
			store.logEvent({
				type: message.type,
				ts: Date.now(),
				direction: "outgoing",
				payload: message,
			})
		} catch {
			// Store may not be initialized yet during early startup.
		}
		this.connector.sendOutbound(message, target)
		return true
	}

	// ─── Lifecycle ──────────────────────────────────────────────────
	dispose(): void {
		// Transport/lifecycle ownership moved to the connector (§4.2) — nothing to release here.
	}

	/**
	 * @deprecated v4 §4.2 — kept until Phase E as a thin wrapper over the active connector
	 * registered in providerRegistry, to minimize the ~58-file diff.
	 */
	static getVisibleInstance(): EventBridge | undefined {
		try {
			return getProvider() as EventBridge
		} catch {
			return undefined
		}
	}

	/**
	 * @deprecated v4 §4.2 — kept until Phase E as a thin wrapper over the active connector
	 * registered in providerRegistry, to minimize the ~58-file diff.
	 */
	static getFirstAvailableInstance(): EventBridge | undefined {
		try {
			return getProvider() as EventBridge
		} catch {
			return undefined
		}
	}
}

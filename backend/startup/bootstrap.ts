import type { BackendCapabilities, IBackendConnector } from "@jabberwock/types"

import { setBackendLogger } from "@features/foundation/capabilities/backend-logger"
import { drainQueueToResolver, wireInboundToQueue } from "@features/foundation/webview/inbound-wiring"
import { EventBridge } from "@features/foundation/webview/EventBridge"
import { webviewMessageHandler } from "@features/foundation/webview/events/handlers/on-webview-message"
import { setConnector, setProvider } from "@features/foundation/webview/providerRegistry"
import { initContextArchive } from "@features/context"
import { registerContextIntents } from "@features/context/actions"

/**
 * Options for the shared backend bootstrap (plan §7.1).
 *
 * Both entrypoints (vscode extension and standalone server) construct their host adapter
 * (`IBackendConnector`) + capabilities and hand them in — the shared bootstrap owns the
 * composition, so there is exactly ONE code path after the seam (§4.1).
 */
export interface BackendStartupOptions {
	/** Active transport connector (vscode webview or web WS server) — the sole host adapter. */
	connector: IBackendConnector
	/** Host capabilities (memory, queue, pubsub, hostContext, logger) handed to the connector at start. */
	capabilities: BackendCapabilities
}

/**
 * v4 Phase C2 (§7.1): shared backend composition root — единственная точка старта для обоих режимов.
 *
 * Composes the transport-agnostic core shared by BOTH entrypoints:
 *   1. `connector.start(capabilities)` — transport up (webview ready / WS listening on loopback|TUN).
 *   2. `EventBridge(connector, caps)` — the single transport-agnostic bridge (§4.2).
 *   3. Active provider + connector slots in the providerRegistry for legacy call sites (Phase E).
 *   4. Inbound wiring: `connector.onInbound → capabilities.queue → drain → webviewMessageHandler` (§4.6).
 *   5. Module-level logger slot (`setBackendLogger`), backed by `caps.logger` when the host provides one.
 *
 * PURITY NOTE (G6 / criterion C-2 §8.3): this module deliberately does NOT create the MST root store
 * or register feature intent handlers. Those stay on the host path because the root-store import graph
 * is still vscode-coupled — `reports/audit-platform.json` lists 100 backend files importing "vscode",
 * and the root-store graph alone reaches 21 of them (verified by the Phase C2 esbuild probe). Importing
 * them here would pull "vscode" into the standalone server bundle and fail the esbuild purity gate.
 * Extension mode therefore continues to call `createBackendRootStore` + `setupIntentBus` after
 * `startBackend()` (in `connectors/vscode/backend/activation/extension.ts`); server mode hydrates from a
 * pure capability-derived state. Once the purity debt is cleared, this composition graduates to the full
 * §7.1 sketch (root store + intent bus inside `startBackend`).
 *
 * @returns the registered `EventBridge` (the active provider handle).
 */
export async function startBackend(opts: BackendStartupOptions): Promise<EventBridge> {
	const { connector, capabilities } = opts

	// Transport up first — the webview is ready / the WS server is listening (§7.1).
	await connector.start(capabilities)

	// ICG-C1 (ICG doc §5.6/§5.7): context archive opens on every startup in BOTH modes - SQLite store under hostContext.storageDir, JSON ground truth reconciled against it; failures degrade to "archive disabled" without blocking boot. Pure Node module: safe for both bundles (v4 G6 / C-2).
	void initContextArchive(capabilities.hostContext.storageDir)

	// One transport-agnostic bridge for both hosts (§4.2).
	const bridge = new EventBridge(connector, capabilities)

	// Active provider + connector slots for legacy call sites until Phase E (§10.2).
	setProvider(bridge)
	setConnector(connector)

	// ICG-C2 section 8.1: context graph intent handlers (search/recall/describe/history-range plus the cancel observer).
	// Registered from the shared bootstrap so BOTH hosts get them - web mode has no setupIntentBus; in extension mode a later
	// setupIntentBus registration may overwrite the "cancelTask" slot (recorded deviation, full dual-mode wiring lands with Phase D1).
	registerContextIntents()

	// Inbound: connector → queue → drain → existing resolver (§4.6).
	wireInboundToQueue(connector, capabilities.queue, connector.id)
	void drainQueueToResolver(capabilities.queue, (item) => webviewMessageHandler(bridge, item.body, item.clientId))

	// Module-level logger slot (L8 / §4.2): only when the host provides one, so the extension's
	// outputChannel logger (installed by `installExtensionCapabilities`) is never overwritten.
	if (capabilities.logger) {
		setBackendLogger(capabilities.logger)
	}

	return bridge
}

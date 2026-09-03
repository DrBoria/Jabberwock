/**
 * Type declaration for the shared backend bootstrap (`backend/startup/bootstrap.ts`, plan §7.1).
 *
 * This connector package resolves `@startup/bootstrap` to this declaration so its own
 * `tsc --noEmit` stays isolated from the backend source graph (which is still partially
 * vscode-coupled — reports/audit-platform.json). The runtime/server bundle resolves the
 * SAME specifier to the real implementation via `backend/tsconfig.json` (`@startup/*`),
 * so there is exactly one code path at runtime. Keep this declaration in sync with the
 * real `BackendStartupOptions`/`startBackend` signatures in `backend/startup/bootstrap.ts`.
 */
import type { BackendCapabilities, IBackendConnector } from "@jabberwock/types"

/** Options for the shared backend bootstrap (mirror of `BackendStartupOptions`). */
export interface BackendStartupOptions {
	/** Active transport connector (vscode webview or web WS server) — the sole host adapter. */
	connector: IBackendConnector
	/** Host capabilities (memory, queue, pubsub, hostContext, logger) handed to the connector at start. */
	capabilities: BackendCapabilities
}

/**
 * Shared backend composition root — единственная точка старта для обоих режимов (§7.1).
 * Starts the transport, wires the EventBridge + provider registry + inbound queue, and
 * installs the logger slot. Returns the registered `EventBridge` provider handle.
 */
export declare function startBackend(opts: BackendStartupOptions): Promise<unknown>

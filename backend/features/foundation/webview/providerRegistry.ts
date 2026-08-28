import type { IBackendConnector } from "@jabberwock/types"

import type { ProviderHandle } from "./EventBridge"

/**
 * Module-level singleton storing the active EventBridge ProviderHandle.
 *
 * Set once during extension activation (after EventBridge creation) and
 * read by any code that needs access to the provider for non-event purposes
 * (e.g. reading `context.globalStorageUri.fsPath`, constructing VSCode objects).
 *
 * This replaces the previous pattern of storing a WeakRef<ProviderHandle> on
 * every TaskModel instance and passing it via `task.providerRef!.deref()`.
 *
 * ── Rules ───────────────────────────────────────────────────────────
 * 1. ONLY event actions (in `events/actions/*.ts`) call postMessageToWebview.
 * 2. All other code calls event actions, NOT postMessageToWebview directly.
 * 3. This registry is ONLY for non-postMessage access to ProviderHandle.
 */

let _provider: ProviderHandle | undefined

/** Set the active provider (called once during extension activation). */
export function setProvider(provider: ProviderHandle): void {
	if (_provider) {
		console.warn("[providerRegistry] Provider already set — overwriting")
	}
	_provider = provider
}

/** Get the active provider. Throws if not set (extension not fully activated). */
export function getProvider(): ProviderHandle {
	if (!_provider) {
		throw new Error("[providerRegistry] Provider not set — extension activation may not have completed")
	}
	return _provider
}

/** Check whether a provider has been registered. */
export function hasProvider(): boolean {
	return _provider !== undefined
}

/** Clear the provider reference (called during deactivation). */
export function clearProvider(): void {
	_provider = undefined
}

// ─── v4 B2: active backend connector slot (§10.2 / §4.2) ──────────────
// The registry now also holds the singleton active IBackendConnector so that
// transport-agnostic code (window-manager messaging, L12 notification publishers)
// can send outbound messages without importing host modules. Legacy ProviderHandle
// accessors above stay until Phase E cleanup (§4.2: deprecated wrappers).

let _connector: IBackendConnector | undefined

/** Set the active backend connector (called once during bootstrap/activation). */
export function setConnector(connector: IBackendConnector): void {
	if (_connector) {
		console.warn("[providerRegistry] Connector already set — overwriting")
	}
	_connector = connector
}

/** Get the active backend connector. Throws if not installed (bootstrap incomplete). */
export function getConnector(): IBackendConnector {
	if (!_connector) {
		throw new Error("[providerRegistry] Backend connector not installed — bootstrap may not have completed")
	}
	return _connector
}

/** Check whether a backend connector has been registered. */
export function hasConnector(): boolean {
	return _connector !== undefined
}

/** Clear the connector reference (called during deactivation). */
export function clearConnector(): void {
	_connector = undefined
}

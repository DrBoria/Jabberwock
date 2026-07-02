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

import type { BackendCapabilities } from "@jabberwock/types"

/**
 * Process-wide capability registry (plan §4.3 — «инжектится ОДИН раз при старте»).
 *
 * Bootstrap installs the single `BackendCapabilities` instance during activation; every other
 * module reads slots through these accessors instead of importing host modules directly. This is
 * what makes the zero-host-API invariant (C-5) checkable: all external APIs are reachable only via
 * this registry or the connector surface.
 */

let _capabilities: BackendCapabilities | undefined

/** Install capabilities once at startup. Throws on double-install to catch bootstrap ordering bugs. */
export function setBackendCapabilities(capabilities: BackendCapabilities): void {
	if (_capabilities) {
		throw new Error("[capabilities] setBackendCapabilities called twice — capabilities are installed exactly once")
	}
	_capabilities = capabilities
}

/** Get the process-wide capabilities. Throws if bootstrap has not run yet (fail fast, like getVscodeContext). */
export function getBackendCapabilities(): BackendCapabilities {
	if (!_capabilities) {
		throw new Error("[capabilities] Not initialized — setBackendCapabilities() must be called during activation")
	}
	return _capabilities
}

/** Check whether capabilities have been installed (for optional-slot degradation paths, e.g. fileWatchers). */
export function hasBackendCapabilities(): boolean {
	return _capabilities !== undefined
}

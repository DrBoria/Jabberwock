import { Package } from "@shared/core/package"
import { getConfiguration } from "@features/foundation/capabilities"
import { ProxyConfig } from "./types"
import { proxyState } from "./state"

/** Host extension-mode enum value: Development (numeric comparison per the v4 host-context convention). */
const EXTENSION_MODE_DEVELOPMENT = 1

export function getProxyConfig(): ProxyConfig {
	const defaultServerUrl = "http://127.0.0.1:8888"

	if (!proxyState.extensionContext) {
		return {
			enabled: false,
			serverUrl: defaultServerUrl,
			tlsInsecure: false,
			isDebugMode: false,
		}
	}

	// D4b (C-2 purity): config reads go through the capability slot, never the host module.
	const config = getConfiguration()
	const enabled = Boolean(config.get<unknown>(Package.name, "debugProxy.enabled"))
	const rawServerUrl = config.get<unknown>(Package.name, "debugProxy.serverUrl")
	const serverUrl = typeof rawServerUrl === "string" && rawServerUrl.trim() ? rawServerUrl.trim() : defaultServerUrl
	const tlsInsecure = Boolean(config.get<unknown>(Package.name, "debugProxy.tlsInsecure"))

	const isDebugMode = proxyState.extensionContext.extensionMode === EXTENSION_MODE_DEVELOPMENT

	return {
		enabled,
		serverUrl,
		tlsInsecure,
		isDebugMode,
	}
}

export function restoreGlobalFetchPatch(): void {
	if (!proxyState.fetchPatched) {
		return
	}

	if (proxyState.originalFetch) {
		globalThis.fetch = proxyState.originalFetch
	}

	proxyState.fetchPatched = false
	proxyState.originalFetch = undefined
}

export function restoreTlsVerificationOverride(): void {
	if (!proxyState.tlsVerificationOverridden) {
		return
	}

	if (typeof proxyState.originalNodeTlsRejectUnauthorized === "string") {
		process.env.NODE_TLS_REJECT_UNAUTHORIZED = proxyState.originalNodeTlsRejectUnauthorized
	} else {
		delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
	}

	proxyState.tlsVerificationOverridden = false
	proxyState.originalNodeTlsRejectUnauthorized = undefined
}

export function applyTlsVerificationOverride(config: ProxyConfig): void {
	if (!config.isDebugMode || !config.enabled) {
		restoreTlsVerificationOverride()
		return
	}

	if (!config.tlsInsecure) {
		restoreTlsVerificationOverride()
		return
	}

	if (!proxyState.tlsVerificationOverridden) {
		proxyState.originalNodeTlsRejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED
	}

	process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
	proxyState.tlsVerificationOverridden = true
}

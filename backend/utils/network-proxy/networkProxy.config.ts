import * as vscode from "vscode"
import { Package } from "@shared/package"
import { ProxyConfig } from "./networkProxy.types"
import { proxyState } from "./networkProxy.state"

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

	const config = vscode.workspace.getConfiguration(Package.name)
	const enabled = Boolean(config.get<unknown>("debugProxy.enabled"))
	const rawServerUrl = config.get<unknown>("debugProxy.serverUrl")
	const serverUrl = typeof rawServerUrl === "string" && rawServerUrl.trim() ? rawServerUrl.trim() : defaultServerUrl
	const tlsInsecure = Boolean(config.get<unknown>("debugProxy.tlsInsecure"))

	const isDebugMode = proxyState.extensionContext.extensionMode === vscode.ExtensionMode.Development

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

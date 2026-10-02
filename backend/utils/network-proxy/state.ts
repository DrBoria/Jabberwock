/**
 * Structural extension-context view (C-2 purity: no host import). The only host surface the
 * network proxy reads is `extensionMode` (numeric host enum: Development = 1, Production = 3 —
 * compare against the host enum values at call sites, per the v4 host-context convention) and
 * `subscriptions` (disposables to register for the host lifetime).
 */
export interface INetworkProxyContextView {
	readonly extensionMode: number
	readonly subscriptions: Array<{ dispose(): void }>
}

/** Structural output-channel view — the only host surface the proxy writes to is `appendLine`. */
export interface INetworkProxyOutputChannel {
	appendLine(line: string): void
}

export interface NetworkProxyState {
	extensionContext: INetworkProxyContextView | null
	originalFetch: typeof fetch | undefined
	outputChannel: INetworkProxyOutputChannel | null
	loggingEnabled: boolean
	consoleLoggingEnabled: boolean
	tlsVerificationOverridden: boolean
	originalNodeTlsRejectUnauthorized: string | undefined
	proxyInitialized: boolean
	undiciProxyInitialized: boolean
	fetchPatched: boolean
}

export const proxyState: NetworkProxyState = {
	extensionContext: null,
	originalFetch: undefined,
	outputChannel: null,
	loggingEnabled: false,
	consoleLoggingEnabled: false,
	tlsVerificationOverridden: false,
	originalNodeTlsRejectUnauthorized: undefined,
	proxyInitialized: false,
	undiciProxyInitialized: false,
	fetchPatched: false,
}

export function log(message: string): void {
	if (!proxyState.loggingEnabled) {
		return
	}

	const logMessage = `[NetworkProxy] ${message}`
	if (proxyState.outputChannel) {
		proxyState.outputChannel.appendLine(logMessage)
	}
	if (proxyState.consoleLoggingEnabled) {
		console.log(logMessage)
	}
}

import * as vscode from "vscode"

export interface NetworkProxyState {
	extensionContext: vscode.ExtensionContext | null
	originalFetch: typeof fetch | undefined
	outputChannel: vscode.OutputChannel | null
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

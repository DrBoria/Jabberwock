import * as vscode from "vscode"

import { Package } from "@shared/package"
import { ProxyConfig } from "./networkProxy.types"
import { proxyState, log } from "./networkProxy.state"
import { redactProxyUrl } from "./networkProxy.utils"
import {
	getProxyConfig,
	applyTlsVerificationOverride,
	restoreGlobalFetchPatch,
	restoreTlsVerificationOverride,
} from "./networkProxy.config"
import { configureGlobalProxy, configureUndiciProxy } from "./networkProxy.setup"

export type { ProxyConfig }

export async function initializeNetworkProxy(
	context: vscode.ExtensionContext,
	channel?: vscode.OutputChannel,
): Promise<void> {
	proxyState.extensionContext = context

	const isDebugMode = context.extensionMode === vscode.ExtensionMode.Development
	if (!isDebugMode) {
		return
	}

	proxyState.outputChannel = channel ?? null
	proxyState.loggingEnabled = true
	proxyState.consoleLoggingEnabled = !proxyState.outputChannel

	const config = getProxyConfig()

	log(`Initializing network proxy module...`)
	log(
		`Proxy config: enabled=${config.enabled}, serverUrl=${redactProxyUrl(config.serverUrl)}, tlsInsecure=${config.tlsInsecure}`,
	)

	if (typeof vscode.workspace.onDidChangeConfiguration === "function") {
		context.subscriptions.push(
			vscode.workspace.onDidChangeConfiguration((e) => {
				if (
					e.affectsConfiguration(`${Package.name}.debugProxy.enabled`) ||
					e.affectsConfiguration(`${Package.name}.debugProxy.serverUrl`) ||
					e.affectsConfiguration(`${Package.name}.debugProxy.tlsInsecure`)
				) {
					const newConfig = getProxyConfig()

					if (newConfig.enabled) {
						applyTlsVerificationOverride(newConfig)
						configureGlobalProxy(newConfig)
						configureUndiciProxy(newConfig)
					} else {
						restoreGlobalFetchPatch()
						restoreTlsVerificationOverride()
						log("Debug proxy disabled. Restart VS Code to fully disable proxy routing.")
					}
				}
			}),
		)
	}

	context.subscriptions.push({
		dispose: () => {
			restoreGlobalFetchPatch()
			restoreTlsVerificationOverride()
		},
	})

	if (config.enabled) {
		applyTlsVerificationOverride(config)
		await configureGlobalProxy(config)
		await configureUndiciProxy(config)
	} else {
		log(`Debug proxy not enabled.`)
	}
}

export function isProxyEnabled(): boolean {
	const config = getProxyConfig()
	return config.enabled && config.isDebugMode
}

export function isDebugMode(): boolean {
	if (!proxyState.extensionContext) {
		return false
	}
	return proxyState.extensionContext.extensionMode === vscode.ExtensionMode.Development
}

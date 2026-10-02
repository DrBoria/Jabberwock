import { Package } from "@shared/core/package"
import { getBackendCapabilities } from "@features/foundation/capabilities"
import { ProxyConfig } from "./types"
import { proxyState, log, type INetworkProxyContextView, type INetworkProxyOutputChannel } from "./state"
import { redactProxyUrl } from "./utils"
import {
	getProxyConfig,
	applyTlsVerificationOverride,
	restoreGlobalFetchPatch,
	restoreTlsVerificationOverride,
} from "./config"
import { configureGlobalProxy, configureUndiciProxy } from "./setup"

export type { ProxyConfig }

/** Host extension-mode enum value: Development (numeric comparison per the v4 host-context convention). */
const EXTENSION_MODE_DEVELOPMENT = 1

/**
 * Subscribe to debugProxy config changes through the capability slot (D4b-2, C-2 purity).
 * Server mode has no config-change slot — the subscription degrades to a no-op and the
 * current config is read on demand instead.
 */
function subscribeToConfigChanges(): { dispose(): void } {
	const onDidChange = getBackendCapabilities().config.onDidChange
	if (!onDidChange) {
		return { dispose() {} }
	}
	return onDidChange((e) => {
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
	})
}

export async function initializeNetworkProxy(
	context: INetworkProxyContextView,
	channel?: INetworkProxyOutputChannel,
): Promise<void> {
	proxyState.extensionContext = context

	const isDebugMode = context.extensionMode === EXTENSION_MODE_DEVELOPMENT
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

	context.subscriptions.push(subscribeToConfigChanges())

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
	return proxyState.extensionContext.extensionMode === EXTENSION_MODE_DEVELOPMENT
}

import { ProxyAgent, setGlobalDispatcher, fetch as undiciFetch } from "undici"
import { bootstrap } from "global-agent"

import { ProxyConfig } from "./networkProxy.types"
import { proxyState, log } from "./networkProxy.state"
import { redactProxyUrl, normalizeHeadersForUndici, updateProxyEnvVars } from "./networkProxy.utils"
import { restoreGlobalFetchPatch } from "./networkProxy.config"

export async function configureGlobalProxy(config: ProxyConfig): Promise<void> {
	if (proxyState.proxyInitialized) {
		log(`Proxy already initialized, updating env vars only`)
		updateProxyEnvVars(config)
		return
	}

	log(`Setting proxy environment variables before bootstrap (values redacted)...`)
	updateProxyEnvVars(config)

	let bootstrapFn: (() => void) | undefined
	try {
		bootstrapFn = bootstrap
	} catch (error) {
		log(
			`Failed to load global-agent (proxy support is only available in debug/dev builds): ${error instanceof Error ? error.message : String(error)}`,
		)
		return
	}

	log(`Calling global-agent bootstrap()...`)
	try {
		bootstrapFn()
		proxyState.proxyInitialized = true
		log(`global-agent bootstrap() completed successfully`)
	} catch (error) {
		log(`global-agent bootstrap() FAILED: ${error instanceof Error ? error.message : String(error)}`)
		return
	}

	log(`Network proxy configured: ${redactProxyUrl(config.serverUrl)}`)
}

export function patchGlobalFetch(): void {
	if (proxyState.fetchPatched) {
		return
	}

	if (typeof globalThis.fetch === "function") {
		proxyState.originalFetch = globalThis.fetch
	}

	const patchedFetch: typeof globalThis.fetch = async (input, init) => {
		const url = input instanceof Request ? input.url : input
		const { headers: domHeadersInit, body: _domBody, ...restInit } = init ?? {}
		const undiciInit: import("undici").RequestInit = {
			...restInit,
			...(domHeadersInit ? { headers: normalizeHeadersForUndici(domHeadersInit) } : {}),
		}
		const undiciRes = await undiciFetch(url, undiciInit)
		const body = await undiciRes.arrayBuffer()
		return new Response(body, {
			status: undiciRes.status,
			statusText: undiciRes.statusText,
			headers: Object.fromEntries(undiciRes.headers.entries()),
		})
	}
	globalThis.fetch = patchedFetch
	proxyState.fetchPatched = true
	log(`globalThis.fetch patched to undici.fetch (debug proxy mode)`)

	if (proxyState.extensionContext) {
		proxyState.extensionContext.subscriptions.push({
			dispose: () => restoreGlobalFetchPatch(),
		})
	}
}

export async function configureUndiciProxy(config: ProxyConfig): Promise<void> {
	if (!config.enabled || !config.serverUrl) {
		return
	}

	if (proxyState.undiciProxyInitialized) {
		log(`undici global dispatcher already configured; restart VS Code to change proxy safely`)
		return
	}

	try {
		const proxyAgent = new ProxyAgent({
			uri: config.serverUrl,
			requestTls: config.tlsInsecure
				? ({ rejectUnauthorized: false } satisfies import("tls").ConnectionOptions)
				: undefined,
			proxyTls: config.tlsInsecure
				? ({ rejectUnauthorized: false } satisfies import("tls").ConnectionOptions)
				: undefined,
		})
		setGlobalDispatcher(proxyAgent)
		proxyState.undiciProxyInitialized = true
		log(`undici global dispatcher configured for proxy: ${redactProxyUrl(config.serverUrl)}`)

		patchGlobalFetch()
	} catch (error) {
		log(`Failed to configure undici proxy dispatcher: ${error instanceof Error ? error.message : String(error)}`)
	}
}

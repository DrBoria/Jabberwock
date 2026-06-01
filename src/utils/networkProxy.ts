/**
 * Network Proxy Configuration Module
 *
 * Provides proxy configuration for all outbound HTTP/HTTPS requests from the Jabberwock extension.
 * When running in debug mode (F5), a proxy can be enabled for outbound traffic.
 * Optionally, TLS certificate verification can be disabled (debug only) to allow
 * MITM proxy inspection.
 *
 * Uses global-agent to globally route all HTTP/HTTPS traffic through the proxy,
 * which works with axios, fetch, and most SDKs that use native Node.js http/https.
 */

import * as vscode from "vscode"
import { Package } from "../shared/package"
import { bootstrap } from "global-agent"
import { ProxyAgent, setGlobalDispatcher, fetch as undiciFetch } from "undici"

/**
 * Proxy configuration state
 */
export interface ProxyConfig {
	/** Whether the debug proxy is enabled */
	enabled: boolean
	/** The proxy server URL (e.g., http://127.0.0.1:8888) */
	serverUrl: string
	/** Accept self-signed/insecure TLS certificates from the proxy (required for MITM) */
	tlsInsecure: boolean
	/** Whether running in debug/development mode */
	isDebugMode: boolean
}

let extensionContext: vscode.ExtensionContext | null = null
let originalFetch: typeof fetch | undefined
let outputChannel: vscode.OutputChannel | null = null

let loggingEnabled = false
let consoleLoggingEnabled = false

let tlsVerificationOverridden = false
let originalNodeTlsRejectUnauthorized: string | undefined

// ─── Module-level one-time init guards ─────────────────────────────────────
let _proxyInitialized = false
let _undiciProxyInitialized = false
let _fetchPatched = false

function redactProxyUrl(proxyUrl: string | undefined): string {
	if (!proxyUrl) {
		return "(not set)"
	}

	try {
		const url = new URL(proxyUrl)
		url.username = ""
		url.password = ""
		return url.toString()
	} catch {
		// Fallback for invalid URLs: redact basic auth if present.
		return proxyUrl.replace(/\/\/[^@/]+@/g, "//REDACTED@")
	}
}

function restoreGlobalFetchPatch(): void {
	if (!_fetchPatched) {
		return
	}

	if (originalFetch) {
		globalThis.fetch = originalFetch
	}

	_fetchPatched = false
	originalFetch = undefined
}

function restoreTlsVerificationOverride(): void {
	if (!tlsVerificationOverridden) {
		return
	}

	if (typeof originalNodeTlsRejectUnauthorized === "string") {
		process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalNodeTlsRejectUnauthorized
	} else {
		delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
	}

	tlsVerificationOverridden = false
	originalNodeTlsRejectUnauthorized = undefined
}

function applyTlsVerificationOverride(config: ProxyConfig): void {
	// Only relevant in debug mode with an active proxy.
	if (!config.isDebugMode || !config.enabled) {
		restoreTlsVerificationOverride()
		return
	}

	if (!config.tlsInsecure) {
		restoreTlsVerificationOverride()
		return
	}

	if (!tlsVerificationOverridden) {
		originalNodeTlsRejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED
	}

	// CodeQL: debug-only opt-in for MITM debugging.
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0" // lgtm[js/disabling-certificate-validation]
	tlsVerificationOverridden = true
}

/**
 * Initialize the network proxy module with the extension context.
 * Must be called early in extension activation before any network requests.
 *
 * @param context The VS Code extension context
 * @param channel Optional output channel for logging
 */
export async function initializeNetworkProxy(
	context: vscode.ExtensionContext,
	channel?: vscode.OutputChannel,
): Promise<void> {
	extensionContext = context

	// extensionMode is immutable for the process lifetime - exit early if not in debug mode.
	// This avoids any overhead (listeners, logging, etc.) in production.
	const isDebugMode = context.extensionMode === vscode.ExtensionMode.Development
	if (!isDebugMode) {
		return
	}

	outputChannel = channel ?? null
	loggingEnabled = true
	consoleLoggingEnabled = !outputChannel

	const config = getProxyConfig()

	log(`Initializing network proxy module...`)
	log(
		`Proxy config: enabled=${config.enabled}, serverUrl=${redactProxyUrl(config.serverUrl)}, tlsInsecure=${config.tlsInsecure}`,
	)

	// Listen for configuration changes to allow toggling proxy during a debug session.
	// Guard for test environments where onDidChangeConfiguration may not be mocked.
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
						// Proxy disabled - but we can't easily un-bootstrap global-agent or reset undici dispatcher safely.
						// We *can* restore any global fetch patch immediately.
						restoreGlobalFetchPatch()
						restoreTlsVerificationOverride()
						log("Debug proxy disabled. Restart VS Code to fully disable proxy routing.")
					}
				}
			}),
		)
	}

	// Ensure we restore any overrides when the extension unloads.
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

/**
 * Get the current proxy configuration based on VS Code settings and extension mode.
 */
export function getProxyConfig(): ProxyConfig {
	const defaultServerUrl = "http://127.0.0.1:8888"

	if (!extensionContext) {
		// Fallback if called before initialization
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

	// Debug mode only.
	const isDebugMode = extensionContext.extensionMode === vscode.ExtensionMode.Development

	return {
		enabled,
		serverUrl,
		tlsInsecure,
		isDebugMode,
	}
}

/**
 * Configure global-agent to route all HTTP/HTTPS traffic through the proxy.
 */
async function configureGlobalProxy(config: ProxyConfig): Promise<void> {
	if (_proxyInitialized) {
		// global-agent can only be bootstrapped once
		// Update environment variables for any new connections
		log(`Proxy already initialized, updating env vars only`)
		updateProxyEnvVars(config)
		return
	}

	// Set up environment variables before bootstrapping
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

	// Bootstrap global-agent to intercept all HTTP/HTTPS requests
	log(`Calling global-agent bootstrap()...`)
	try {
		bootstrapFn()
		_proxyInitialized = true
		log(`global-agent bootstrap() completed successfully`)
	} catch (error) {
		log(`global-agent bootstrap() FAILED: ${error instanceof Error ? error.message : String(error)}`)
		return
	}

	log(`Network proxy configured: ${redactProxyUrl(config.serverUrl)}`)
}

/**
 * Configure undici's global dispatcher so Node's built-in `fetch()` and any undici-based
 * clients route through the proxy.
 */
/**
 * Normalize DOM HeadersInit to a plain Record<string, string> for undici compatibility.
 * DOM Headers type is not assignable to undici's HeadersInit (Record<string, string | readonly string[]>),
 * and undici v6 rejects Headers instances at the type level.
 */
function normalizeHeadersForUndici(headers?: HeadersInit): Record<string, string> | undefined {
	if (!headers) return undefined
	const h = new Headers(headers)
	const result: Record<string, string> = {}
	h.forEach((value, key) => {
		result[key] = value
	})
	return result
}

async function configureUndiciProxy(config: ProxyConfig): Promise<void> {
	if (!config.enabled || !config.serverUrl) {
		return
	}

	if (_undiciProxyInitialized) {
		log(`undici global dispatcher already configured; restart VS Code to change proxy safely`)
		return
	}

	try {
		const proxyAgent = new ProxyAgent({
			uri: config.serverUrl,
			// If the user enabled TLS insecure mode (debug only), apply it to undici.
			requestTls: config.tlsInsecure
				? ({ rejectUnauthorized: false } satisfies import("tls").ConnectionOptions) // lgtm[js/disabling-certificate-validation]
				: undefined,
			proxyTls: config.tlsInsecure
				? ({ rejectUnauthorized: false } satisfies import("tls").ConnectionOptions) // lgtm[js/disabling-certificate-validation]
				: undefined,
		})
		setGlobalDispatcher(proxyAgent)
		_undiciProxyInitialized = true
		log(`undici global dispatcher configured for proxy: ${redactProxyUrl(config.serverUrl)}`)

		// Node's built-in `fetch()` (Node 18+) is powered by an internal undici copy.
		// Setting a dispatcher on our `undici` dependency does NOT affect that internal fetch.
		// To ensure Jabberwock's `fetch()` calls are proxied, patch global fetch in debug mode.
		// This patch is scoped to the extension lifecycle (restored on deactivate) and can be restored
		// immediately if the proxy is disabled.
		if (!_fetchPatched) {
			if (typeof globalThis.fetch === "function") {
				originalFetch = globalThis.fetch
			}

			const patchedFetch: typeof globalThis.fetch = async (input, init) => {
				// Normalize input to string | URL to avoid undici v6 Request type conflicts
				const url = input instanceof Request ? input.url : input
				// Destructure headers + body to avoid DOM-vs-undici type incompatibilities:
				// DOM BodyInit includes ReadableStream<any> which undici v6 rejects,
				// and DOM HeadersInit includes the Headers class which undici v6 rejects.
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
			_fetchPatched = true
			log(`globalThis.fetch patched to undici.fetch (debug proxy mode)`)

			if (extensionContext) {
				extensionContext.subscriptions.push({
					dispose: () => restoreGlobalFetchPatch(),
				})
			}
		}
	} catch (error) {
		log(`Failed to configure undici proxy dispatcher: ${error instanceof Error ? error.message : String(error)}`)
	}
}
/**
 * Update environment variables for proxy configuration.
 * global-agent reads from GLOBAL_AGENT_* environment variables.
 */
function updateProxyEnvVars(config: ProxyConfig): void {
	if (config.serverUrl) {
		// Model metadata API hosts that MUST bypass the proxy.
		// These APIs are for model discovery, not LLM inference, and proxy interception
		// typically returns HTML block pages that break Zod validation.
		const bypassHosts = [
			"openrouter.ai",
			"*.openrouter.ai",
			"ai-gateway.vercel.sh",
			"*.ai-gateway.vercel.sh",
			"api.getunbound.ai",
			"*.api.getunbound.ai",
		]

		// global-agent uses these environment variables
		process.env.GLOBAL_AGENT_HTTP_PROXY = config.serverUrl
		process.env.GLOBAL_AGENT_HTTPS_PROXY = config.serverUrl
		process.env.GLOBAL_AGENT_NO_PROXY = bypassHosts.join(",")

		// Also set NO_PROXY for OS-level proxy variables (corporate tools like Zscaler)
		const existingNoProxy = process.env.NO_PROXY || ""
		const noProxyEntries = existingNoProxy ? existingNoProxy.split(",").map((s) => s.trim()) : []
		for (const host of bypassHosts) {
			if (!noProxyEntries.includes(host)) {
				noProxyEntries.push(host)
			}
		}
		process.env.NO_PROXY = noProxyEntries.join(",")
	}
}

/**
 * Check if a proxy is currently configured and active.
 */
export function isProxyEnabled(): boolean {
	const config = getProxyConfig()
	// Active proxy is only applied in debug mode.
	return config.enabled && config.isDebugMode
}

/**
 * Check if we're running in debug mode.
 */
export function isDebugMode(): boolean {
	if (!extensionContext) {
		return false
	}
	return extensionContext.extensionMode === vscode.ExtensionMode.Development
}

/**
 * Log a message to the output channel if available.
 */
function log(message: string): void {
	if (!loggingEnabled) {
		return
	}

	const logMessage = `[NetworkProxy] ${message}`
	if (outputChannel) {
		outputChannel.appendLine(logMessage)
	}
	if (consoleLoggingEnabled) {
		console.log(logMessage)
	}
}

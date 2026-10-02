// v4 B2 (L14): structural context view instead of the host ExtensionContext — callers pass either a real
// host context or the facade's synthesized view; both satisfy IExtensionContextView structurally.
import type { IExtensionContextView } from "@features/foundation/host-context/context"

import { McpHub } from "./McpHub"
import { ProviderHandle } from "@features/foundation/webview"
import { sendMcpServerEvent } from "@services/mcp/events/actions/sendMcpServerEvent"

/**
 * Singleton manager for MCP server instances.
 * Ensures only one set of MCP servers runs across all webviews.
 */
const GLOBAL_STATE_KEY = "mcpHubInstanceId"

export function McpServerManager() {
	let _mcpHub: McpHub | null = null
	const providers: Set<ProviderHandle> = new Set()
	let _initializationPromise: Promise<McpHub> | null = null

	/**
	 * Get (or create) the singleton McpHub instance.
	 * Registers the provider for notifications.
	 */
	// v4 B2 (L14): widened to the structural view — only `globalState.update` is used below.
	async function getInstance(context: IExtensionContextView, provider: ProviderHandle): Promise<McpHub> {
		// Register the provider
		providers.add(provider)

		// If we already have an instance, return it
		if (_mcpHub) {
			return _mcpHub
		}

		// If initialization is in progress, wait for it
		if (_initializationPromise) {
			return _initializationPromise
		}

		// Create a new initialization promise
		_initializationPromise = (async () => {
			try {
				// Double-check instance in case it was created while we were waiting
				if (!_mcpHub) {
					const hub = McpHub(provider, context)
					// Wait for all MCP servers to finish connecting (or timing out)
					await hub.waitUntilReady()
					_mcpHub = hub
					// Store a unique identifier in global state to track the primary instance
					await context.globalState.update(GLOBAL_STATE_KEY, Date.now().toString())
				}
				return _mcpHub
			} finally {
				// Clear the initialization promise after completion or error
				_initializationPromise = null
			}
		})()

		return _initializationPromise
	}

	/**
	 * Get the underlying McpHub instance (only if already initialized).
	 */
	function getMcpHub(): McpHub | null {
		return _mcpHub
	}

	/**
	 * Remove a provider from "the" tracked set.
	 * This is called when a webview is disposed.
	 */
	function unregisterProvider(provider: ProviderHandle): void {
		providers.delete(provider)
	}

	/**
	 * Notify all registered providers of server state changes.
	 */
	function notifyProviders(message: { type: string; [key: string]: unknown }): void {
		providers.forEach((provider) => {
			sendMcpServerEvent(provider, message).catch((error) => {
				console.error("[jabberwock] Failed to notify provider:", error)
			})
		})
	}

	/**
	 * Clean up the instance and all its resources.
	 */
	// v4 B2 (L14): widened to the structural view — only `globalState.update` is used below.
	async function cleanup(context: IExtensionContextView): Promise<void> {
		if (_mcpHub) {
			await _mcpHub.dispose()
			_mcpHub = null
			await context.globalState.update(GLOBAL_STATE_KEY, undefined)
		}
		providers.clear()
	}

	return { getInstance, getMcpHub, unregisterProvider, notifyProviders, cleanup }
}

export type McpServerManager = ReturnType<typeof McpServerManager>

// ── Module-level accessor functions ──────────────────────────────────────

const __moduleState = {
	_globalMcpServerManager: null as McpServerManager | null,
}
export function createMcpServerManager(): McpServerManager {
	if (__moduleState._globalMcpServerManager) {
		throw new Error("McpServerManager instance already created")
	}
	__moduleState._globalMcpServerManager = McpServerManager()
	return __moduleState._globalMcpServerManager
}

export function getMcpServerManager(): McpServerManager {
	if (!__moduleState._globalMcpServerManager) {
		throw new Error("McpServerManager not initialized")
	}
	return __moduleState._globalMcpServerManager
}

export function hasMcpServerManager(): boolean {
	return __moduleState._globalMcpServerManager !== null
}

export function resetMcpServerManager(): void {
	__moduleState._globalMcpServerManager = null
}

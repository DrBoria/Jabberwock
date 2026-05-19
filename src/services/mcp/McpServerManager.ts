import * as vscode from "vscode"
import { McpHub } from "./McpHub"
import { EventBridge } from "../../core/webview/EventBridge"

/**
 * Singleton manager for MCP server instances.
 * Ensures only one set of MCP servers runs across all webviews.
 */
export class McpServerManager {
	private static readonly GLOBAL_STATE_KEY = "mcpHubInstanceId"

	private _mcpHub: McpHub | null = null
	private providers: Set<EventBridge> = new Set()
	private _initializationPromise: Promise<McpHub> | null = null

	/**
	 * Get (or create) the singleton McpHub instance.
	 * Registers the provider for notifications.
	 */
	async getInstance(context: vscode.ExtensionContext, provider: EventBridge): Promise<McpHub> {
		// Register the provider
		this.providers.add(provider)

		// If we already have an instance, return it
		if (this._mcpHub) {
			return this._mcpHub
		}

		// If initialization is in progress, wait for it
		if (this._initializationPromise) {
			return this._initializationPromise
		}

		// Create a new initialization promise
		this._initializationPromise = (async () => {
			try {
				// Double-check instance in case it was created while we were waiting
				if (!this._mcpHub) {
					const hub = new McpHub(provider)
					// Wait for all MCP servers to finish connecting (or timing out)
					await hub.waitUntilReady()
					this._mcpHub = hub
					// Store a unique identifier in global state to track the primary instance
					await context.globalState.update(McpServerManager.GLOBAL_STATE_KEY, Date.now().toString())
				}
				return this._mcpHub
			} finally {
				// Clear the initialization promise after completion or error
				this._initializationPromise = null
			}
		})()

		return this._initializationPromise
	}

	/**
	 * Get the underlying McpHub instance (only if already initialized).
	 */
	getMcpHub(): McpHub | null {
		return this._mcpHub
	}

	/**
	 * Remove a provider from the tracked set.
	 * This is called when a webview is disposed.
	 */
	unregisterProvider(provider: EventBridge): void {
		this.providers.delete(provider)
	}

	/**
	 * Notify all registered providers of server state changes.
	 */
	notifyProviders(message: Record<string, unknown>): void {
		this.providers.forEach((provider) => {
			provider.postMessageToWebview(message as never).catch((error) => {
				console.error("Failed to notify provider:", error)
			})
		})
	}

	/**
	 * Clean up the instance and all its resources.
	 */
	async cleanup(context: vscode.ExtensionContext): Promise<void> {
		if (this._mcpHub) {
			await this._mcpHub.dispose()
			this._mcpHub = null
			await context.globalState.update(McpServerManager.GLOBAL_STATE_KEY, undefined)
		}
		this.providers.clear()
	}
}

// ── Module-level accessor functions ──────────────────────────────────────

let _globalMcpServerManager: McpServerManager | null = null

export function createMcpServerManager(): McpServerManager {
	if (_globalMcpServerManager) {
		throw new Error("McpServerManager instance already created")
	}
	_globalMcpServerManager = new McpServerManager()
	return _globalMcpServerManager
}

export function getMcpServerManager(): McpServerManager {
	if (!_globalMcpServerManager) {
		throw new Error("McpServerManager not initialized")
	}
	return _globalMcpServerManager
}

export function hasMcpServerManager(): boolean {
	return _globalMcpServerManager !== null
}

export function resetMcpServerManager(): void {
	_globalMcpServerManager = null
}

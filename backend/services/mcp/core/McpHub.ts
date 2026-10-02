// v4 B2 (L14): protocol + structural types only — no host imports in the hub core.
import type { DisposableLike, IFileWatcher } from "@jabberwock/types"
import type { ProviderHandle } from "@features/foundation/webview"
import type { IExtensionContextView } from "@features/foundation/host-context/context"
import type { McpConnection, McpHubState } from "./types"

import { getMcpSettingsFilePath as getMcpSettingsFilePathHelper } from "@services/mcp/config"
import { updateServerConnections } from "@services/mcp/mcp-hub/server"
import { deleteConnection } from "@services/mcp/mcp-hub/connection"
import { notifyWebviewOfServerChanges } from "@services/mcp/mcp-hub/notifications"
import { setupWatchers, initializeAllServers, getProjectMcpPath, type HubDeps } from "@services/mcp/mcp-hub/init"
import { disposeHub } from "@services/mcp/mcp-hub/disposal"
import { createHubMethods } from "@services/mcp/mcp-hub/hub-methods"

export function McpHub(provider: ProviderHandle, context: IExtensionContextView) {
	const providerRef = new WeakRef(provider)
	let connections: import("./types").McpConnection[] = []
	let isConnecting: boolean = false

	// v4 B2 (L14): structural types — the host context satisfies IExtensionContextView structurally.
	const _context: IExtensionContextView = context
	const disposables: DisposableLike[] = []
	let settingsWatcher: IFileWatcher | undefined
	const fileWatchers: Map<string, import("chokidar").FSWatcher[]> = new Map()
	let projectMcpWatcher: IFileWatcher | undefined
	let isDisposed: boolean = false
	let refCount: number = 0
	const configChangeDebounceTimers: Map<string, NodeJS.Timeout> = new Map()
	let isProgrammaticUpdate: boolean = false
	let flagResetTimer: NodeJS.Timeout | undefined
	const sanitizedNameRegistry: Map<string, string> = new Map()

	// Minimal event emitter (replaces `extends EventEmitter`): the hub only
	// ever emits "interactiveUiRequested" and consumers use on/listenerCount.
	const listeners = new Map<string, Set<(data: unknown) => void>>()
	function on(event: string, fn: (data: never) => void): void {
		const handler = fn as (data: unknown) => void
		let set = listeners.get(event)
		if (!set) {
			set = new Set()
			listeners.set(event, set)
		}
		set.add(handler)
	}
	function listenerCount(event: string): number {
		return listeners.get(event)?.size ?? 0
	}
	function emit(event: string, data: unknown): void {
		listeners.get(event)?.forEach((fn) => {
			try {
				fn(data)
			} catch (error) {
				console.error(`[jabberwock] McpHub listener error on "${event}":`, error)
			}
		})
	}

	// Live state object (mirrors the former `get s()` getter): helpers mutate
	// `state.connections` / `state.isConnecting` and the hub must observe it.
	const state: McpHubState = {
		get connections() {
			return connections
		},
		set connections(value: McpConnection[]) {
			connections = value
		},
		get isConnecting() {
			return isConnecting
		},
		set isConnecting(value: boolean) {
			isConnecting = value
			if (!value && flagResetTimer) {
				clearTimeout(flagResetTimer)
				flagResetTimer = undefined
			}
		},
		get isProgrammaticUpdate() {
			return isProgrammaticUpdate
		},
		set isProgrammaticUpdate(value: boolean) {
			isProgrammaticUpdate = value
			if (!value && flagResetTimer) {
				clearTimeout(flagResetTimer)
				flagResetTimer = undefined
			}
		},
		get flagResetTimer() {
			return flagResetTimer
		},
		set flagResetTimer(value: NodeJS.Timeout | undefined) {
			if (flagResetTimer) {
				clearTimeout(flagResetTimer)
			}
			flagResetTimer = value
		},
		sanitizedNameRegistry,
		providerRef,
		fileWatchers,
		_context,
		configChangeDebounceTimers,
		get isDisposed() {
			return isDisposed
		},
		get refCount() {
			return refCount
		},
		disposables,
		notify: emit,
	}
	function s(): McpHubState {
		return state
	}

	function hubDeps(): HubDeps {
		return {
			buildState: () => s(),
			getMcpSettingsFilePath: () => getMcpSettingsFilePath(),
			getProjectMcpPath: () => getProjectMcpPath(),

			notifyWebviewOfServerChanges: () => notifyWebview(),
			deleteConnection: (name, source) => deleteConnection(s(), name, source),
			updateServerConnections: (servers, source, manageState) =>
				updateServerConnections(s(), servers, source, manageState, () => getMcpSettingsFilePath()),
			configChangeDebounceTimers,
		}
	}

	// v4 B2 (L14): structural view — real host contexts satisfy it structurally.
	const initializationPromise = (async () => {
		await setupWatchers(hubDeps())
		await initializeAllServers(hubDeps())
	})()

	async function waitUntilReady(): Promise<void> {
		await initializationPromise
	}

	function registerClient(): void {
		refCount++
	}

	async function unregisterClient(): Promise<void> {
		refCount--
		if (refCount <= 0) {
			console.log("McpHub: Last client unregistered. Disposing hub.")
			await dispose()
		}
	}

	function getMcpSettingsFilePath(): Promise<string> {
		return getMcpSettingsFilePathHelper(_context)
	}

	function notifyWebview(): Promise<void> {
		return notifyWebviewOfServerChanges(s(), () => getMcpSettingsFilePath(), getProjectMcpPath)
	}

	const hubMethods = createHubMethods({
		s,
		providerRef,
		context: _context,
		sanitizedNameRegistry,
		getMcpSettingsFilePath,
		notifyWebview,
		hubDeps,
	})

	async function dispose(): Promise<void> {
		if (isDisposed) return
		isDisposed = true
		isProgrammaticUpdate = false

		await disposeHub(
			s(),
			state.connections,
			settingsWatcher,
			projectMcpWatcher,
			disposables,
			configChangeDebounceTimers,
			flagResetTimer,
		)

		state.connections = []
		settingsWatcher = undefined
		projectMcpWatcher = undefined
	}

	return {
		providerRef,
		get connections() {
			return connections
		},
		set connections(v: import("./types").McpConnection[]) {
			connections = v
		},
		get isConnecting() {
			return isConnecting
		},
		set isConnecting(v: boolean) {
			isConnecting = v
		},
		on,
		listenerCount,
		emit,
		waitUntilReady,
		registerClient,
		unregisterClient,
		getMcpSettingsFilePath,
		...hubMethods,
		dispose,
	}
}

export type McpHub = ReturnType<typeof McpHub>

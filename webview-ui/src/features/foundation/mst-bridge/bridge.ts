import { applySnapshot, IStateTreeNode } from "mobx-state-tree"

/**
 * Connection state for the webview-side MST bridge.
 */
export type BridgeConnectionState = "connected" | "disconnected" | "reconnecting"

/**
 * A snapshot batch received from the extension.
 */
export interface SnapshotBatch {
	snapshots: Array<{
		storeName: string
		snapshot: Record<string, unknown>
	}>
}

/**
 * Webview-side MST bridge.
 *
 * Receives snapshot messages from the extension and applies them
 * to the corresponding webview MST stores via `applySnapshot`.
 */
export class MstBridge {
	private storeRegistry: Map<string, IStateTreeNode> = new Map()
	private connectionState: BridgeConnectionState = "disconnected"
	private onStateChange: ((state: BridgeConnectionState) => void) | null = null

	/**
	 * Register a webview MST store to receive snapshots for.
	 */
	registerStore(storeName: string, store: IStateTreeNode): void {
		this.storeRegistry.set(storeName, store)
	}

	/**
	 * Unregister a previously registered store.
	 */
	unregisterStore(storeName: string): void {
		this.storeRegistry.delete(storeName)
	}

	/**
	 * Handle an incoming snapshot batch message from the extension.
	 */
	handleSnapshotBatch(batch: SnapshotBatch): void {
		for (const { storeName, snapshot } of batch.snapshots) {
			const store = this.storeRegistry.get(storeName)
			if (store) {
				try {
					applySnapshot(store, snapshot)
				} catch (err) {
					console.error(`[MstBridge] Failed to apply snapshot for "${storeName}":`, err)
				}
			}
		}
	}

	/**
	 * Handle a single snapshot message (non-batched).
	 */
	handleSnapshot(storeName: string, snapshot: Record<string, unknown>): void {
		const store = this.storeRegistry.get(storeName)
		if (store) {
			try {
				applySnapshot(store, snapshot)
			} catch (err) {
				console.error(`[MstBridge] Failed to apply snapshot for "${storeName}":`, err)
			}
		}
	}

	/**
	 * Set the connection state and notify listeners.
	 */
	setConnectionState(state: BridgeConnectionState): void {
		this.connectionState = state
		this.onStateChange?.(state)
	}

	/**
	 * Get the current connection state.
	 */
	getConnectionState(): BridgeConnectionState {
		return this.connectionState
	}

	/**
	 * Register a callback for connection state changes.
	 */
	onConnectionStateChange(callback: (state: BridgeConnectionState) => void): void {
		this.onStateChange = callback
	}

	/**
	 * Remove the connection state change listener.
	 */
	removeConnectionStateChange(): void {
		this.onStateChange = null
	}

	/**
	 * Check if a specific store is registered.
	 */
	hasStore(storeName: string): boolean {
		return this.storeRegistry.has(storeName)
	}

	/**
	 * Get a registered store by name.
	 */
	getStore<T = unknown>(id: string): T | undefined {
		return this.storeRegistry.get(id) as T | undefined
	}

	/**
	 * Get the list of registered store names.
	 */
	getRegisteredStores(): string[] {
		return [...this.storeRegistry.keys()]
	}

	/**
	 * Clear all registered stores and reset state.
	 */
	dispose(): void {
		this.storeRegistry.clear()
		this.connectionState = "disconnected"
		this.onStateChange = null
	}
}

/**
 * Create a new MstBridge instance.
 */
export function createMstBridge(): MstBridge {
	return new MstBridge()
}

import { applySnapshot, IStateTreeNode } from "mobx-state-tree"

/**
 * Connection state for the webview-side MST bridge.
 */
export type BridgeConnectionState = "connected" | "disconnected" | "reconnecting"

/**
 * A snapshot batch received from "the" extension.
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
 * Receives snapshot messages from "the" extension and applies them
 * to the corresponding webview MST stores via `applySnapshot`.
 */
export interface MstBridge {
	/** Register a webview MST store to receive snapshots for. */
	registerStore(storeName: string, store: IStateTreeNode): void
	/** Unregister a previously registered store. */
	unregisterStore(storeName: string): void
	/** Handle an incoming snapshot batch message from "the" extension. */
	handleSnapshotBatch(batch: SnapshotBatch): void
	/** Handle a single snapshot message (non-batched). */
	handleSnapshot(storeName: string, snapshot: Record<string, unknown>): void
	/** Set the connection state and notify listeners. */
	setConnectionState(state: BridgeConnectionState): void
	/** Get the current connection state. */
	getConnectionState(): BridgeConnectionState
	/** Register a callback for connection state changes. */
	onConnectionStateChange(callback: (state: BridgeConnectionState) => void): void
	/** Remove the connection state change listener. */
	removeConnectionStateChange(): void
	/** Check if a specific store is registered. */
	hasStore(storeName: string): boolean
	/** Get a registered store by name. */
	getStore<T = unknown>(id: string): T | undefined
	/** Get the list of registered store names. */
	getRegisteredStores(): string[]
	/** Clear all registered stores and reset state. */
	dispose(): void
}

/**
 * Create a new MstBridge instance.
 *
 * Factory-closure form (no class): the registry / connection state live in the
 * closure, not module state.
 */
export function createMstBridge(): MstBridge {
	const storeRegistry = new Map<string, IStateTreeNode>()
	let connectionState: BridgeConnectionState = "disconnected"
	let onStateChange: ((state: BridgeConnectionState) => void) | null = null

	function apply(storeName: string, snapshot: Record<string, unknown>): void {
		const store = storeRegistry.get(storeName)
		if (store) {
			try {
				applySnapshot(store, snapshot)
			} catch (err) {
				console.error(`[jabberwock] [MstBridge] Failed to apply snapshot for "${storeName}":`, err)
			}
		}
	}

	return {
		registerStore(storeName: string, store: IStateTreeNode): void {
			storeRegistry.set(storeName, store)
		},

		unregisterStore(storeName: string): void {
			storeRegistry.delete(storeName)
		},

		handleSnapshotBatch(batch: SnapshotBatch): void {
			for (const { storeName, snapshot } of batch.snapshots) {
				apply(storeName, snapshot)
			}
		},

		handleSnapshot(storeName: string, snapshot: Record<string, unknown>): void {
			apply(storeName, snapshot)
		},

		setConnectionState(state: BridgeConnectionState): void {
			connectionState = state
			onStateChange?.(state)
		},

		getConnectionState(): BridgeConnectionState {
			return connectionState
		},

		onConnectionStateChange(callback: (state: BridgeConnectionState) => void): void {
			onStateChange = callback
		},

		removeConnectionStateChange(): void {
			onStateChange = null
		},

		hasStore(storeName: string): boolean {
			return storeRegistry.has(storeName)
		},

		getStore<T = unknown>(id: string): T | undefined {
			return storeRegistry.get(id) as T | undefined
		},

		getRegisteredStores(): string[] {
			return [...storeRegistry.keys()]
		},

		dispose(): void {
			storeRegistry.clear()
			connectionState = "disconnected"
			onStateChange = null
		},
	}
}

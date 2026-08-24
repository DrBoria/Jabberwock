import type { IBackendRootStore } from "@features/store"
import type { IIntentStore } from "./store"

/**
 * Context passed to every intent handler.
 *
 * Carries the root store (for accessing any MST state), the
 * intentStore (for creating new intents in the handler chain),
 * and an optional EventBridge provider reference.
 *
 * The provider is set after the IntentBus starts but before any
 * handler runs — extension.ts calls `bus.setProvider(provider)`
 * after creating the EventBridge instance.
 */
export interface IntentHandlerContext {
	rootStore: IBackendRootStore
	intentStore: IIntentStore
	/** EventBridge provider instance, set after IntentBus initialization. */
	provider?: import("@features/foundation/webview/EventBridge").EventBridge
	/** Fiber scheduler yield — handlers call this at safe preemption points. */
	scheduler?: {
		yield(): Promise<void>
	}
}

import type { IRootStore } from "../root-store"
import type { IIntentStore } from "./store"

/**
 * Context passed to every intent handler.
 *
 * Carries the root store (for accessing any MST state) and the
 * intentStore (for creating new intents in the handler chain).
 */
export interface IntentHandlerContext {
	rootStore: IRootStore
	intentStore: IIntentStore
	/** Fiber scheduler yield — handlers call this at safe preemption points. */
	scheduler?: {
		yield(): Promise<void>
	}
}

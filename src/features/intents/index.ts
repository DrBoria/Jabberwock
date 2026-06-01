import { IntentBus } from "./bus"
import type { IBackendRootStore } from "../store"
import type { IIntentStore } from "./store"

export { IntentBus } from "./bus"
export { IntentStoreModel, IntentModel } from "./store"
export type { IIntentStore, IIntent } from "./store"
export type { IntentHandlerContext } from "./context"

/**
 * Create the IntentBus, start the dispatch reaction, and return the bus
 * ready for handler registration.
 *
 * Must be called AFTER the root store is created (so IntentStore is available).
 * Called from createBackendStore() in src/features/store.ts.
 *
 * Features register their own handlers by importing the bus:
 *
 *   import { registerAllMessageHandlers } from "./chat/task/messages/handlers"
 *   registerAllMessageHandlers(bus)
 */
export function setupIntents(rootStore: IBackendRootStore): {
	bus: IntentBus
	dispose: () => void
} {
	const intentStore: IIntentStore = rootStore.intentStore
	const bus = new IntentBus()
	const ctx = { rootStore, intentStore }

	bus.start(intentStore, ctx)

	return {
		bus,
		dispose: () => bus.stop(),
	}
}

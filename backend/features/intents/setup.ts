import { IntentBus } from "./bus"
import type { IBackendRootStore } from "@features/store"
import type { IIntentStore } from "./store"

/**
 * Create the IntentBus, start the dispatch reaction, and return the bus
 * ready for handler registration.
 *
 * Must be called AFTER the root store is created (so IntentStore is available).
   * Called from createBackendStore() in backend/features/store.ts.
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

	bus.start(intentStore, ctx, rootStore.runHandler.bind(rootStore))

	return {
		bus,
		dispose: () => bus.stop(),
	}
}

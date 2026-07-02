import { IntentBus } from "./bus"
import type { IRootStore } from "../root-store"
import type { IIntentStore } from "./store"
import { registerAllFrontendIntents } from "./registrations"

/**
 * Create the IntentBus, start the dispatch reaction, and return the bus
 * ready for handler registration.
 *
 * Must be called AFTER the root store is created (so IntentStore is available).
 * Called from createRootStore() in root-store.ts.
 *
 * Features register their own handlers by importing the bus:
 *
 *   import { registerAllChatHandlers } from "./chat/handlers"
 *   registerAllChatHandlers(bus)
 */
export function setupIntents(rootStore: IRootStore): {
	bus: IntentBus
	dispose: () => void
} {
	const intentStore: IIntentStore = rootStore.intentStore
	const bus = new IntentBus()
	const ctx = { rootStore, intentStore }

	registerAllFrontendIntents(bus)

	bus.start(intentStore, ctx)

	return {
		bus,
		dispose: () => bus.stop(),
	}
}

import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import { postStateToWebview } from "@features/foundation/window-manager/store"

/**
 * Handles foundation.state.requested intent — posts full state to webview.
 */
export function registerOnStateRequested(bus: IntentBus): void {
	bus.register(IntentType.FoundationStateRequested, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		await postStateToWebview(provider)
	})
}

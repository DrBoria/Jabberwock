import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import { resolveActivePageRequest } from "@features/foundation/window-manager/store"

/**
 * Handles foundation.active.page.response intent — resolves an active page request.
 */
export function registerOnActivePageResponse(bus: IntentBus): void {
	bus.register(IntentType.FoundationActivePageResponse, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { requestId: string; activePage: string }
		if (payload.requestId && payload.activePage) {
			resolveActivePageRequest(provider, payload.requestId, payload.activePage)
		}
	})
}

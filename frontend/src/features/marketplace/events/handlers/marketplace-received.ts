import type { IntentBus } from "../../../intents/bus"
import { IntentConstants } from "@intentConstants"
import type { IntentHandlerContext } from "../../../intents/context"
import { getRootStore } from "../../../root-store"
import type { MarketplaceItem, MarketplaceInstalledMetadata } from "@jabberwock/types"

/**
 * Register all frontend marketplace event handlers on the IntentBus.
 */
export function registerOnFrontendMarketplaceIntents(bus: IntentBus): void {
	bus.register(IntentConstants.marketplace.DATA_RECEIVED, async (intent, _ctx: IntentHandlerContext) => {
		const store = getRootStore()
		const payload = intent.payload as { marketplaceItems?: unknown; marketplaceInstalledMetadata?: unknown }
		if (payload.marketplaceItems !== undefined) {
			store.marketplace.setMarketplaceData(
				payload.marketplaceItems as MarketplaceItem[],
				payload.marketplaceInstalledMetadata as MarketplaceInstalledMetadata | undefined,
			)
		}
	})
}

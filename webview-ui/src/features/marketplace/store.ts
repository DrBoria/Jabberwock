import { types, Instance } from "mobx-state-tree"

/**
 * MarketplaceStore — tracks marketplace data.
 * Receives snapshots from the extension-side MarketplaceStore via MstBridge.
 */
export const MarketplaceStore = types
	.model("MarketplaceStore", {
		marketplaceItems: types.optional(types.array(types.frozen<any>()), []),
		marketplaceInstalledMetadata: types.maybe(types.frozen<any>()),
	})
	.actions((self) => ({
		setMarketplaceData(items: any[], installedMetadata?: any) {
			self.marketplaceItems.replace(items)
			if (installedMetadata !== undefined) {
				self.marketplaceInstalledMetadata = installedMetadata
			}
		},
	}))

export type IMarketplaceStore = Instance<typeof MarketplaceStore>
export const marketplaceStore = MarketplaceStore.create({})

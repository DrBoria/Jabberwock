import type { MarketplaceItem } from "@jabberwock/types"

export interface MarketplaceItemsResponse {
	organizationMcps: MarketplaceItem[]
	marketplaceItems: MarketplaceItem[]
	errors?: string[]
}

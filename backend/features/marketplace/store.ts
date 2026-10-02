import { types, Instance } from "mobx-state-tree"

import type { EventBridge } from "@features/foundation"

import type { IBackendRootStore } from "@features/store"

export const MarketplaceModel = types.model("Marketplace", {})

export type IMarketplaceModel = Instance<typeof MarketplaceModel>

// Backward-compatible types and functions
export type MarketplaceState = object

export function initMarketplaceState(_provider: EventBridge): void {}

export function getMarketplaceState(rootStore: IBackendRootStore): MarketplaceState {
	return rootStore.marketplace as MarketplaceState
}

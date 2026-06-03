import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "@features/foundation/webview/EventBridge"
import { getState } from "@features/storeSingleton"

export const MarketplaceModel = types.model("Marketplace", {})

export type IMarketplaceModel = Instance<typeof MarketplaceModel>

// Backward-compatible types and functions
export type MarketplaceState = object

export function initMarketplaceState(_provider: EventBridge): void {}

import type { IBackendRootStore } from "../store"

export function getMarketplaceState(rootStore: IBackendRootStore): MarketplaceState {
	return rootStore.marketplace as MarketplaceState
}

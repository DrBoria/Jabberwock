import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "../../core/webview/EventBridge"
import { getState } from "../storeSingleton"

export const MarketplaceModel = types.model("Marketplace", {})

export type IMarketplaceModel = Instance<typeof MarketplaceModel>

// Backward-compatible types and functions
export type MarketplaceState = object

export function initMarketplaceState(_provider: EventBridge): void {}

export function getMarketplaceState(provider: EventBridge): MarketplaceState {
	return getState(provider).marketplace as MarketplaceState
}

export { MarketplaceStore } from "./store"
export * from "./events"

// S4: completed barrel re-exports (no-deep-feature-import)
export type { MarketplaceViewStateManager } from "./components/state/main"
export { createMarketplaceViewStateManager } from "./components/state/main"
export { MarketplaceView } from "./components/view-root"

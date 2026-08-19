import { MarketplaceItem, MarketplaceInstalledMetadata } from "@jabberwock/types"
import { getDefaultViewState } from "./MarketplaceViewStateManager-transitions"
import type { ViewState, ViewStateTransition } from "./MarketplaceViewStateManager"

export interface MessageHandlerContext {
	getState: () => ViewState
	setState: (state: ViewState) => void
	isFilterActive: () => boolean
	filterItems: (items: MarketplaceItem[], installedMetadata?: MarketplaceInstalledMetadata) => MarketplaceItem[]
	notifyStateChange: (preserveTab?: boolean) => void
	transition: (t: ViewStateTransition) => Promise<void>
}

export function handleStateMessage(
	ctx: MessageHandlerContext,
	message: {
		type: string
		text?: string
		state?: Record<string, unknown>
		values?: { marketplaceTab?: string }
		marketplaceItems?: unknown[]
		organizationMcps?: unknown[]
		marketplaceInstalledMetadata?: unknown
		[key: string]: unknown
	},
): void {
	if (!message.state) {
		ctx.setState({ ...getDefaultViewState() })
		ctx.notifyStateChange()
		return
	}
	const rawMarketplaceItems = message.state.marketplaceItems
	const rawInstalledMetadata = message.state.marketplaceInstalledMetadata
	const hasItems = Array.isArray(rawMarketplaceItems)
	const hasMetadata = rawInstalledMetadata !== null && typeof rawInstalledMetadata === "object"
	if (hasItems) {
		const items = [...rawMarketplaceItems] as MarketplaceItem[]
		const currentState = ctx.getState()
		ctx.setState({
			...currentState,
			isFetching: false,
			allItems: items,
			displayItems: ctx.isFilterActive() ? ctx.filterItems(items, currentState.installedMetadata) : items,
			displayOrganizationMcps: ctx.isFilterActive()
				? ctx.filterItems(currentState.organizationMcps, currentState.installedMetadata)
				: currentState.organizationMcps,
			installedMetadata: hasMetadata
				? (rawInstalledMetadata as MarketplaceInstalledMetadata)
				: currentState.installedMetadata,
		})
	}
	const state = ctx.getState()
	ctx.notifyStateChange(state.activeTab !== "mcp" && (state.allItems || []).length > 0)
}

export function handleMarketplaceButtonClicked(
	ctx: MessageHandlerContext,
	message: {
		type: string
		text?: string
		values?: { marketplaceTab?: string }
		[key: string]: unknown
	},
): void {
	if (message.text) {
		void ctx.transition({ type: "FETCH_ERROR" })
		return
	}
	const requestedTab = message.values?.marketplaceTab
	if (requestedTab === "mcp" || requestedTab === "mode")
		void ctx.transition({ type: "SET_ACTIVE_TAB", payload: { tab: requestedTab } })
	void ctx.transition({ type: "FETCH_ITEMS" })
}

export function handleMarketplaceData(
	ctx: MessageHandlerContext,
	message: {
		type: string
		marketplaceItems?: unknown[]
		organizationMcps?: unknown[]
		marketplaceInstalledMetadata?: unknown
		[key: string]: unknown
	},
): void {
	const rawMarketplaceItems = message.marketplaceItems
	const rawOrganizationMcps = message.organizationMcps || []
	const rawInstalledMetadata = message.marketplaceInstalledMetadata
	const hasItems = Array.isArray(rawMarketplaceItems)
	if (hasItems) {
		const items = [...rawMarketplaceItems] as MarketplaceItem[]
		const orgMcps = Array.isArray(rawOrganizationMcps) ? ([...rawOrganizationMcps] as MarketplaceItem[]) : []
		const hasMetadata = rawInstalledMetadata !== null && typeof rawInstalledMetadata === "object"
		const currentState = ctx.getState()
		ctx.setState({
			...currentState,
			isFetching: false,
			allItems: items,
			organizationMcps: orgMcps,
			displayItems: ctx.isFilterActive() ? ctx.filterItems(items, currentState.installedMetadata) : items,
			displayOrganizationMcps: ctx.isFilterActive()
				? ctx.filterItems(orgMcps, currentState.installedMetadata)
				: orgMcps,
			installedMetadata: hasMetadata
				? (rawInstalledMetadata as MarketplaceInstalledMetadata)
				: currentState.installedMetadata,
		})
	}
	ctx.notifyStateChange()
}

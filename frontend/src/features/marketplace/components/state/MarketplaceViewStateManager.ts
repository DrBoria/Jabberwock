import { MarketplaceItem, MarketplaceInstalledMetadata } from "@jabberwock/types"
import { isFilterActive, filterItems } from "../filters/marketplace-filter-utils"
import {
	getDefaultViewState,
	handleFetchItemsTransition,
	handleFetchCompleteTransition,
	handleFetchErrorTransition,
	handleSetActiveTabTransition,
	handleUpdateFiltersTransition,
} from "./MarketplaceViewStateManager-transitions"

export interface ViewState {
	allItems: MarketplaceItem[]
	organizationMcps: MarketplaceItem[]
	displayItems?: MarketplaceItem[]
	displayOrganizationMcps?: MarketplaceItem[]
	isFetching: boolean
	activeTab: "mcp" | "mode"
	filters: { type: string; search: string; tags: string[]; installed: "all" | "installed" | "not_installed" }
	installedMetadata?: MarketplaceInstalledMetadata
}

type TransitionPayloads = {
	FETCH_ITEMS: undefined
	FETCH_COMPLETE: { items: MarketplaceItem[] }
	FETCH_ERROR: undefined
	SET_ACTIVE_TAB: { tab: ViewState["activeTab"] }
	UPDATE_FILTERS: { filters: Partial<ViewState["filters"]> }
}

export type ViewStateTransition = {
	[K in keyof TransitionPayloads]: { type: K; payload?: TransitionPayloads[K] }
}[keyof TransitionPayloads]
export type StateChangeHandler = (state: ViewState) => void

import {
	MessageHandlerContext,
	handleStateMessage,
	handleMarketplaceButtonClicked,
	handleMarketplaceData,
} from "./MarketplaceViewStateManager-message-handlers"

export class MarketplaceViewStateManager {
	private state: ViewState = getDefaultViewState()
	private stateChangeHandlers: Set<StateChangeHandler> = new Set()

	public initialize(): void {
		this.state = getDefaultViewState()
	}

	public onStateChange(handler: StateChangeHandler): () => void {
		this.stateChangeHandlers.add(handler)
		return () => this.stateChangeHandlers.delete(handler)
	}

	public cleanup(): void {
		if (this.state.isFetching) {
			this.state = { ...this.state, isFetching: false }
			this.notifyStateChange()
		}
		this.stateChangeHandlers.clear()
	}

	public getState(): ViewState {
		const allItems = this.state.allItems.length ? [...this.state.allItems] : []
		const organizationMcps = this.state.organizationMcps.length ? [...this.state.organizationMcps] : []
		const displayItems = this.state.displayItems ? [...this.state.displayItems] : [...allItems]
		const displayOrganizationMcps = this.state.displayOrganizationMcps
			? [...this.state.displayOrganizationMcps]
			: [...organizationMcps]
		const tags = this.state.filters.tags.length ? [...this.state.filters.tags] : []
		return {
			...this.state,
			allItems,
			organizationMcps,
			displayItems,
			displayOrganizationMcps,
			filters: { ...this.state.filters, tags },
		}
	}

	private notifyStateChange(preserveTab: boolean = false): void {
		const newState = this.getState()
		this.stateChangeHandlers.forEach((handler) =>
			handler(preserveTab ? { ...newState, activeTab: newState.activeTab } : newState),
		)
	}

	public async transition(transition: ViewStateTransition): Promise<void> {
		switch (transition.type) {
			case "FETCH_ITEMS":
				this.state = handleFetchItemsTransition(this.state)
				break
			case "FETCH_COMPLETE":
				if (this.handleFetchComplete(transition)) return
				break
			case "FETCH_ERROR":
				this.state = handleFetchErrorTransition(this.state)
				break
			case "SET_ACTIVE_TAB":
				if (transition.payload) this.state = handleSetActiveTabTransition(this.state, transition.payload.tab)
				break
			case "UPDATE_FILTERS":
				this.state = handleUpdateFiltersTransition(this.state, transition.payload?.filters || {})
				break
		}
		this.notifyStateChange()
	}

	private handleFetchComplete(transition: ViewStateTransition & { type: "FETCH_COMPLETE" }): boolean {
		if (!transition.payload) return false
		this.state = handleFetchCompleteTransition(this.state, transition.payload.items)
		if (JSON.stringify(transition.payload.items) === JSON.stringify(this.state.allItems)) {
			this.stateChangeHandlers.forEach((handler) => handler({ ...this.getState(), isFetching: false }))
			return true
		}
		return false
	}

	public isFilterActive(): boolean {
		return isFilterActive(this.state.filters)
	}

	public filterItems(items: MarketplaceItem[], installedMetadata?: MarketplaceInstalledMetadata): MarketplaceItem[] {
		return filterItems(items, this.state.filters, installedMetadata)
	}

	public async handleMessage(message: {
		type: string
		text?: string
		state?: Record<string, unknown>
		values?: { marketplaceTab?: string }
		marketplaceItems?: unknown[]
		organizationMcps?: unknown[]
		marketplaceInstalledMetadata?: unknown
		[key: string]: unknown
	}): Promise<void> {
		if (!message || !message.type) {
			this.state = { ...getDefaultViewState() }
			this.notifyStateChange()
			return
		}
		if (message.type === "invalidType") {
			this.state = { ...getDefaultViewState() }
			this.notifyStateChange()
			return
		}
		if (message.type === "state") {
			handleStateMessage(this.getMessageHandlerContext(), message)
			return
		}
		if (message.type === "marketplaceButtonClicked") {
			handleMarketplaceButtonClicked(this.getMessageHandlerContext(), message)
			return
		}
		if (message.type === "marketplaceData") handleMarketplaceData(this.getMessageHandlerContext(), message)
	}

	private getMessageHandlerContext(): MessageHandlerContext {
		return {
			getState: () => this.getState(),
			setState: (value) => {
				this.state = value
			},
			isFilterActive: () => this.isFilterActive(),
			filterItems: (items, installedMetadata) => this.filterItems(items, installedMetadata),
			notifyStateChange: (preserveTab) => this.notifyStateChange(preserveTab),
			transition: (t) => this.transition(t),
		}
	}
}

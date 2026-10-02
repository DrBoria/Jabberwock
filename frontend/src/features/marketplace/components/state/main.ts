import { MarketplaceItem, MarketplaceInstalledMetadata } from "@jabberwock/types"
import { isFilterActive, filterItems } from "@src/features/marketplace/components/filters/utils"
import {
	getDefaultViewState,
	handleFetchItemsTransition,
	handleFetchCompleteTransition,
	handleFetchErrorTransition,
	handleSetActiveTabTransition,
	handleUpdateFiltersTransition,
} from "./transitions"

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
} from "./message-handlers"

export interface MarketplaceViewStateManager {
	initialize(): void
	onStateChange(handler: StateChangeHandler): () => void
	cleanup(): void
	getState(): ViewState
	transition(transition: ViewStateTransition): Promise<void>
	isFilterActive(): boolean
	filterItems(items: MarketplaceItem[], installedMetadata?: MarketplaceInstalledMetadata): MarketplaceItem[]
	handleMessage(message: {
		type: string
		text?: string
		state?: Record<string, unknown>
		values?: { marketplaceTab?: string }
		marketplaceItems?: unknown[]
		organizationMcps?: unknown[]
		marketplaceInstalledMetadata?: unknown
		[key: string]: unknown
	}): Promise<void>
}

/**
 * Create a marketplace view-state manager.
 *
 * Factory-closure form (no class): the view state + change handlers live in the
 * closure, not module state.
 */
export function createMarketplaceViewStateManager(): MarketplaceViewStateManager {
	let state: ViewState = getDefaultViewState()
	const stateChangeHandlers = new Set<StateChangeHandler>()

	function getState(): ViewState {
		const allItems = state.allItems.length ? [...state.allItems] : []
		const organizationMcps = state.organizationMcps.length ? [...state.organizationMcps] : []
		const displayItems = state.displayItems ? [...state.displayItems] : [...allItems]
		const displayOrganizationMcps = state.displayOrganizationMcps
			? [...state.displayOrganizationMcps]
			: [...organizationMcps]
		const tags = state.filters.tags.length ? [...state.filters.tags] : []
		return {
			...state,
			allItems,
			organizationMcps,
			displayItems,
			displayOrganizationMcps,
			filters: { ...state.filters, tags },
		}
	}

	function notifyStateChange(preserveTab: boolean = false): void {
		const newState = getState()
		stateChangeHandlers.forEach((handler) =>
			handler(preserveTab ? { ...newState, activeTab: newState.activeTab } : newState),
		)
	}

	function isFilterActiveCheck(): boolean {
		return isFilterActive(state.filters)
	}

	function filterItemsFn(
		items: MarketplaceItem[],
		installedMetadata?: MarketplaceInstalledMetadata,
	): MarketplaceItem[] {
		return filterItems(items, state.filters, installedMetadata)
	}

	function handleFetchComplete(transition: ViewStateTransition & { type: "FETCH_COMPLETE" }): boolean {
		if (!transition.payload) return false
		state = handleFetchCompleteTransition(state, transition.payload.items)
		if (JSON.stringify(transition.payload.items) === JSON.stringify(state.allItems)) {
			stateChangeHandlers.forEach((handler) => handler({ ...getState(), isFetching: false }))
			return true
		}
		return false
	}

	async function transition(transition: ViewStateTransition): Promise<void> {
		switch (transition.type) {
			case "FETCH_ITEMS":
				state = handleFetchItemsTransition(state)
				break
			case "FETCH_COMPLETE":
				if (handleFetchComplete(transition)) return
				break
			case "FETCH_ERROR":
				state = handleFetchErrorTransition(state)
				break
			case "SET_ACTIVE_TAB":
				if (transition.payload) state = handleSetActiveTabTransition(state, transition.payload.tab)
				break
			case "UPDATE_FILTERS":
				state = handleUpdateFiltersTransition(state, transition.payload?.filters || {})
				break
		}
		notifyStateChange()
	}

	function getMessageHandlerContext(): MessageHandlerContext {
		return {
			getState: () => getState(),
			setState: (value) => {
				state = value
			},
			isFilterActive: () => isFilterActiveCheck(),
			filterItems: (items, installedMetadata) => filterItemsFn(items, installedMetadata),
			notifyStateChange: (preserveTab) => notifyStateChange(preserveTab),
			transition: (t) => transition(t),
		}
	}

	return {
		initialize(): void {
			state = getDefaultViewState()
		},

		onStateChange(handler: StateChangeHandler): () => void {
			stateChangeHandlers.add(handler)
			return () => stateChangeHandlers.delete(handler)
		},

		cleanup(): void {
			if (state.isFetching) {
				state = { ...state, isFetching: false }
				notifyStateChange()
			}
			stateChangeHandlers.clear()
		},

		getState,

		transition,

		isFilterActive: isFilterActiveCheck,

		filterItems: filterItemsFn,

		async handleMessage(message: {
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
				state = { ...getDefaultViewState() }
				notifyStateChange()
				return
			}
			if (message.type === "invalidType") {
				state = { ...getDefaultViewState() }
				notifyStateChange()
				return
			}
			if (message.type === "state") {
				handleStateMessage(getMessageHandlerContext(), message)
				return
			}
			if (message.type === "marketplaceButtonClicked") {
				handleMarketplaceButtonClicked(getMessageHandlerContext(), message)
				return
			}
			if (message.type === "marketplaceData") handleMarketplaceData(getMessageHandlerContext(), message)
		},
	}
}

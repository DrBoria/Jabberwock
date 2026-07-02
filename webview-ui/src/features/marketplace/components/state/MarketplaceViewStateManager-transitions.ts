import type { MarketplaceItem } from "@jabberwock/types"
import { rootStore } from "@src/features/store"
import { isFilterActive, filterItems } from "../filters/marketplace-filter-utils"
import type { ViewState } from "./MarketplaceViewStateManager"

export function getDefaultViewState(): ViewState {
	return {
		allItems: [],
		organizationMcps: [],
		displayItems: [],
		displayOrganizationMcps: [],
		isFetching: true,
		activeTab: "mcp",
		filters: { type: "", search: "", tags: [], installed: "all" },
	}
}

export function handleFetchItemsTransition(state: ViewState): ViewState {
	return { ...state, isFetching: true }
}

export function handleFetchCompleteTransition(state: ViewState, items: MarketplaceItem[]): ViewState {
	if (JSON.stringify(items) === JSON.stringify(state.allItems)) {
		return { ...state, isFetching: false }
	}
	return {
		...state,
		allItems: [...items],
		displayItems:
			state.filters && isFilterActive(state.filters)
				? filterItems([...items], state.filters, state.installedMetadata)
				: [...items],
		displayOrganizationMcps:
			state.filters && isFilterActive(state.filters)
				? filterItems([...state.organizationMcps], state.filters, state.installedMetadata)
				: [...state.organizationMcps],
		isFetching: false,
	}
}

export function handleFetchErrorTransition(state: ViewState): ViewState {
	const { filters, activeTab, allItems, displayItems } = state
	return { ...getDefaultViewState(), filters, activeTab, allItems, displayItems, isFetching: false }
}

export function handleSetActiveTabTransition(state: ViewState, tab: ViewState["activeTab"]): ViewState {
	return { ...state, activeTab: tab }
}

export function handleUpdateFiltersTransition(state: ViewState, filters: Partial<ViewState["filters"]>): ViewState {
	const updatedFilters = {
		type: filters.type !== undefined ? filters.type : state.filters.type,
		search: filters.search !== undefined ? filters.search : state.filters.search,
		tags: filters.tags !== undefined ? filters.tags : state.filters.tags,
		installed: filters.installed !== undefined ? filters.installed : state.filters.installed,
	}
	const newState = {
		...state,
		filters: updatedFilters,
		displayItems: filterItems(state.allItems, updatedFilters, state.installedMetadata),
		displayOrganizationMcps: filterItems(state.organizationMcps, updatedFilters, state.installedMetadata),
	}
	rootStore.marketplace.filterMarketplaceItems(updatedFilters)
	return newState
}

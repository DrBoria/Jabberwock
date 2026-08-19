import * as React from "react"
import { MarketplaceViewStateManager } from "./state/MarketplaceViewStateManager"
import { useStateManager } from "./state/useStateManager"
import { rootStore } from "@src/features/store"
import { IssueFooter } from "./IssueFooter"
import { MarketplaceFilters } from "./filters/MarketplaceFilterBar"
import { MarketplaceItemList } from "./MarketplaceItemListView"
import { LoadingState, EmptyState, getDisplayItems, getDisplayOrganizationMcps } from "./MarketplaceStatesView"

export interface MarketplaceListViewProps {
	stateManager: MarketplaceViewStateManager
	allTags: string[]
	filteredTags: string[]
	filterByType?: "mcp" | "mode"
}

export function MarketplaceListView({ stateManager, allTags, filteredTags, filterByType }: MarketplaceListViewProps) {
	const [state, manager] = useStateManager(stateManager)
	const marketplaceInstalledMetadata = rootStore.marketplace.marketplaceInstalledMetadata
	const cloudUserInfo = rootStore.extensionState.cloudUserInfo
	const allItems = getDisplayItems(state)
	const organizationMcps = getDisplayOrganizationMcps(state)
	const items = filterByType ? allItems.filter((item) => item.type === filterByType) : allItems
	const orgMcps = filterByType === "mcp" ? organizationMcps : []
	const isEmpty = items.length === 0 && orgMcps.length === 0
	return (
		<>
			<MarketplaceFilters
				state={state}
				manager={manager}
				allTags={allTags}
				filteredTags={filteredTags}
				filterByType={filterByType}
			/>
			{isEmpty ? (
				state.isFetching ? (
					<LoadingState />
				) : (
					<EmptyState
						onClearFilters={() =>
							manager.transition({
								type: "UPDATE_FILTERS",
								payload: { filters: { search: "", type: "", tags: [], installed: "all" } },
							})
						}
					/>
				)
			) : (
				<MarketplaceItemList
					items={items}
					orgMcps={orgMcps}
					state={state}
					manager={manager}
					marketplaceInstalledMetadata={marketplaceInstalledMetadata}
					cloudUserInfo={cloudUserInfo}
				/>
			)}
			<IssueFooter />
		</>
	)
}

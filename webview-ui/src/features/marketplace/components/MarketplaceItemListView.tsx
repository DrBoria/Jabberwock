import * as React from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { MarketplaceItemCard } from "./item-card/MarketplaceItemCard"
import type { MarketplaceViewStateManager, ViewState } from "./state/MarketplaceViewStateManager"
import type { MarketplaceItem, MarketplaceInstalledMetadata } from "@jabberwock/types"

interface MarketplaceItemListProps {
	items: MarketplaceItem[]
	orgMcps: MarketplaceItem[]
	state: ViewState
	manager: MarketplaceViewStateManager
	marketplaceInstalledMetadata: MarketplaceInstalledMetadata | undefined
	cloudUserInfo: { organizationName?: string } | null
}

export function MarketplaceItemList({
	items,
	orgMcps,
	state,
	manager,
	marketplaceInstalledMetadata,
	cloudUserInfo,
}: MarketplaceItemListProps) {
	const { t } = useAppTranslation()
	const updater = (filters: Partial<ViewState["filters"]>) =>
		manager.transition({ type: "UPDATE_FILTERS", payload: { filters } })
	const renderCard = (item: MarketplaceItem, keyPrefix: string) => (
		<MarketplaceItemCard
			key={`${keyPrefix}-${item.id}`}
			item={item}
			filters={state.filters}
			setFilters={(filters) => updater(filters)}
			installed={{
				project: marketplaceInstalledMetadata?.project?.[item.id],
				global: marketplaceInstalledMetadata?.global?.[item.id],
			}}
		/>
	)
	return (
		<div className="pb-3">
			{orgMcps.length > 0 && (
				<div className="mb-6">
					<div className="flex items-center gap-2 mb-3 px-1">
						<span className="codicon codicon-organization text-lg"></span>
						<h3 className="text-sm font-semibold text-vscode-foreground">
							{t("marketplace:sections.organizationMcps", {
								organization: cloudUserInfo?.organizationName,
							})}
						</h3>
						<div className="flex-1 h-px bg-vscode-input-border"></div>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
						{orgMcps.map((item) => renderCard(item, "org"))}
					</div>
				</div>
			)}
			{items.length > 0 && (
				<div>
					{orgMcps.length > 0 && (
						<div className="flex items-center gap-2 mb-3 px-1">
							<span className="codicon codicon-globe text-lg"></span>
							<h3 className="text-sm font-semibold text-vscode-foreground">
								{t("marketplace:sections.marketplace")}
							</h3>
							<div className="flex-1 h-px bg-vscode-input-border"></div>
						</div>
					)}
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
						{items.map((item) => renderCard(item, "item"))}
					</div>
				</div>
			)}
		</div>
	)
}

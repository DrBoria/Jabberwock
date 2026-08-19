import { useAppTranslation } from "@/i18n/TranslationContext"
import { Button } from "@src/shared/ui/buttons/button"
import type { ViewState } from "./state/MarketplaceViewStateManager"
import type { MarketplaceItem } from "@jabberwock/types"

export function LoadingState() {
	const { t } = useAppTranslation()
	return (
		<div className="flex flex-col items-center justify-center h-64 text-vscode-descriptionForeground animate-fade-in">
			<div className="animate-spin mb-4">
				<span className="codicon codicon-sync text-3xl"></span>
			</div>
			<p>{t("marketplace:items.refresh.refreshing")}</p>
			<p className="text-sm mt-2 animate-pulse">{t("marketplace:items.refresh.mayTakeMoment")}</p>
		</div>
	)
}

export function EmptyState({ onClearFilters }: { onClearFilters: () => void }) {
	const { t } = useAppTranslation()
	return (
		<div className="flex flex-col items-center justify-center h-64 text-vscode-descriptionForeground animate-fade-in">
			<span className="codicon codicon-inbox text-4xl mb-4 opacity-70"></span>
			<p className="font-medium">{t("marketplace:items.empty.noItems")}</p>
			<p className="text-sm mt-2">{t("marketplace:items.empty.adjustFilters")}</p>
			<Button
				onClick={onClearFilters}
				className="mt-4 bg-vscode-button-secondaryBackground text-vscode-button-secondaryForeground hover:bg-vscode-button-secondaryHoverBackground transition-colors">
				<span className="codicon codicon-clear-all mr-2"></span>
				{t("marketplace:items.empty.clearAllFilters")}
			</Button>
		</div>
	)
}

export const getDisplayItems = (state: ViewState): MarketplaceItem[] => state.displayItems || []
export const getDisplayOrganizationMcps = (state: ViewState): MarketplaceItem[] => state.displayOrganizationMcps || []

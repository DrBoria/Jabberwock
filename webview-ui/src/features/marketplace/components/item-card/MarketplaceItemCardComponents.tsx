import React from "react"
import { MarketplaceItem } from "@jabberwock/types"
import { rootStore } from "@src/features/store"
import { ViewState } from "../state/MarketplaceViewStateManager"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { isValidUrl } from "../../../../utils/misc/url"
import { cn } from "@/lib/utils"
import { Button } from "@src/shared/ui/buttons/button"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"

interface ItemNameDisplayProps {
	item: MarketplaceItem
}
interface MarketplaceTagsSectionProps {
	item: MarketplaceItem
	filters: ViewState["filters"]
	setFilters: (filters: Partial<ViewState["filters"]>) => void
	isInstalled: boolean
}
interface AuthorInfoProps {
	item: MarketplaceItem
	typeLabel: string
}

export const ItemNameDisplay: React.FC<ItemNameDisplayProps> = ({ item }) => {
	if (item.type === "mcp" && item.url && isValidUrl(item.url)) {
		return (
			<Button
				variant="link"
				className="p-0 h-auto text-lg font-semibold text-vscode-foreground hover:underline"
				onClick={() => rootStore.settings.openExternal(item.url)}>
				{item.name}
			</Button>
		)
	}
	return <>{item.name}</>
}

export const MarketplaceTagsSection: React.FC<MarketplaceTagsSectionProps> = ({
	item,
	filters,
	setFilters,
	isInstalled,
}) => {
	const { t } = useAppTranslation()
	const tags = item.tags
	const hasTags = tags && tags.length > 0
	if (!isInstalled && !hasTags) return null
	return (
		<div className="relative flex flex-wrap gap-1 my-2">
			{isInstalled && (
				<span className="text-xs px-2 py-0.5 rounded-sm h-5 flex items-center bg-green-600/20 text-green-400 border border-green-600/30 shrink-0">
					{t("marketplace:items.card.installed")}
				</span>
			)}
			{hasTags &&
				tags.map((tag) => (
					<StandardTooltip
						key={tag}
						content={
							filters.tags.includes(tag)
								? t("marketplace:filters.tags.clear", { count: tag })
								: t("marketplace:filters.tags.clickToFilter")
						}>
						<Button
							size="sm"
							variant="secondary"
							className={cn("rounded-sm capitalize text-xs px-2 h-5", {
								"border-solid border-primary text-primary": filters.tags.includes(tag),
							})}
							onClick={() => {
								const newTags = filters.tags.includes(tag)
									? filters.tags.filter((t: string) => t !== tag)
									: [...filters.tags, tag]
								setFilters({ tags: newTags })
							}}>
							{tag}
						</Button>
					</StandardTooltip>
				))}
		</div>
	)
}

export const AuthorInfo: React.FC<AuthorInfoProps> = ({ item, typeLabel }) => {
	const { t } = useAppTranslation()
	const handleOpenAuthorUrl = () => {
		if (item.authorUrl && isValidUrl(item.authorUrl)) rootStore.settings.openExternal(item.authorUrl)
	}
	if (item.author) {
		return (
			<p className="text-sm text-vscode-descriptionForeground my-0">
				{typeLabel}{" "}
				{item.authorUrl && isValidUrl(item.authorUrl) ? (
					<Button
						variant="link"
						className="p-0 h-auto text-sm text-vscode-textLink hover:underline"
						onClick={handleOpenAuthorUrl}>
						{t("marketplace:items.card.by", { author: item.author })}
					</Button>
				) : (
					t("marketplace:items.card.by", { author: item.author })
				)}
			</p>
		)
	}
	return null
}

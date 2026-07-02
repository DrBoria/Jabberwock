import * as React from "react"
import { Input } from "@src/shared/ui/inputs/input"
import { Button } from "@src/shared/ui/buttons/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/shared/ui/selects/select"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { TagSelectPopover } from "./MarketplaceTagSelectPopover"
import type { MarketplaceViewStateManager, ViewState } from "../state/MarketplaceViewStateManager"

const getSearchPlaceholder = (filterByType: "mcp" | "mode" | undefined, t: (key: string) => string): string =>
	filterByType === "mcp"
		? t("marketplace:filters.search.placeholderMcp")
		: filterByType === "mode"
			? t("marketplace:filters.search.placeholderMode")
			: t("marketplace:filters.search.placeholder")

interface MarketplaceFiltersProps {
	state: ViewState
	manager: MarketplaceViewStateManager
	allTags: string[]
	filteredTags: string[]
	filterByType?: "mcp" | "mode"
}

export function MarketplaceFilters({ state, manager, allTags, filteredTags, filterByType }: MarketplaceFiltersProps) {
	const { t } = useAppTranslation()
	const [isTagPopoverOpen, setIsTagPopoverOpen] = React.useState(false)
	const [tagSearch, setTagSearch] = React.useState("")
	const updater = (filters: Partial<ViewState["filters"]>) =>
		manager.transition({ type: "UPDATE_FILTERS", payload: { filters } })
	return (
		<div className="mb-4">
			<div className="relative">
				<Input
					type="text"
					placeholder={getSearchPlaceholder(filterByType, t)}
					value={state.filters.search}
					onChange={(e) => updater({ search: e.target.value })}
				/>
			</div>
			<div className="mt-2 flex gap-2">
				<Select
					value={state.filters.installed}
					onValueChange={(value: "all" | "installed" | "not_installed") => updater({ installed: value })}>
					<SelectTrigger className="flex-1 h-7">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">{t("marketplace:filters.installed.all")}</SelectItem>
						<SelectItem value="installed">{t("marketplace:filters.installed.installed")}</SelectItem>
						<SelectItem value="not_installed">{t("marketplace:filters.installed.notInstalled")}</SelectItem>
					</SelectContent>
				</Select>
				<TagSelectPopover
					allTags={allTags}
					filteredTags={filteredTags}
					selectedTags={state.filters.tags}
					tagSearch={tagSearch}
					isPopoverOpen={isTagPopoverOpen}
					onOpenChange={setIsTagPopoverOpen}
					onTagSearchChange={setTagSearch}
					onTagsChange={(tags) => updater({ tags })}
				/>
			</div>
			{state.filters.tags.length > 0 && (
				<div className="text-xs text-vscode-descriptionForeground mt-2 flex items-center justify-between">
					<div className="flex items-center">
						<span className="codicon codicon-tag mr-1"></span>
						{t("marketplace:filters.tags.selected")}
					</div>
					<Button
						className="shadow-none font-normal flex items-center gap-1 h-auto py-0.5 px-1.5 text-xs"
						size="sm"
						variant="secondary"
						onClick={(e) => {
							e.stopPropagation()
							updater({ tags: [] })
						}}>
						<span className="codicon codicon-close"></span>
						{t("marketplace:filters.tags.clear")}
					</Button>
				</div>
			)}
		</div>
	)
}

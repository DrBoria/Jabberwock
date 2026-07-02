import React from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/shared/ui/selects/select"
import { useAppTranslation } from "@/i18n/TranslationContext"

export type SortOption = "newest" | "oldest" | "mostExpensive" | "mostTokens" | "mostRelevant"

export const SORT_OPTIONS: SortOption[] = ["newest", "oldest", "mostExpensive", "mostTokens", "mostRelevant"]

export const isSortOption = (value: string): value is SortOption => SORT_OPTIONS.some((option) => option === value)

export const handleSearchInput = (
	e: unknown,
	searchQuery: string,
	sortOption: SortOption,
	setSearchQuery: (q: string) => void,
	setLastNonRelevantSort: (sort: SortOption | null) => void,
	setSortOption: (sort: SortOption) => void,
) => {
	if (!(e instanceof Event)) return
	const target = e.target
	const newValue = target instanceof HTMLInputElement ? target.value : undefined
	if (newValue === undefined) return
	setSearchQuery(newValue)
	if (newValue && !searchQuery && sortOption !== "mostRelevant") {
		setLastNonRelevantSort(sortOption)
		setSortOption("mostRelevant")
	}
}

export const WorkspaceSelect = ({
	showAllWorkspaces,
	onChange,
}: {
	showAllWorkspaces: boolean
	onChange: (value: boolean) => void
}) => {
	const { t } = useAppTranslation()
	return (
		<Select value={showAllWorkspaces ? "all" : "current"} onValueChange={(value) => onChange(value === "all")}>
			<SelectTrigger className="flex-1">
				<SelectValue>
					{t("history:workspace.prefix")} {t(`history:workspace.${showAllWorkspaces ? "all" : "current"}`)}
				</SelectValue>
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="current">
					<div className="flex items-center gap-2">
						<span className="codicon codicon-folder" />
						{t("history:workspace.current")}
					</div>
				</SelectItem>
				<SelectItem value="all">
					<div className="flex items-center gap-2">
						<span className="codicon codicon-folder-opened" />
						{t("history:workspace.all")}
					</div>
				</SelectItem>
			</SelectContent>
		</Select>
	)
}

export const SortSelect = ({
	sortOption,
	searchQuery,
	onChange,
}: {
	sortOption: string
	searchQuery: string
	onChange: (value: SortOption) => void
}) => {
	const { t } = useAppTranslation()
	const handleValueChange = (value: string) => {
		if (isSortOption(value)) onChange(value)
	}
	return (
		<Select value={sortOption} onValueChange={handleValueChange}>
			<SelectTrigger className="flex-1">
				<SelectValue>
					{t("history:sort.prefix")} {t(`history:sort.${sortOption}`)}
				</SelectValue>
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="newest" data-testid="select-newest">
					<div className="flex items-center gap-2">
						<span className="codicon codicon-arrow-down" />
						{t("history:newest")}
					</div>
				</SelectItem>
				<SelectItem value="oldest" data-testid="select-oldest">
					<div className="flex items-center gap-2">
						<span className="codicon codicon-arrow-up" />
						{t("history:oldest")}
					</div>
				</SelectItem>
				<SelectItem value="mostExpensive" data-testid="select-most-expensive">
					<div className="flex items-center gap-2">
						<span className="codicon codicon-credit-card" />
						{t("history:mostExpensive")}
					</div>
				</SelectItem>
				<SelectItem value="mostTokens" data-testid="select-most-tokens">
					<div className="flex items-center gap-2">
						<span className="codicon codicon-symbol-numeric" />
						{t("history:mostTokens")}
					</div>
				</SelectItem>
				<SelectItem value="mostRelevant" disabled={!searchQuery} data-testid="select-most-relevant">
					<div className="flex items-center gap-2">
						<span className="codicon codicon-search" />
						{t("history:mostRelevant")}
					</div>
				</SelectItem>
			</SelectContent>
		</Select>
	)
}

export const SearchField = ({
	searchQuery,
	onInput,
	onClear,
}: {
	searchQuery: string
	onInput: (e: unknown) => void
	onClear: () => void
}) => {
	const { t } = useAppTranslation()
	return (
		<VSCodeTextField
			className="w-full"
			placeholder={t("history:searchPlaceholder")}
			value={searchQuery}
			data-testid="history-search-input"
			onInput={onInput}>
			<div slot="start" className="codicon codicon-search mt-0.5 opacity-80 text-sm!" />
			{searchQuery && (
				<div
					className="input-icon-button codicon codicon-close flex justify-center items-center h-full"
					aria-label="Clear search"
					onClick={onClear}
					slot="end"
				/>
			)}
		</VSCodeTextField>
	)
}

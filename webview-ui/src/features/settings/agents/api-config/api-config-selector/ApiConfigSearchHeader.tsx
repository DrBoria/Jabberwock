import type { ApiConfigSearchHeaderProps } from "./types"

export const ApiConfigSearchHeader = ({
	listApiConfigMeta,
	searchValue,
	onSearchChange,
	onSearchClear,
	t,
}: ApiConfigSearchHeaderProps) => {
	const showSearch = listApiConfigMeta.length > 6
	if (showSearch) {
		return (
			<div className="relative p-2 border-b border-vscode-dropdown-border">
				<input
					aria-label={t("common:ui.search_placeholder")}
					value={searchValue}
					onChange={(e) => onSearchChange(e.target.value)}
					placeholder={t("common:ui.search_placeholder")}
					className="w-full h-8 px-2 py-1 text-xs bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded focus:outline-0"
					autoFocus
				/>
				{searchValue.length > 0 && (
					<div className="absolute right-4 top-0 bottom-0 flex items-center justify-center">
						<span
							className="codicon codicon-close text-vscode-input-foreground opacity-50 hover:opacity-100 text-xs cursor-pointer"
							onClick={onSearchClear}
						/>
					</div>
				)}
			</div>
		)
	}
	return (
		<div className="p-3 border-b border-vscode-dropdown-border">
			<p className="text-xs text-vscode-descriptionForeground m-0">{t("prompts:apiConfiguration.select")}</p>
		</div>
	)
}

import React from "react"
import { Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { PopoverContent } from "@src/shared/ui/overlays/popover"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"
import { IconButton } from "@src/shared/ui/buttons/icon-button"
import { rootStore } from "@src/features/store"
import { type ModeSelectorContentProps } from "./types"

export function ModeSelectorContent({
	searchValue,
	setSearchValue,
	searchInputRef,
	portalContainer,
	showSearch,
	instructionText,
	onClearSearch,
	filteredModes,
	value,
	handleSelect,
	selectedItemRef,
	t,
	setOpen,
}: ModeSelectorContentProps) {
	return (
		<PopoverContent
			align="start"
			sideOffset={4}
			container={portalContainer}
			className="p-0 overflow-hidden min-w-80 max-w-9/10">
			<div className="flex flex-col w-full">
				{showSearch ? (
					<div className="relative p-2 border-b border-vscode-dropdown-border">
						<input
							aria-label="Search modes"
							ref={searchInputRef}
							value={searchValue}
							onChange={(e) => setSearchValue(e.target.value)}
							placeholder={t("chat:modeSelector.searchPlaceholder")}
							className="w-full h-8 px-2 py-1 text-xs bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded focus:outline-0"
							data-testid="mode-search-input"
						/>
						{searchValue.length > 0 && (
							<div className="absolute right-4 top-0 bottom-0 flex items-center justify-center">
								<X
									className="text-vscode-input-foreground opacity-50 hover:opacity-100 size-4 p-0.5 cursor-pointer"
									onClick={onClearSearch}
								/>
							</div>
						)}
					</div>
				) : (
					<div className="p-3 border-b border-vscode-dropdown-border">
						<p className="m-0 text-xs text-vscode-descriptionForeground">{instructionText}</p>
					</div>
				)}
				<div className="max-h-[300px] overflow-y-auto">
					{filteredModes.length === 0 && searchValue ? (
						<div className="py-2 px-3 text-sm text-vscode-foreground/70">
							{t("chat:modeSelector.noResults")}
						</div>
					) : (
						<div className="py-1">
							{filteredModes.map((mode) => {
								const isSelected = mode.slug === value
								return (
									<div
										key={mode.slug}
										ref={isSelected ? selectedItemRef : null}
										onClick={() => handleSelect(mode.slug)}
										className={cn(
											"px-3 py-1.5 text-sm cursor-pointer flex items-center hover:bg-vscode-list-hoverBackground",
											isSelected
												? "bg-vscode-list-activeSelectionBackground text-vscode-list-activeSelectionForeground"
												: "",
										)}
										data-testid={`mode-selector-item-${mode.slug}`}>
										<div className="flex-1 min-w-0">
											<div className="font-bold truncate">{mode.name}</div>
											{mode.description && (
												<div className="text-xs text-vscode-descriptionForeground truncate">
													{mode.description}
												</div>
											)}
										</div>
										{isSelected && <Check className="ml-auto size-4 p-0.5" />}
									</div>
								)
							})}
						</div>
					)}
				</div>
				<div className="flex flex-row items-center justify-between px-2 py-2 border-t border-vscode-dropdown-border">
					<div className="flex flex-row gap-1">
						<IconButton
							iconClass="codicon-extensions"
							title={t("chat:modeSelector.marketplace")}
							onClick={() => {
								window.postMessage(
									{
										type: "action",
										action: "marketplaceButtonClicked",
										values: { marketplaceTab: "mode" },
									},
									"*",
								)
								setOpen(false)
							}}
						/>
						<IconButton
							iconClass="codicon-settings-gear"
							title={t("chat:modeSelector.settings")}
							onClick={() => {
								rootStore.windowManager.switchTab("settings", { section: "modes" })
								setOpen(false)
							}}
						/>
					</div>
					<div className="flex items-center gap-1 pr-1">
						{showSearch && (
							<StandardTooltip content={instructionText}>
								<span className="codicon codicon-info text-xs text-vscode-descriptionForeground opacity-70 hover:opacity-100 cursor-help" />
							</StandardTooltip>
						)}
						<h4 className="m-0 font-medium text-sm text-vscode-descriptionForeground">
							{t("chat:modeSelector.title")}
						</h4>
					</div>
				</div>
			</div>
		</PopoverContent>
	)
}

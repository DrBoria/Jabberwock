import React from "react"
import { Fzf } from "fzf"
import { Check, X } from "lucide-react"

import { type ModeConfig, type CustomModePrompts, TelemetryEventName } from "@jabberwock/types"

import { type Mode, getAllModes } from "@shared/modes"

import { telemetryClient } from "@/features/cloud/utils/TelemetryClient"
import { cn } from "@/lib/utils"
import { observer } from "mobx-react-lite"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useJabberwockPortal } from "@/features/foundation/ui/hooks/useJabberwockPortal"
import { Popover, PopoverContent, PopoverTrigger } from "@src/features/foundation/ui/popover"
import { StandardTooltip } from "@src/features/foundation/ui/standard-tooltip"

import { IconButton } from "@src/features/foundation/ui"

const SEARCH_THRESHOLD = 6

interface ModeSelectorProps {
	value: Mode
	onChange: (value: Mode) => void
	disabled?: boolean
	title: string
	triggerClassName?: string
	modeShortcutText: string
	customModes?: ModeConfig[]
	customModePrompts?: CustomModePrompts
	disableSearch?: boolean
}

import { rootStore } from "@src/features/store"
export const ModeSelector = observer(
	({
		value,
		onChange,
		disabled = false,
		title,
		triggerClassName = "",
		modeShortcutText,
		customModes,
		customModePrompts,
		disableSearch = false,
	}: ModeSelectorProps) => {
		const [open, setOpen] = React.useState(false)
		const [searchValue, setSearchValue] = React.useState("")
		const searchInputRef = React.useRef<HTMLInputElement>(null)
		const selectedItemRef = React.useRef<HTMLDivElement>(null)
		const scrollContainerRef = React.useRef<HTMLDivElement>(null)
		const portalContainer = useJabberwockPortal("jabberwock-portal")
		const { t } = useAppTranslation()

		const trackModeSelectorOpened = React.useCallback(() => {
			telemetryClient?.capture?.(TelemetryEventName.MODE_SELECTOR_OPENED)
		}, [])

		const modes = React.useMemo(() => {
			const allModes = getAllModes(customModes)
			return allModes.map((mode) => ({
				...mode,
				description: customModePrompts?.[mode.slug]?.roleDefinition ?? mode.description,
			}))
		}, [customModes, customModePrompts])

		// Scroll to the selected mode when the popover opens
		React.useEffect(() => {
			if (open && selectedItemRef.current && scrollContainerRef.current) {
				requestAnimationFrame(() => {
					selectedItemRef.current?.scrollIntoView({ block: "nearest" })
				})
			}
		}, [open])

		const nameSearchItems = React.useMemo(
			() =>
				modes.map((mode) => ({
					original: mode,
					searchStr: mode.name,
				})),
			[modes],
		)

		const descriptionSearchItems = React.useMemo(
			() =>
				modes.map((mode) => ({
					original: mode,
					searchStr: mode.description || "",
				})),
			[modes],
		)

		const nameFzf = React.useMemo(
			() => new Fzf(nameSearchItems, { selector: (item) => item.searchStr }),
			[nameSearchItems],
		)

		const descriptionFzf = React.useMemo(
			() => new Fzf(descriptionSearchItems, { selector: (item) => item.searchStr }),
			[descriptionSearchItems],
		)

		const filteredModes = React.useMemo(() => {
			if (!searchValue) {
				return modes
			}

			const nameMatches = new Set(nameFzf.find(searchValue).map((r) => r.item.original.slug))
			const descriptionMatches = new Set(descriptionFzf.find(searchValue).map((r) => r.item.original.slug))
			const allMatches = new Set([...nameMatches, ...descriptionMatches])

			return modes.filter((mode) => allMatches.has(mode.slug))
		}, [modes, searchValue, nameFzf, descriptionFzf])

		const showSearch = React.useMemo(
			() => !disableSearch && modes.length > SEARCH_THRESHOLD,
			[disableSearch, modes.length],
		)

		const instructionText = React.useMemo(
			() => t("chat:modeSelector.instruction", { shortcut: modeShortcutText }),
			[t, modeShortcutText],
		)

		const onClearSearch = React.useCallback(() => {
			setSearchValue("")
			searchInputRef.current?.focus()
		}, [])

		const handleSelect = React.useCallback(
			(modeSlug: string) => {
				if (modeSlug !== value) {
					onChange(modeSlug)
				}
				setOpen(false)
				setSearchValue("")
			},
			[onChange, value],
		)

		const onOpenChange = React.useCallback(
			(isOpen: boolean) => {
				setOpen(isOpen)
				if (isOpen) {
					trackModeSelectorOpened()
					// Focus search input when popover opens
					requestAnimationFrame(() => {
						searchInputRef.current?.focus()
					})
				} else {
					setSearchValue("")
				}
			},
			[trackModeSelectorOpened],
		)

		// Keyboard navigation
		React.useEffect(() => {
			if (!open || !showSearch) return

			const handleKeyDown = (e: KeyboardEvent) => {
				if (e.key === "Escape") {
					setOpen(false)
				}
			}

			window.addEventListener("keydown", handleKeyDown)
			return () => window.removeEventListener("keydown", handleKeyDown)
		}, [open, showSearch])

		const selectedMode = modes.find((m) => m.slug === value)

		return (
			<Popover open={open} onOpenChange={onOpenChange} data-testid="mode-selector-root">
				<StandardTooltip content={title}>
					<PopoverTrigger
						disabled={disabled}
						data-testid="dropdown-trigger"
						className={cn(
							"min-w-0 inline-flex items-center relative whitespace-nowrap px-1.5 py-1 text-xs",
							"bg-transparent border border-[rgba(255,255,255,0.08)] rounded-md text-vscode-foreground",
							"transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder focus-visible:ring-inset",
							disabled
								? "opacity-50 cursor-not-allowed"
								: "opacity-90 hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)] cursor-pointer",
							triggerClassName,
						)}>
						<span className="truncate">{selectedMode?.name || ""}</span>
					</PopoverTrigger>
				</StandardTooltip>
				<PopoverContent
					align="start"
					sideOffset={4}
					container={portalContainer}
					className="p-0 overflow-hidden min-w-80 max-w-9/10">
					<div className="flex flex-col w-full">
						{/* Show search bar only when there are more than SEARCH_THRESHOLD items, otherwise show info blurb */}
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

						{/* Mode List */}
						<div ref={scrollContainerRef} className="max-h-[300px] overflow-y-auto">
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
													"px-3 py-1.5 text-sm cursor-pointer flex items-center",
													"hover:bg-vscode-list-hoverBackground",
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

						{/* Bottom bar with buttons on left and title on right */}
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

							{/* Info icon and title on the right - only show info icon when search bar is visible */}
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
			</Popover>
		)
	},
)

import React from "react"
import { observer } from "mobx-react-lite"
import { Popover, PopoverTrigger } from "@src/shared/ui/overlays/popover"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"
import { cn } from "@/lib/utils"
import { useModeSelector } from "./useModeSelector"
import { ModeSelectorContent } from "./ModeSelectorContent"
import type { ModeSelectorProps } from "./types"

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
		const {
			open,
			setOpen,
			searchValue,
			setSearchValue,
			searchInputRef,
			selectedItemRef,
			portalContainer,
			showSearch,
			instructionText,
			onClearSearch,
			filteredModes,
			handleSelect,
			onOpenChange,
			selectedMode,
			t,
		} = useModeSelector({
			value,
			onChange,
			modeShortcutText,
			customModes,
			customModePrompts,
			disableSearch,
		})

		return (
			<Popover open={open} onOpenChange={onOpenChange} data-testid="mode-selector-root">
				<StandardTooltip content={title}>
					<PopoverTrigger
						disabled={disabled}
						data-testid="dropdown-trigger"
						className={cn(
							"min-w-0 inline-flex items-center relative whitespace-nowrap px-1.5 py-1 text-xs bg-transparent border border-[rgba(255,255,255,0.08)] rounded-md text-vscode-foreground transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder focus-visible:ring-inset",
							disabled
								? "opacity-50 cursor-not-allowed"
								: "opacity-90 hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)] cursor-pointer",
							triggerClassName,
						)}>
						<span className="truncate">{selectedMode?.name || ""}</span>
					</PopoverTrigger>
				</StandardTooltip>
				<ModeSelectorContent
					searchValue={searchValue}
					setSearchValue={setSearchValue}
					searchInputRef={searchInputRef}
					portalContainer={portalContainer}
					showSearch={showSearch}
					instructionText={instructionText}
					onClearSearch={onClearSearch}
					filteredModes={filteredModes}
					value={value}
					handleSelect={handleSelect}
					selectedItemRef={selectedItemRef}
					t={t}
					setOpen={setOpen}
				/>
			</Popover>
		)
	},
)

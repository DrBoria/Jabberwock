import React from "react"

import { ChevronDown, X, Upload } from "lucide-react"
import type { ModeConfig } from "./types"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/shared/ui/buttons/button"
import {
	Command,
	CommandInput,
	CommandList,
	CommandEmpty,
	CommandItem,
	CommandGroup,
} from "@src/shared/ui/overlays/command"
import { Popover, PopoverContent, PopoverTrigger } from "@src/shared/ui/overlays/popover"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"

export interface ModeToolbarProps {
	displayModes: ModeConfig[]
	searchValue: string
	open: boolean
	isRenamingMode: boolean
	renameInputValue: string
	isExporting: boolean
	onOpenChange: (open: boolean) => void
	onSearchChange: (value: string) => void
	onClearSearch: () => void
	onModeSelect: (modeConfig: ModeConfig) => void
	onStartRename: () => void
	onSaveRename: () => void
	onCancelRename: () => void
	onRenameInputChange: (value: string) => void
	onCreateMode: () => void
	onDeleteMode: () => void
	onExport: () => void
	getCurrentMode: () => ModeConfig | undefined
}

export const ModeToolbar: React.FC<ModeToolbarProps> = ({
	displayModes,
	searchValue,
	open,
	isExporting,
	onOpenChange,
	onSearchChange,
	onClearSearch,
	onModeSelect,
	onStartRename,
	onCreateMode,
	onDeleteMode,
	onExport,
	getCurrentMode,
}) => {
	const { t } = useAppTranslation()
	const modeConfig = getCurrentMode()
	return (
		<div className="flex items-center gap-2 mb-2">
			<Popover open={open} onOpenChange={onOpenChange}>
				<PopoverTrigger asChild>
					<Button variant="outline" className="w-[200px] justify-between">
						{modeConfig?.name || t("prompts:modeSelector.placeholder")}
						<ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-[200px] p-0">
					<Command>
						<CommandInput
							placeholder={t("prompts:modeSelector.search")}
							value={searchValue}
							onValueChange={onSearchChange}
						/>
						<CommandEmpty>{t("prompts:modeSelector.noResults")}</CommandEmpty>
						<CommandList>
							<CommandGroup>
								{displayModes.map((mc) => (
									<CommandItem key={mc.slug} onSelect={() => onModeSelect(mc)}>
										{mc.name}
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>

			<StandardTooltip content={t("prompts:rename")}>
				<Button variant="ghost" size="icon" onClick={onStartRename}>
					<Upload className="h-4 w-4" />
				</Button>
			</StandardTooltip>
			<StandardTooltip content={t("prompts:create")}>
				<Button variant="ghost" size="icon" onClick={onCreateMode}>
					<Upload className="h-4 w-4" />
				</Button>
			</StandardTooltip>
			<StandardTooltip content={t("prompts:delete")}>
				<Button variant="ghost" size="icon" onClick={onDeleteMode}>
					<X className="h-4 w-4" />
				</Button>
			</StandardTooltip>
			<StandardTooltip content={t("prompts:export")}>
				<Button variant="ghost" size="icon" onClick={onExport} disabled={isExporting}>
					<Upload className="h-4 w-4" />
				</Button>
			</StandardTooltip>

			{searchValue && (
				<X
					className="text-vscode-input-foreground opacity-50 hover:opacity-100 size-4 p-0.5 cursor-pointer"
					onClick={onClearSearch}
				/>
			)}
		</div>
	)
}

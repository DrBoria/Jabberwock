import React from "react"
import { Checkbox } from "@src/shared/ui/inputs/checkbox"
import { Button } from "@src/shared/ui/buttons/button"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"
import { useAppTranslation } from "@/i18n/TranslationContext"
import type { DisplayHistoryItem } from "../types"

export const VirtuosoList = React.forwardRef<HTMLDivElement, { style?: React.CSSProperties; className?: string }>(
	(props, ref) => <div {...props} ref={ref} data-testid="virtuoso-item-list" />,
)

export const SelectionModeButton = ({
	isSelectionMode,
	onToggle,
}: {
	isSelectionMode: boolean
	onToggle: () => void
}) => {
	const { t } = useAppTranslation()
	return (
		<StandardTooltip
			content={isSelectionMode ? `${t("history:exitSelectionMode")}` : `${t("history:enterSelectionMode")}`}>
			<Button
				variant={isSelectionMode ? "primary" : "secondary"}
				onClick={onToggle}
				data-testid="toggle-selection-mode-button">
				<span className={`codicon ${isSelectionMode ? "codicon-check-all" : "codicon-checklist"} mr-1`} />
				{isSelectionMode ? t("history:exitSelection") : t("history:selectionMode")}
			</Button>
		</StandardTooltip>
	)
}

export const SelectionModeHeader = ({
	isSelectionMode,
	tasks,
	selectedTaskIds,
	onToggleSelectAll,
}: {
	isSelectionMode: boolean
	tasks: DisplayHistoryItem[]
	selectedTaskIds: string[]
	onToggleSelectAll: (selectAll: boolean) => void
}) => {
	const { t } = useAppTranslation()
	if (!isSelectionMode || tasks.length === 0) return null
	const allSelected = selectedTaskIds.length === tasks.length
	return (
		<div className="flex items-center py-1">
			<div className="flex items-center gap-2">
				<Checkbox
					checked={allSelected}
					onCheckedChange={(checked) => onToggleSelectAll(checked === true)}
					variant="description"
				/>
				<span className="text-vscode-foreground">
					{allSelected ? t("history:deselectAll") : t("history:selectAll")}
				</span>
				<span className="ml-auto text-vscode-descriptionForeground text-xs">
					{t("history:selectedItems", { selected: selectedTaskIds.length, total: tasks.length })}
				</span>
			</div>
		</div>
	)
}

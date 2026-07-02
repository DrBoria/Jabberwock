import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { DropdownOptionType, isShortcutOrDisabledItem } from "../selects/select-dropdown-utils"
import type { DropdownOption } from "../selects/select-dropdown-utils"

export const DropdownItemComponent: React.FC<{
	option: DropdownOption
	index: number
	currentValue: string
	shortcutText: string
	itemClassName: string
	renderItem?: (option: DropdownOption) => React.ReactNode
	onSelect: (value: string) => void
}> = ({ option, index, currentValue, shortcutText, itemClassName, renderItem, onSelect }) => {
	if (option.type === DropdownOptionType.SEPARATOR)
		return (
			<div
				key={`sep-${index}`}
				className="mx-1 my-1 h-px bg-vscode-dropdown-foreground/10"
				data-testid="dropdown-separator"
			/>
		)
	if (isShortcutOrDisabledItem(option, shortcutText))
		return (
			<div key={`label-${index}`} className="px-3 py-1.5 text-sm opacity-50">
				{option.label}
			</div>
		)
	const isSelected = option.value === currentValue
	const itemKey = `item-${option.value || option.label || index}`
	return (
		<div
			key={itemKey}
			onClick={() => {
				if (!option.disabled) onSelect(option.value)
			}}
			className={cn(
				"px-3 py-1.5 text-sm cursor-pointer flex items-center",
				option.disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-vscode-list-hoverBackground",
				isSelected ? "bg-vscode-list-activeSelectionBackground text-vscode-list-activeSelectionForeground" : "",
				itemClassName,
			)}
			data-testid="dropdown-item">
			{renderItem ? (
				renderItem(option)
			) : (
				<>
					<span>{option.label}</span>
					{isSelected && <Check className="ml-auto size-4 p-0.5" />}
				</>
			)}
		</div>
	)
}

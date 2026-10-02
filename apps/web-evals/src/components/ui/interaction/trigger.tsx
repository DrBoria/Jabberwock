import { type VariantProps } from "class-variance-authority"
import { ChevronsUpDown } from "lucide-react"

import { multiSelectVariants, MultiSelectBadgeList, type MultiSelectVariant } from "./badges"

export interface MultiSelectProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof multiSelectVariants> {
	options: { label: string; value: string }[]
	onValueChange: (value: string[]) => void
	value?: string[]
	defaultValue?: string[]
	placeholder?: string
	maxCount?: number
	modalPopover?: boolean
	asChild?: boolean
	className?: string
	popoverAutoWidth?: boolean
	footer?: React.ReactNode
}

export function MultiSelectTriggerContent({
	selectedValues,
	variant,
	maxCount,
	placeholder,
	options,
	onToggleOption,
	onClearExtra,
}: {
	selectedValues: string[]
	variant: MultiSelectVariant | null | undefined
	maxCount: number
	placeholder: string
	options: { label: string; value: string }[]
	onToggleOption: (value: string) => void
	onClearExtra: () => void
}) {
	if (selectedValues.length === 0) {
		return (
			<div className="flex items-center justify-between w-full mx-auto">
				<span className="text-muted-foreground mx-3">{placeholder}</span>
				<ChevronsUpDown className="opacity-50 size-4 mx-2" />
			</div>
		)
	}
	return (
		<MultiSelectBadgeList
			selectedValues={selectedValues}
			maxCount={maxCount}
			variant={variant}
			options={options}
			onToggleOption={onToggleOption}
			onClearExtra={onClearExtra}
		/>
	)
}

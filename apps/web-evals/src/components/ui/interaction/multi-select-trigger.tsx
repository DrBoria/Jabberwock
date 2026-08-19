import { cva, type VariantProps } from "class-variance-authority"
import { X, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "../data-display/badge"

export const multiSelectVariants = cva("px-2 py-1", {
	variants: {
		variant: {
			default: "border-foreground/10 text-foreground bg-card hover:bg-card/80",
			secondary: "border-foreground/10 bg-secondary text-secondary-foreground hover:bg-secondary/80",
			destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
			inverted: "bg-background",
		},
	},
	defaultVariants: { variant: "default" },
})

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
	variant: "default" | "secondary" | "destructive" | "inverted" | null | undefined
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
		<div className="flex justify-between items-center w-full">
			<div className="flex flex-wrap items-center gap-1 p-1">
				{selectedValues.slice(0, maxCount).map((value) => (
					<Badge key={value} className={cn(multiSelectVariants({ variant }))}>
						<div className="flex items-center gap-1.5">
							<div>{options.find((o) => o.value === value)?.label}</div>
							<div
								onClick={(event) => {
									event.stopPropagation()
									onToggleOption(value)
								}}
								className="cursor-pointer">
								<X className="size-4 rounded-full p-0.5 bg-accent/5" />
							</div>
						</div>
					</Badge>
				))}
				{selectedValues.length > maxCount && (
					<Badge className={cn("text-ring", multiSelectVariants({ variant }))}>
						<div className="flex items-center gap-1.5">
							<div>{`+ ${selectedValues.length - maxCount} more`}</div>
							<div
								onClick={(event) => {
									event.stopPropagation()
									onClearExtra()
								}}
								className="cursor-pointer">
								<X className="size-4 rounded-full p-0.5 bg-ring/5" />
							</div>
						</div>
					</Badge>
				)}
			</div>
		</div>
	)
}

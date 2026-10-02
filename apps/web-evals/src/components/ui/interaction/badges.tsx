import { cva } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "../data-display/badge"

/**
 * Shared multi-select badge styling + listing, used by both `badges.tsx`
 * (this file) and `trigger.tsx`. Kept here so the two files share one
 * implementation (see `local/no-duplicated-logic`) without adding a file to
 * the `interaction/` folder (max 7, see `local/no-complex-folder-structure`).
 */
export const multiSelectVariants = cva("px-2 py-1", {
	variants: {
		variant: {
			default: "border-foreground/10 text-foreground bg-card hover:bg-card/80",
			secondary: "border-foreground/10 bg-secondary text-secondary-foreground hover:bg-secondary/80",
			destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
			inverted: "bg-background",
		},
	},
	defaultVariants: {
		variant: "default",
	},
})

export type MultiSelectVariant = "default" | "secondary" | "destructive" | "inverted"

export interface MultiSelectBadgeListProps {
	selectedValues: string[]
	maxCount: number
	variant: MultiSelectVariant | null | undefined
	options: { label: string; value: string }[]
	onToggleOption: (value: string) => void
	onClearExtra: () => void
}

export function MultiSelectBadgeList({
	selectedValues,
	maxCount,
	variant,
	options,
	onToggleOption,
	onClearExtra,
}: MultiSelectBadgeListProps) {
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

/**
 * Historical export name for {@link MultiSelectBadgeList} (preserves the
 * `@/components/ui/interaction` public API).
 */
export { MultiSelectBadgeList as MultiSelectBadges }

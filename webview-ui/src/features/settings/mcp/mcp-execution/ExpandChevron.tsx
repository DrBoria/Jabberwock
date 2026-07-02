import { ChevronDown } from "lucide-react"
import { cn } from "@src/lib/utils"
import { Button } from "@src/shared/ui/buttons/button"
import type { ExpandChevronProps } from "./types"

export const ExpandChevron = ({ responseText, isExpanded, onToggle }: ExpandChevronProps) =>
	responseText.length === 0 ? null : (
		<Button variant="ghost" size="icon" onClick={onToggle}>
			<ChevronDown className={cn("size-4 transition-transform duration-300", { "rotate-180": isExpanded })} />
		</Button>
	)

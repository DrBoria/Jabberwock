"use client"

import * as React from "react"
import {
	Provider as TooltipProvider,
	Root as Tooltip,
	Trigger as TooltipTrigger,
	Content as TooltipContentPrimitive,
	Portal as TooltipPortal,
} from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

console.debug("[tooltip.tsx] Importing Radix components...", {
	TooltipProvider,
	Tooltip,
	TooltipTrigger,
	TooltipContentPrimitive,
	TooltipPortal,
})

const TooltipContent = React.forwardRef<
	React.ElementRef<typeof TooltipContentPrimitive>,
	React.ComponentPropsWithoutRef<typeof TooltipContentPrimitive>
>(({ className, sideOffset = 4, ...props }, ref) => (
	<TooltipPortal>
		<TooltipContentPrimitive
			ref={ref}
			sideOffset={sideOffset}
			className={cn(
				"z-50 max-w-[300px] break-words rounded-md border bg-vscode-editorHoverWidget-background px-3 py-1.5 text-xs text-vscode-editorHoverWidget-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
				className,
			)}
			{...props}
		/>
	</TooltipPortal>
))
TooltipContent.displayName = "TooltipContent"

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }

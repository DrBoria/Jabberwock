import React from "react"
import { cn } from "@/lib/utils"

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	"aria-label": string
	variant?: "ghost" | "primary" | "secondary"
	size?: number
}

const variantStyles: Record<string, string> = {
	ghost: "text-vscode-foreground hover:bg-vscode-toolbar-hoverBackground",
	primary: "text-white bg-vscode-button-background hover:bg-vscode-button-hoverBackground",
	secondary:
		"text-vscode-button-secondaryForeground bg-vscode-button-secondaryBackground hover:bg-vscode-button-secondaryHoverBackground",
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
	({ variant = "ghost", size = 24, className, children, ...props }, ref) => {
		return (
			<button
				ref={ref}
				type="button"
				className={cn(
					"inline-flex items-center justify-center rounded-sm shrink-0",
					"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder",
					"disabled:opacity-50 disabled:cursor-not-allowed",
					variantStyles[variant],
					className,
				)}
				style={{ width: size, height: size }}
				{...props}>
				{children}
			</button>
		)
	},
)
IconButton.displayName = "IconButton"

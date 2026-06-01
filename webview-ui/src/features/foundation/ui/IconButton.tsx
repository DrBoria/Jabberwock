import React from "react"
import { cn } from "@/lib/utils"

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	/** Accessible label (required for icon-only buttons) */
	"aria-label": string
	/** Visual variant */
	variant?: "ghost" | "primary" | "secondary"
	/** Size in px */
	size?: number
}

const variantStyles: Record<string, string> = {
	ghost: "text-vscode-foreground hover:bg-vscode-toolbar-hoverBackground",
	primary: "text-white bg-vscode-button-background hover:bg-vscode-button-hoverBackground",
	secondary:
		"text-vscode-button-secondaryForeground bg-vscode-button-secondaryBackground hover:bg-vscode-button-secondaryHoverBackground",
}

/**
 * Pure presentational icon button.
 * All tailwind styles are internal — no business logic.
 */
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

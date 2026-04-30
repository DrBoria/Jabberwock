import React from "react"
import { cn } from "@/lib/utils"

export interface LoadingSpinnerProps {
	/** Size in px (default: 16) */
	size?: number
	/** Additional CSS classes */
	className?: string
}

/**
 * Pure presentational loading spinner.
 * Renders a rotating SVG circle.
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 16, className }) => {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			className={cn("animate-spin shrink-0", className)}
			role="status"
			aria-label="Loading">
			<circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
			<path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
		</svg>
	)
}
LoadingSpinner.displayName = "LoadingSpinner"

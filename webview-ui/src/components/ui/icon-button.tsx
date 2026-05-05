import { forwardRef } from "react"
import { cn } from "@/lib/utils"
import { Button } from "./button"
import { StandardTooltip } from "./standard-tooltip"
import { Loader2, type LucideIcon } from "lucide-react"

/**
 * Props for the unified IconButton.
 *
 * Supports two icon modes:
 * - Codicon: pass `iconClass` (e.g. "codicon-check")
 * - Lucide: pass `icon` (a LucideIcon component)
 */
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	/** Accessible label / tooltip text */
	title: string
	disabled?: boolean
	/** Whether to show the tooltip (default: true) */
	tooltip?: boolean
	isLoading?: boolean
	style?: React.CSSProperties
	/** Codicon icon class (e.g. "codicon-check") — use this OR `icon` */
	iconClass?: string
	/** Lucide icon component — use this OR `iconClass` */
	icon?: LucideIcon
}

/**
 * Unified IconButton that supports both Codicon and Lucide icons,
 * with tooltip and loading state.
 *
 * @example
 * // Codicon usage
 * <IconButton title="Check" iconClass="codicon-check" onClick={handleClick} />
 *
 * @example
 * // Lucide usage
 * <IconButton title="Download" icon={DownloadIcon} onClick={handleClick} />
 *
 * @example
 * // Loading state
 * <IconButton title="Saving" icon={SaveIcon} isLoading />
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
	({ icon, iconClass, title, className, disabled, tooltip = true, isLoading, onClick, style, ...props }, ref) => {
		const Icon = icon

		const buttonContent = (
			<Button
				ref={ref}
				aria-label={title}
				className={cn(
					"relative inline-flex items-center justify-center",
					"bg-transparent border-none p-1.5",
					"rounded-md min-w-[28px] min-h-[28px]",
					"text-vscode-foreground opacity-85",
					"transition-all duration-150",
					"focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder",
					"active:bg-[rgba(255,255,255,0.1)]",
					!disabled && "cursor-pointer hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)]",
					disabled &&
						"opacity-40 cursor-not-allowed grayscale-[30%] hover:bg-transparent active:bg-transparent",
					className,
				)}
				disabled={disabled}
				onClick={!disabled ? onClick : undefined}
				style={{ fontSize: 16.5, ...style }}
				{...props}>
				{isLoading ? (
					<Loader2 className="size-2.5 animate-spin" />
				) : iconClass ? (
					<span className={cn("codicon", iconClass)} />
				) : Icon ? (
					<Icon className="size-2.5" />
				) : null}
			</Button>
		)

		if (tooltip && title) {
			return <StandardTooltip content={title}>{buttonContent}</StandardTooltip>
		}

		return buttonContent
	},
)

IconButton.displayName = "IconButton"

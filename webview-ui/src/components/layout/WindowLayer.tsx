import React, { useEffect, useState } from "react"
import { useWindowManager } from "../../context/WindowManagerContext"

interface WindowLayerProps {
	id: string
	children: React.ReactNode
	zIndex?: number
	index: number
	fullScreen?: boolean
	isActive: boolean
	isInStack: boolean
}

export const WindowLayer: React.FC<WindowLayerProps> = ({
	id,
	children,
	zIndex = 10,
	fullScreen = true,
	isActive,
	isInStack,
	index,
}) => {
	const { popWindow } = useWindowManager()

	// Since we want standard CSS animations, we will maintain an `isVisible` local state
	// that tracks when it should be rendered to the DOM vs unmounted or hidden.
	const [isRendered, setIsRendered] = useState(isInStack)
	const [opacity, setOpacity] = useState(0)

	useEffect(() => {
		if (isInStack) {
			setIsRendered(true)
			// Trigger a reflow to start the transition
			requestAnimationFrame(() => requestAnimationFrame(() => setOpacity(1)))
		} else {
			setOpacity(0)
			// Wait for the transition to finish before unmounting completely
			const timer = setTimeout(() => setIsRendered(false), 300)
			return () => clearTimeout(timer)
		}
	}, [isInStack])

	if (!isRendered) {
		return null
	}

	// Calculate transformation effect.
	// The user wants a 40px offset for underlying windows so the edge is visible.
	const offset = index * 40
	const transform = isActive ? `translateX(${offset}px) scale(1)` : `translateX(${offset}px) scale(0.98)`
	const filter = isActive ? "none" : "blur(1px) brightness(0.9)"

	return (
		<div
			className="window-layer"
			data-window-type={id}
			data-active={isActive}
			style={{
				position: fullScreen ? "absolute" : "relative",
				top: 0,
				left: 0,
				width: `calc(100% - ${offset}px)`,
				height: "100%",
				zIndex: zIndex,
				opacity: opacity,
				transform,
				filter,
				transition: "opacity 0.3s ease, transform 0.3s ease, filter 0.3s ease, left 0.3s ease, width 0.3s ease",
				backgroundColor: "var(--vscode-editor-background)",
				pointerEvents: isActive ? "auto" : "none",
				overflow: "hidden",
				boxShadow: isActive ? "-20px 0 40px rgba(0,0,0,0.3)" : "none",
			}}>
			{/* Side Stripe for underlying windows to allow clicking back */}
			{!isActive && (
				<div
					className="absolute left-0 top-0 w-[40px] h-full cursor-pointer hover:bg-vscode-toolbar-hoverBackground transition-colors pointer-events-auto flex flex-col items-center py-4 group"
					onClick={(e) => {
						e.stopPropagation()
						popWindow()
					}}>
					<div className="vertical-text opacity-30 group-hover:opacity-100 transition-opacity font-medium text-[10px]">
						{id}
					</div>
				</div>
			)}

			<div
				className={cn(
					"h-full w-full bg-vscode-editor-background transition-all",
					!isActive && "opacity-50 grayscale",
				)}>
				{children}
			</div>
		</div>
	)
}

function cn(...classes: any[]) {
	return classes.filter(Boolean).join(" ")
}

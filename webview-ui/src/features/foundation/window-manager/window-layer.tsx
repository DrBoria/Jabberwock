import React, { useEffect, useState } from "react"
import { useWindowManager } from "./store"

interface WindowLayerProps {
	id: string
	children: React.ReactNode
	zIndex?: number
	index: number
	fullScreen?: boolean
	isActive: boolean
	isInStack: boolean
}

function getWindowPosition(fullScreen: boolean): React.CSSProperties["position"] {
	return fullScreen ? "absolute" : "relative"
}

function getWindowPointerEvents(isActive: boolean): React.CSSProperties["pointerEvents"] {
	return isActive ? "auto" : "none"
}

function getWindowBoxShadow(isActive: boolean): React.CSSProperties["boxShadow"] {
	return isActive ? "-20px 0 40px rgba(0,0,0,0.3)" : "none"
}

function WindowLayerStripe({
	id,
	index,
	popWindow,
}: {
	id: string
	index: number
	popWindow: (index: number) => void
}) {
	return (
		<div
			data-testid={`window-layer-stripe-${id}`}
			className="absolute left-0 top-0 w-[40px] h-full cursor-pointer hover:bg-vscode-toolbar-hoverBackground transition-colors pointer-events-auto flex flex-col items-center py-4 group"
			onClick={(e) => {
				e.stopPropagation()
				popWindow(index)
			}}>
			<div className="vertical-text opacity-30 group-hover:opacity-100 transition-opacity font-medium text-[10px]">
				{id}
			</div>
		</div>
	)
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

	const [isRendered, setIsRendered] = useState(isInStack)
	const [opacity, setOpacity] = useState(0)

	useEffect(() => {
		if (isInStack) {
			setIsRendered(true)
			requestAnimationFrame(() => requestAnimationFrame(() => setOpacity(1)))
		} else {
			setOpacity(0)
			const timer = setTimeout(() => setIsRendered(false), 300)
			return () => clearTimeout(timer)
		}
	}, [isInStack])

	if (!isRendered) {
		return null
	}

	const offset = index * 40
	const transform = `translateX(${offset}px) scale(${isActive ? 1 : 0.98})`
	const filter = isActive ? "none" : "blur(1px) brightness(0.9)"
	const position = getWindowPosition(fullScreen)
	const pointerEvents = getWindowPointerEvents(isActive)
	const boxShadow = getWindowBoxShadow(isActive)

	return (
		<div
			className="window-layer"
			data-window-type={id}
			data-testid={`window-layer-${id}`}
			data-active={isActive}
			style={{
				position,
				top: 0,
				left: 0,
				width: `calc(100% - ${offset}px)`,
				height: "100%",
				zIndex,
				opacity,
				transform,
				filter,
				transition: "opacity 0.3s ease, transform 0.3s ease, filter 0.3s ease, left 0.3s ease, width 0.3s ease",
				backgroundColor: "var(--vscode-editor-background)",
				pointerEvents,
				overflow: "hidden",
				boxShadow,
			}}>
			{!isActive && <WindowLayerStripe id={id} index={index} popWindow={popWindow} />}

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

function cn(...classes: (string | boolean | null | undefined)[]) {
	return classes.filter(Boolean).join(" ")
}

import React, { createContext, useContext, useState, useCallback, useMemo } from "react"

export type WindowType =
	| "chat"
	| "history"
	| "settings"
	| "marketplace"
	| "cloud"
	| "async_task"
	| "interactive_mcp"
	| "task_hierarchy"

interface WindowState {
	type: WindowType
	props?: any
}

interface WindowManagerContextType {
	activeWindows: WindowState[]
	pushWindow: (type: WindowType, props?: any) => void
	popWindow: () => void
	switchToBaseWindow: (type: WindowType, props?: any) => void
	isWindowActive: (type: WindowType) => boolean
}

const WindowManagerContext = createContext<WindowManagerContextType | undefined>(undefined)

export const WindowManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [activeWindows, setActiveWindows] = useState<WindowState[]>([{ type: "chat" }])

	const pushWindow = useCallback((type: WindowType, props?: any) => {
		setActiveWindows((prev) => {
			// Avoid duplicates of the same exact type at the top of the stack
			if (prev[prev.length - 1]?.type === type) return prev
			return [...prev, { type, props }]
		})
	}, [])

	const popWindow = useCallback(() => {
		setActiveWindows((prev) => {
			if (prev.length <= 1) return prev // Always keep base window
			return prev.slice(0, -1)
		})
	}, [])

	const switchToBaseWindow = useCallback((type: WindowType, props?: any) => {
		setActiveWindows([{ type, props }])
	}, [])

	const isWindowActive = useCallback(
		(type: WindowType) => {
			return activeWindows[activeWindows.length - 1]?.type === type
		},
		[activeWindows],
	)

	const value = useMemo(
		() => ({ activeWindows, pushWindow, popWindow, switchToBaseWindow, isWindowActive }),
		[activeWindows, pushWindow, popWindow, switchToBaseWindow, isWindowActive],
	)

	return <WindowManagerContext.Provider value={value}>{children}</WindowManagerContext.Provider>
}

export const useWindowManager = () => {
	const context = useContext(WindowManagerContext)
	if (!context) {
		throw new Error("useWindowManager must be used within a WindowManagerProvider")
	}
	return context
}

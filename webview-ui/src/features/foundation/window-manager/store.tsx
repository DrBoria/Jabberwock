import React, { createContext, useContext } from "react"
import { types, Instance } from "mobx-state-tree"

export const WindowType = types.enumeration("WindowType", [
	"chat",
	"history",
	"settings",
	"marketplace",
	"cloud",
	"async_task",
	"interactive_mcp",
	"task_hierarchy",
])

export type WindowTypeValue = Instance<typeof WindowType>

export const WindowState = types.model("WindowState", {
	type: WindowType,
	props: types.maybe(types.frozen<any>()),
})

export const WindowManagerStore = types
	.model("WindowManagerStore", {
		activeWindows: types.array(WindowState),
	})
	.actions((self) => ({
		pushWindow(type: WindowTypeValue, props?: any) {
			// Avoid duplicates of the same exact type at the top of the stack
			if (self.activeWindows.length > 0 && self.activeWindows[self.activeWindows.length - 1].type === type) return
			self.activeWindows.push({ type, props })
		},
		popWindow() {
			if (self.activeWindows.length <= 1) return // Always keep base window
			self.activeWindows.pop()
		},
		switchToBaseWindow(type: WindowTypeValue, props?: any) {
			self.activeWindows.clear()
			self.activeWindows.push({ type, props })
		},
	}))
	.views((self) => ({
		get topWindow() {
			if (self.activeWindows.length === 0) return undefined
			return self.activeWindows[self.activeWindows.length - 1]
		},
		isWindowOpen(type: WindowTypeValue) {
			return self.activeWindows.some((w) => w.type === type)
		},
		isWindowActive(type: WindowTypeValue) {
			if (self.activeWindows.length === 0) return false
			return self.activeWindows[self.activeWindows.length - 1]?.type === type
		},
	}))

export type IWindowManagerStore = Instance<typeof WindowManagerStore>

export const windowManagerStore = WindowManagerStore.create({
	activeWindows: [{ type: "chat" }],
})

// ── React Context bridge (so components can use useWindowManager() hook) ──

const WindowManagerContext = createContext<IWindowManagerStore | undefined>(undefined)

export const WindowManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	return <WindowManagerContext.Provider value={windowManagerStore}>{children}</WindowManagerContext.Provider>
}

export const useWindowManager = (): IWindowManagerStore => {
	const context = useContext(WindowManagerContext)
	if (!context) {
		throw new Error("useWindowManager must be used within a WindowManagerProvider")
	}
	return context
}

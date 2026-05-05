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
			const top = self.activeWindows[self.activeWindows.length - 1]
			if (top) {
				// Allow multiple chat windows if they are for different task nodes
				if (type === "chat" && top.type === "chat") {
					const topTargetId = top.props?.targetNodeId
					const newTargetId = props?.targetNodeId
					if (topTargetId === newTargetId) return // Same task, skip
					// Different targetNodeId → push on top (creates overlay)
				} else if (top.type === type) {
					return // Same non-chat type → skip
				}
			}
			self.activeWindows.push({ type, props })
		},
		popWindow(index?: number) {
			if (self.activeWindows.length <= 1) return // Always keep base window
			if (index !== undefined) {
				// Pop all windows above the given index
				self.activeWindows.splice(index + 1)
			} else {
				self.activeWindows.pop()
			}
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

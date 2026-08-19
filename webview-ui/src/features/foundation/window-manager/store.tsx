import { types, Instance } from "mobx-state-tree"

import { vscode } from "@jabberwock/devtool/webview"
import type { WebviewMessage, ShareVisibility } from "@jabberwock/types"
import { eventConstants } from "@jabberwock/types"

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
	props: types.frozen<Record<string, unknown>>(),
})

export const WindowManagerStore = types
	.model("WindowManagerStore", {
		activeWindows: types.array(WindowState),
	})
	// ── Block 1: Window stack operations ────────────────────────────────
	.actions((self) => ({
		pushWindow(type: WindowTypeValue, props: Record<string, unknown> = {}) {
			const _beforeLen = self.activeWindows.length
			const beforeTypes = self.activeWindows.map((w) => w.type).join(",")
			const top = self.activeWindows[self.activeWindows.length - 1]
			if (top) {
				// Allow multiple chat windows if they are for different task nodes
				if (type === "chat" && top.type === "chat") {
					const topTargetId = top.props?.targetNodeId
					const newTargetId = props?.targetNodeId
					if (topTargetId === newTargetId) {
						console.log(
							`[DEBUG:MST] pushWindow SKIP (same chat node): type=${type} topTargetId=${topTargetId} newTargetId=${newTargetId} before=[${beforeTypes}]`,
						)
						return // Same task, skip
					}
					console.log(
						`[DEBUG:MST] pushWindow CHAT OVERLAY: type=${type} topTargetId=${topTargetId} -> newTargetId=${newTargetId}`,
					)
					// Different targetNodeId → push on top (creates overlay)
				} else if (top.type === type) {
					console.log(
						`[DEBUG:MST] pushWindow SKIP (same non-chat type): type=${type} before=[${beforeTypes}]`,
					)
					return // Same non-chat type → skip
				}
			}
			console.log(
				`[DEBUG:MST] pushWindow EXECUTE: type=${type} props=${JSON.stringify(props)} before=[${beforeTypes}] after=[${beforeTypes},${type}]`,
			)
			self.activeWindows.push({ type, props })
		},
		popWindow(index?: number) {
			const _beforeLen = self.activeWindows.length
			const beforeTypes = self.activeWindows.map((w) => w.type).join(",")
			console.log(`[DEBUG:MST] popWindow CALLED: index=${index} before=[${beforeTypes}] len=${_beforeLen}`)
			if (self.activeWindows.length <= 1) {
				console.log(`[DEBUG:MST] popWindow SKIP (only base window): before=[${beforeTypes}]`)
				return // Always keep base window
			}
			if (index !== undefined) {
				// Capture types BEFORE splice — removed nodes are dead to MST
				const removedTypes = self.activeWindows
					.slice(index + 1)
					.map((w) => w.type)
					.join(",")
				self.activeWindows.splice(index + 1)
				const afterTypes = self.activeWindows.map((w) => w.type).join(",")
				console.log(
					`[DEBUG:MST] popWindow DONE (splice above ${index}): removed=[${removedTypes}] after=[${afterTypes}]`,
				)
			} else {
				const poppedType =
					self.activeWindows.length > 0 ? self.activeWindows[self.activeWindows.length - 1].type : undefined
				self.activeWindows.pop()
				const afterTypes = self.activeWindows.map((w) => w.type).join(",")
				console.log(`[DEBUG:MST] popWindow DONE (pop last): popped=${poppedType} after=[${afterTypes}]`)
			}
		},
		switchToBaseWindow(type: WindowTypeValue, props: Record<string, unknown> = {}) {
			const beforeTypes = self.activeWindows.map((w) => w.type).join(",")
			console.log(
				`[DEBUG:MST] switchToBaseWindow: type=${type} props=${JSON.stringify(props)} before=[${beforeTypes}]`,
			)
			self.activeWindows.clear()
			self.activeWindows.push({ type, props })
			console.log(`[DEBUG:MST] switchToBaseWindow DONE: after=[${type}]`)
		},
	}))
	// ── Block 2: Views ───────────────────────────────────────────────────
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
	// ── Block 3: Window manager actions (formerly createWindowManagerActions) ──
	.actions((_self) => ({
		// ── Tab switching ──────────────────────────────────────────────
		switchTab(
			tab: "settings" | "history" | "mcp" | "modes" | "chat" | "marketplace" | "cloud",
			values?: Record<string, unknown>,
		) {
			vscode.postMessage({
				type: eventConstants.WINDOW_MANAGER.SWITCH_TAB,
				tab,
				...(values !== undefined && { values }),
			} satisfies WebviewMessage)
		},

		// ── Webview did launch ────────────────────────────────────────
		webviewDidLaunch() {
			vscode.postMessage({
				type: eventConstants.CHAT.TASK.WEBVIEW_DID_LAUNCH,
			} satisfies WebviewMessage)
		},

		// ── Focus panel request ────────────────────────────────────────
		focusPanelRequest() {
			vscode.postMessage({
				type: eventConstants.WINDOW_MANAGER.FOCUS_PANEL_REQUEST,
			} satisfies WebviewMessage)
		},

		// ── Respond with active page ──────────────────────────────────
		respondWithActivePage(requestId: string, activePage: string) {
			vscode.postMessage({
				type: eventConstants.WINDOW_MANAGER.ACTIVE_PAGE_RESPONSE,
				requestId,
				activePage,
			} satisfies WebviewMessage)
		},

		// ── Share current task ────────────────────────────────────────
		shareCurrentTask(visibility: ShareVisibility) {
			vscode.postMessage({
				type: eventConstants.WINDOW_MANAGER.EXPORT_CURRENT_TASK,
				visibility,
			} satisfies WebviewMessage)
		},

		// ── Focus panel ───────────────────────────────────────────────
		focusPanel() {
			vscode.postMessage({
				type: eventConstants.WINDOW_MANAGER.FOCUS_PANEL_REQUEST,
			} satisfies WebviewMessage)
		},

		// ── Batch file response ───────────────────────────────────────
		batchFileResponse(response: { [key: string]: boolean }) {
			vscode.postMessage({
				type: "batchFileResponse" as const,
				response,
			} satisfies WebviewMessage)
		},
	}))

export type IWindowManagerStore = Instance<typeof WindowManagerStore>
import { useRootStore } from "../../useRootStore"

/**
 * Backward-compatible hook for consuming components.
 * Returns the WindowManager store from the root store singleton.
 * Components should migrate to `useRootStore().windowManager` directly.
 */
export const useWindowManager = (): IWindowManagerStore => useRootStore().windowManager

// 🔴 DUAL INSTANTIATION BUG: This singleton is registered with MstBridge (index.tsx:42)
// AND RootStore creates a separate instance (root-store.ts:201).
// MstBridge patches THIS instance — rootStore.windowManager does NOT receive those patches.
export const windowManagerStore = WindowManagerStore.create({
	activeWindows: [{ type: "chat", props: {} }],
})

import { types, Instance } from "mobx-state-tree"
import type { DisposableLike } from "@jabberwock/types"
import WorkspaceTracker from "@integrations/workspace/WorkspaceTracker"
import {
	WebviewViewType,
	DisposablesType,
	PendingDomRequestsType,
	PendingActivePageRequestsType,
	PendingPushTimersType,
	StoreRefType,
	type HostWebViewRef,
} from "@features/mst-custom-types"

// window-manager store model + shared state types.
// Leaf module (no back-imports to the store hub) so leaves (messaging/state-utils)
// can pull IWindowManagerModel / WebviewStatePayload / PUSH_DEBOUNCE_MS without a cycle.

export const WindowManagerModel = types
	.model("Window", {
		view: WebviewViewType,
		disposables: DisposablesType,
		webviewDisposables: DisposablesType,
		viewLaunched: types.boolean,
		workspaceStore: StoreRefType,
		workspaceTracker: StoreRefType,
		pendingDomRequests: PendingDomRequestsType,
		pendingActivePageRequests: PendingActivePageRequestsType,
		pendingPushTimers: PendingPushTimersType,
	})
	.actions((self) => ({
		setView(view: HostWebViewRef) {
			self.view = view
		},
		setViewLaunched(val: boolean) {
			self.viewLaunched = val
		},
		setWorkspaceStore(store: WorkspaceStoreData) {
			self.workspaceStore = store
		},
		setWorkspaceTracker(tracker: WorkspaceStoreData) {
			self.workspaceTracker = tracker
		},
		addDisposable(d: DisposableLike) {
			self.disposables.push(d)
		},
		addWebviewDisposable(d: DisposableLike) {
			self.webviewDisposables.push(d)
		},
		clearWebviewDisposables() {
			self.webviewDisposables.splice(0, self.webviewDisposables.length)
		},
		setDomRequestCallback(
			requestId: string,
			callback: (result: string) => void,
			type: string,
			params: { [key: string]: unknown },
		) {
			self.pendingDomRequests.set(requestId, {
				callback,
				meta: { requestId, type, params, timestamp: Date.now(), status: "pending" as const },
			})
		},
		resolveDomRequest(requestId: string, result: string, connector?: string) {
			const entry = self.pendingDomRequests.get(requestId)
			if (entry) {
				entry.meta.status = "resolved"
				entry.callback(result, connector)
				self.pendingDomRequests.delete(requestId)
			}
		},
		setActivePageRequestCallback(requestId: string, callback: (activePage: string, connector?: string) => void) {
			self.pendingActivePageRequests.set(requestId, callback)
		},
		resolveActivePageRequest(requestId: string, activePage: string, connector?: string) {
			const cb = self.pendingActivePageRequests.get(requestId)
			if (cb) {
				cb(activePage, connector)
				self.pendingActivePageRequests.delete(requestId)
			}
		},
		scheduleStatePush(callback: () => void, ms: number) {
			const existing = self.pendingPushTimers.get("push")
			if (existing) clearTimeout(existing)
			const timer = setTimeout(() => {
				self.pendingPushTimers.delete("push")
				callback()
			}, ms)
			self.pendingPushTimers.set("push", timer)
		},
		clearPendingPushTimers() {
			for (const [, timer] of self.pendingPushTimers) {
				clearTimeout(timer)
			}
			self.pendingPushTimers.clear()
		},
	}))

export type IWindowManagerModel = Instance<typeof WindowManagerModel>

export type WorkspaceStoreData = { [key: string]: unknown } | null

export type WebviewStatePayload = { [key: string]: unknown }

export interface WindowManagerState {
	// v4 B2 (L14): structural host-view/disposable shapes — no vscode types in the state surface.
	view: HostWebViewRef
	disposables: DisposableLike[]
	webviewDisposables: DisposableLike[]
	viewLaunched: boolean
	workspaceStore: WorkspaceStoreData
	workspaceTracker: WorkspaceTracker | null
	pendingDomRequests: Map<string, (result: string) => void>
	pendingActivePageRequests: Map<string, (activePage: string) => void>
}

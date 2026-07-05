import * as vscode from "vscode"
import { types, Instance } from "mobx-state-tree"
import WorkspaceTracker from "@integrations/workspace/WorkspaceTracker"
import {
	WebviewViewType,
	DisposablesType,
	PendingDomRequestsType,
	PendingActivePageRequestsType,
	PendingPushTimersType,
	StoreRefType,
} from "@features/mst-custom-types"

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
		setView(view: vscode.WebviewView | vscode.WebviewPanel | null) {
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
		addDisposable(d: vscode.Disposable) {
			self.disposables.push(d)
		},
		addWebviewDisposable(d: vscode.Disposable) {
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
		resolveDomRequest(requestId: string, result: string) {
			const entry = self.pendingDomRequests.get(requestId)
			if (entry) {
				entry.meta.status = "resolved"
				entry.callback(result)
				self.pendingDomRequests.delete(requestId)
			}
		},
		setActivePageRequestCallback(requestId: string, callback: (activePage: string) => void) {
			self.pendingActivePageRequests.set(requestId, callback)
		},
		resolveActivePageRequest(requestId: string, activePage: string) {
			const cb = self.pendingActivePageRequests.get(requestId)
			if (cb) {
				cb(activePage)
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
	view: vscode.WebviewView | vscode.WebviewPanel | null
	disposables: vscode.Disposable[]
	webviewDisposables: vscode.Disposable[]
	viewLaunched: boolean
	workspaceStore: WorkspaceStoreData
	workspaceTracker: WorkspaceTracker | null
	pendingDomRequests: Map<string, (result: string) => void>
	pendingActivePageRequests: Map<string, (activePage: string) => void>
}

export const PUSH_DEBOUNCE_MS = 50

// ─── Re-exports from store/ sub-modules ──────────────────────────────
import {
	initWindowManagerState as _initWindowManagerState,
	getWindowManagerState as _getWindowManagerState,
	getWorkspaceTracker as _getWorkspaceTracker,
	resolveActivePageRequest as _resolveActivePageRequest,
} from "./store/state-utils"
export const initWindowManagerState = _initWindowManagerState
export const getWindowManagerState = _getWindowManagerState
export const getWorkspaceTracker = _getWorkspaceTracker
export const resolveActivePageRequest = _resolveActivePageRequest

import { resolveWebviewView as _resolveWebviewView } from "./store/webview-setup"
import type { WebviewMessageHandler as _WebviewMessageHandler } from "./store/webview-setup"
export const resolveWebviewView = _resolveWebviewView
export type { _WebviewMessageHandler as WebviewMessageHandler }

import {
	scheduleStatePush as _scheduleStatePush,
	postMessageToWebview as _postMessageToWebview,
	postStateToWebview as _postStateToWebview,
	postStateToWebviewWithoutMessages as _postStateToWebviewWithoutMessages,
	postStateToWebviewWithoutTaskHistory as _postStateToWebviewWithoutTaskHistory,
	refreshWorkspace as _refreshWorkspace,
} from "./store/messaging"
import type { WebviewOutboundMessage as _WebviewOutboundMessage } from "./store/messaging"
export const scheduleStatePush = _scheduleStatePush
export const postMessageToWebview = _postMessageToWebview
export const postStateToWebview = _postStateToWebview
export const postStateToWebviewWithoutMessages = _postStateToWebviewWithoutMessages
export const postStateToWebviewWithoutTaskHistory = _postStateToWebviewWithoutTaskHistory
export const refreshWorkspace = _refreshWorkspace
export type { _WebviewOutboundMessage as WebviewOutboundMessage }

import { handleModeSwitch as _handleModeSwitch } from "./store/mode-utils"
export const handleModeSwitch = _handleModeSwitch

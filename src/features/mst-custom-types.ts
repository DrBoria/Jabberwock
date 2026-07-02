import { types } from "mobx-state-tree"
import * as vscode from "vscode"
import type WorkspaceTracker from "@integrations/workspace/WorkspaceTracker"

// ─── Non-serializable type aliases ──────────────────────────────────────────

type DomRequestCallback = (result: string) => void
type ActivePageCallback = (activePage: string) => void
type TaskCreationCallback = (instance: Record<string, unknown>) => void

export interface ChatNode {
	addMessage(msg: Record<string, unknown>): void
	syncUiMessages(msgs: unknown[]): void
	setMode(mode: string): void
}

type BranchCallback = (parentId: string, label: string, taskId: string) => void
type SwitchContextCallback = (taskId: string) => void

// ─── types.custom() wrappers ───────────────────────────────────────────────

/**
 * Wraps a vscode.WebviewView or vscode.WebviewPanel reference.
 * Snapshot is an empty string — the actual view cannot be serialized.
 */
export const WebviewViewType = types.custom<string, vscode.WebviewView | vscode.WebviewPanel | null>({
	name: "WebviewView",
	fromSnapshot(_snapshot: string) {
		return null
	},
	toSnapshot(_value: vscode.WebviewView | vscode.WebviewPanel | null) {
		return ""
	},
	isTargetType(value: unknown): value is vscode.WebviewView | vscode.WebviewPanel {
		return value !== null && typeof value === "object" && "webview" in value
	},
	getValidationMessage() {
		return ""
	},
})

/**
 * Wraps an array of vscode.Disposable.
 * Snapshot is the count of disposables.
 */
export const DisposablesType = types.custom<string, vscode.Disposable[]>({
	name: "Disposables",
	fromSnapshot(_snapshot: string) {
		return []
	},
	toSnapshot(value: vscode.Disposable[]) {
		return `disposables_${value.length}`
	},
	isTargetType(value: unknown): value is vscode.Disposable[] {
		return Array.isArray(value)
	},
	getValidationMessage() {
		return ""
	},
})

export interface PendingDomRequestMeta {
	requestId: string
	type: string
	params: Record<string, unknown>
	timestamp: number
	status: "pending" | "resolved" | "timeout"
}

/**
 * Wraps Map<string, { callback, meta }> for pending DOM request callbacks.
 * Snapshot is the list of pending request metadata.
 */
export const PendingDomRequestsType = types.custom<
	PendingDomRequestMeta[],
	Map<string, { callback: DomRequestCallback; meta: PendingDomRequestMeta }>
>({
	name: "PendingDomRequests",
	fromSnapshot(_snapshot: PendingDomRequestMeta[]) {
		return new Map()
	},
	toSnapshot(value: Map<string, { callback: DomRequestCallback; meta: PendingDomRequestMeta }>) {
		return Array.from(value.entries()).map(([requestId, callback]) => ({
			requestId,
			type: "",
			params: {},
			timestamp: Date.now(),
			status: "pending" as const,
		}))
	},
	isTargetType(value: unknown): value is Map<string, { callback: DomRequestCallback; meta: PendingDomRequestMeta }> {
		return value instanceof Map
	},
	getValidationMessage() {
		return ""
	},
})

/**
 * Wraps Map<string, ActivePageCallback> for pending active-page request callbacks.
 * Snapshot is the list of pending request IDs.
 */
export const PendingActivePageRequestsType = types.custom<string[], Map<string, ActivePageCallback>>({
	name: "PendingActivePageRequests",
	fromSnapshot(_snapshot: string[]) {
		return new Map()
	},
	toSnapshot(value: Map<string, ActivePageCallback>) {
		return Array.from(value.keys())
	},
	isTargetType(value: unknown): value is Map<string, ActivePageCallback> {
		return value instanceof Map
	},
	getValidationMessage() {
		return ""
	},
})

/**
 * Wraps a function reference (callback).
 * Snapshot is the function name or "anonymous".
 */
export const CallbackType = types.custom<string, (...args: unknown[]) => unknown>({
	name: "Callback",
	fromSnapshot(_snapshot: string) {
		return () => {}
	},
	toSnapshot(value: (...args: unknown[]) => unknown) {
		return `fn_${value.name || "anonymous"}`
	},
	isTargetType(value: unknown): boolean {
		return typeof value === "function"
	},
	getValidationMessage() {
		return ""
	},
})

/**
 * Wraps Map<string, ChatNode> for messages nodes.
 * Snapshot is the list of node keys.
 */
export const NodesMapType = types.custom<string[], Map<string, ChatNode>>({
	name: "NodesMap",
	fromSnapshot(_snapshot: string[]) {
		return new Map()
	},
	toSnapshot(value: Map<string, ChatNode>) {
		return Array.from(value.keys())
	},
	isTargetType(value: unknown): value is Map<string, ChatNode> {
		return value instanceof Map
	},
	getValidationMessage() {
		return ""
	},
})

/**
 * Wraps Map<string, Timeout> for pending push timers.
 * Snapshot is the list of timer IDs.
 */
export const PendingPushTimersType = types.custom<string[], Map<string, ReturnType<typeof setTimeout>>>({
	name: "PendingPushTimers",
	fromSnapshot(_snapshot: string[]) {
		return new Map()
	},
	toSnapshot(value: Map<string, ReturnType<typeof setTimeout>>) {
		return Array.from(value.keys())
	},
	isTargetType(value: unknown): value is Map<string, ReturnType<typeof setTimeout>> {
		return value instanceof Map
	},
	getValidationMessage() {
		return ""
	},
})

/**
 * Wraps a reference to a generic object (store instances, WorkspaceTracker, etc.).
 * Snapshot is a descriptive label.
 */
export const StoreRefType = types.custom<string, Record<string, unknown> | null>({
	name: "StoreRef",
	fromSnapshot(_snapshot: string) {
		return null
	},
	toSnapshot(value: Record<string, unknown> | null) {
		return value ? "store_ref" : ""
	},
	isTargetType(value: unknown): boolean {
		return value === null || typeof value === "object"
	},
	getValidationMessage() {
		return ""
	},
})

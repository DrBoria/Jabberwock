/**
 * Shared types for the devtool package: diagnostics shapes, the store adapter
 * contract, framework labels, and bridge/model contracts. These are the only
 * cross-domain types in the package. Diagnostic shapes are inlined (not
 * imported from a host workspace package) so the package stays publishable.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

// ── Diagnostics ───────────────────────────────────────────────────────────────

/** Diagnostic level for log messages. */
export type DiagnosticLevel = "info" | "warn" | "error" | "debug"

/** A single diagnostic log entry. */
export interface DiagnosticLog {
	timestamp: number
	message: string
	level: DiagnosticLevel
}

/**
 * Performance metric for a specific operation.
 */
export interface PerformanceMetric {
	id: string
	name: string
	durationMs: number
	status: "success" | "failure" | "pending"
	timestamp: number
}

/**
 * Snapshot of system resources.
 */
export interface ResourceSnapshot {
	timestamp: number
	memoryUsage: {
		rss: number
		heapTotal: number
		heapUsed: number
	}
	cpuUsage: number // Percentage (0-100)
}

/**
 * A single MST (MobX-State-Tree) incremental patch.
 */
export interface MstPatch {
	timestamp: number
	op: "add" | "remove" | "replace"
	path: string
	value?: unknown
}

/**
 * Full state snapshot for the diagnostics dashboard.
 */
export interface DiagnosticSnapshot {
	logs: DiagnosticLog[]
	metrics: PerformanceMetric[]
	resources: ResourceSnapshot[]
	mstPatches?: MstPatch[]
	currentAction?: string
}

// ── Store adapter contract ────────────────────────────────────────────────────

/** Which side of the app a store lives on. */
export type StoreEnv = "backend" | "frontend"

/** A single action/method that can be invoked on a store. */
export interface ActionEntry {
	/** Dot-separated path to the action (e.g. "chat.sendMessage"). */
	key: string
	/** Runtime type of the action value ("function" | "array" | ...). */
	type: string
	/** Truncated JSON preview of the action value. */
	value: string
}

/** A captured point-in-time snapshot used for history / undo-redo. */
export interface HistoryEntry {
	/** Monotonic index within the history ring buffer. */
	id: number
	/** Epoch millis when the snapshot was captured. */
	timestamp: number
	/** Optional human-readable label (e.g. the action that produced it). */
	label?: string
	/** The full plain-object snapshot at this point in time. */
	snapshot: Record<string, unknown>
}

/** A single recorded change event (from the store's action/change log). */
export interface StoreChange {
	/** Dot-separated path that changed. */
	path: string
	/** Name of the action that caused the change, if known. */
	action?: string
	/** Epoch millis when the change occurred. */
	timestamp: number
}

/**
 * The contract every state-framework adapter must satisfy. `getSnapshot` is
 * the only required member — the devtool's snapshot/search/action algorithms
 * operate on that plain object and stay framework-free. Optional members
 * unlock richer MCP tools (history, change log, live subscription, restore);
 * when an adapter omits one, the matching tools report "not supported".
 */
export interface IStoreAdapter {
	/** Stable name of this store instance (used in MCP tool output). */
	readonly name: string
	/** Framework identifier: "mobx" | "redux" | "zustand" | "apollo" | ... */
	readonly framework: string
	/** Return the full store as a plain, JSON-serializable object. */
	getSnapshot(): Record<string, unknown>
	/** Actions/methods available on the store. */
	getActions?(): ActionEntry[]
	/** Captured history (previous versions) for undo/redo. */
	getHistory?(): HistoryEntry[]
	/** Recorded change events (the action log). */
	getChangeLog?(): StoreChange[]
	/** Subscribe to live change events. Returns an unsubscribe function. */
	subscribeChanges?(cb: (change: StoreChange) => void): () => void
	/** Restore the store from a previously captured snapshot. */
	applySnapshot?(snapshot: Record<string, unknown>): void
}

// ── Framework labels ──────────────────────────────────────────────────────────

/**
 * Map a framework id (from an adapter's `framework` field) to a
 * human-readable label for MCP tool output. Unknown ids pass through.
 */
const FRAMEWORK_LABELS: Record<string, string> = {
	mobx: "MobX-State-Tree",
	redux: "Redux",
	zustand: "Zustand",
	apollo: "Apollo GraphQL",
}

export function frameworkLabel(framework: string | undefined): string {
	if (!framework) return "unknown"
	return FRAMEWORK_LABELS[framework] ?? framework
}

// ── Bridge / model contracts (merged from framework/mobx/types.ts) ───────────

/**
 * Envelope returned by frontend-bridge queries: the parsed payload plus the
 * connector id of the surface that answered ("vscode" | "web"), stamped by the
 * frontend connector onto the domResponse.
 */
export interface FrontendQueryResult<T> {
	data: T
	connector?: string
}

export interface FrontendBridge {
	readonly getRootSnapshot: () => Promise<FrontendQueryResult<Record<string, unknown>>>
	readonly getNestedStoreState: (
		store: string,
		path?: string,
	) => Promise<FrontendQueryResult<Record<string, unknown>>>
	readonly getActionBuffer: () => Promise<FrontendQueryResult<unknown[]>>
	readonly applySnapshot: (snapshot: Record<string, unknown>) => Promise<void>
	readonly getConsoleLogs: (params: {
		level?: string
		limit?: number
		cursor?: number
		search?: string
	}) => Promise<string>
	readonly searchConsole?: (params: {
		query: string
		level?: string
		limit?: number
		cursor?: number
	}) => Promise<string>
}

export interface BackendStore {
	getMstStore: () =>
		| {
				foundation: {
					windowManager: Record<string, unknown>
				}
				chat: Record<string, unknown>
				settings: Record<string, unknown>
		  }
		| undefined
}

export interface DevtoolModel {
	stores: {
		name: string
		keys: string
		entries: { key: string; type: string }[]
	}[]
	registerTools?: (mcpServer: McpServer) => void
}

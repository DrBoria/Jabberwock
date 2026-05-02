/**
 * Extension-side implementation of the ExtensionBridge interface.
 *
 * This adapter bridges the generic @jabberwock/devtool package to the
 * extension's internal APIs (ClineProvider, DiagnosticsManager, etc.)
 * without the devtool package needing to know about extension internals.
 *
 * DOM methods use the same request/response webview message pattern as
 * getWebviewDom: each action sends a typed message (findElement, clickElement,
 * etc.) to the webview and waits for a callback response.
 */

import type { ExtensionBridge } from "@jabberwock/devtool"
import type { ClineProvider } from "../webview/ClineProvider"
import { diagnosticsManager } from "./DiagnosticsManager"
import { Package } from "../../shared/package"

/**
 * Create an ExtensionBridge implementation for the given ClineProvider.
 */
export function createDevtoolBridge(provider: ClineProvider): ExtensionBridge {
	return {
		// ── DOM Interaction ──────────────────────────────────────────────────

		async getDom(maxDepth?: number, maxChildren?: number): Promise<string> {
			return provider.getWebviewDom(maxDepth, maxChildren)
		},

		async findElement(selector: string): Promise<string> {
			return sendDomQuery(provider, "findElement", { selector })
		},

		async clickElement(id: string): Promise<string> {
			return sendDomQuery(provider, "clickElement", { id })
		},

		async scrollElement(id: string, direction: "up" | "down" | "left" | "right"): Promise<string> {
			return sendDomQuery(provider, "scrollElement", { id, direction })
		},

		async typeText(id: string, text: string): Promise<string> {
			return sendDomQuery(provider, "typeText", { id, text })
		},

		async selectOption(id: string, value: string): Promise<string> {
			return sendDomQuery(provider, "selectOption", { id, value })
		},

		async runCommand(command: string): Promise<string> {
			return sendDomQuery(provider, "runCommand", { command })
		},

		// ── Console ─────────────────────────────────────────────────────────

		async getConsoleLogs(
			level?: "error" | "warn" | "info" | "debug",
			limit: number = 3,
			offset: number = 0,
		): Promise<string> {
			const allLogs = diagnosticsManager["logs"] || []
			let filtered = allLogs

			if (level) {
				filtered = filtered.filter((l: { level: string }) => l.level === level)
			}

			// offset from the end (most recent entries)
			const start = Math.max(0, filtered.length - offset - limit)
			const end = filtered.length - offset
			const selected = filtered.slice(Math.max(0, start), Math.max(0, end))

			return JSON.stringify(selected, null, 2)
		},

		// ── Diagnostics ─────────────────────────────────────────────────────

		async getLogs(lines: number = 100): Promise<string> {
			const snapshot = diagnosticsManager.getSnapshot({ limit: lines, includeLogs: true })
			return (snapshot.logs || [])
				.map((l: { timestamp: number; level: string; message: string }) => {
					const ts = new Date(l.timestamp).toISOString()
					return `[${ts}] [${l.level.toUpperCase()}] ${l.message}`
				})
				.join("\n")
		},

		async getDiagnosticsSnapshot(params?: any): Promise<any> {
			return diagnosticsManager.getSnapshot(params)
		},

		async clearDiagnostics(): Promise<string> {
			diagnosticsManager.clear()
			return JSON.stringify({ success: true })
		},

		// ── State ───────────────────────────────────────────────────────────

		async getMstState(params?: any): Promise<any> {
			const storeKey = String(params?.store || "chatStore")
			const mode = params?.mode || "graph"
			const depth = params?.depth
			const path = params?.path
			const nodeId = params?.nodeId
			const fields = params?.fields

			// Store registry — maps store names to provider properties
			const STORE_REGISTRY: Record<string, string> = {
				chatStore: "chatStore",
				commandExecutionStore: "commandExecutionStore",
				mcpExecutionStore: "mcpExecutionStore",
				diagnosticsStoreMst: "diagnosticsStoreMst",
				checkpointStore: "checkpointStore",
				taskHistoryStoreMst: "taskHistoryStoreMst",
			}

			const resolvedKey = STORE_REGISTRY[storeKey]
			if (!resolvedKey) {
				return {
					error: `Unknown store '${storeKey}'. Available stores: ${Object.keys(STORE_REGISTRY).join(", ")}`,
				}
			}

			const mstStore = (provider as any)[resolvedKey]
			if (!mstStore) {
				return { error: `Store '${storeKey}' is not available.` }
			}

			// Helper: build structural graph of MST node shape (keys + types, no data values)
			function buildGraphStructure(obj: any, d: number, maxDepth: number): any {
				if (obj === null || obj === undefined) {
					return { type: "null" }
				}
				if (d >= maxDepth) {
					return { type: typeof obj, value: String(obj).slice(0, 100) }
				}
				if (typeof obj === "object" && typeof obj.keys === "function" && typeof obj.get === "function") {
					const keys = Array.from(obj.keys())
					return {
						type: "map",
						size: keys.length,
						keys: keys.slice(0, 20),
						children: keys.length > 0 ? buildGraphStructure(obj.get(keys[0]), d + 1, maxDepth) : undefined,
					}
				}
				if (Array.isArray(obj)) {
					return {
						type: "array",
						size: obj.length,
						children: obj.length > 0 ? buildGraphStructure(obj[0], d + 1, maxDepth) : undefined,
					}
				}
				if (typeof obj === "object") {
					const result: Record<string, any> = {}
					for (const key of Object.keys(obj)) {
						if (key.startsWith("$") || key.startsWith("_")) continue
						const val = obj[key]
						if (typeof val === "function") continue
						result[key] = buildGraphStructure(val, d + 1, maxDepth)
					}
					return result
				}
				return { type: typeof obj }
			}

			// Helper: resolve dot-separated path on an MST store
			function resolvePath(store: any, p: string): { value: any; error?: string } {
				let value: any = store
				const parts = p.split(".")
				for (const part of parts) {
					if (value === null || value === undefined) {
						return { value: undefined, error: `Path '${p}' not found at '${part}'.` }
					}
					const bracketMatch = part.match(/^(\w+)\[(\d+)\]$/)
					if (bracketMatch) {
						value = value[bracketMatch[1]]
						if (Array.isArray(value)) {
							value = value[parseInt(bracketMatch[2])]
						} else if (value && typeof value === "object" && typeof value.get === "function") {
							const keys = Array.from(value.keys())
							value = value.get(keys[parseInt(bracketMatch[2])])
						} else if (value && typeof value === "object") {
							const keys = Object.keys(value)
							value = value[keys[parseInt(bracketMatch[2])]]
						} else {
							return { value: undefined, error: `Path '${p}' not found at '${part}'.` }
						}
					} else {
						if (value && typeof value.get === "function" && part in value) {
							value = value.get(part)
						} else {
							value = value[part]
						}
					}
				}
				if (value === undefined) {
					return { value: undefined, error: `Path '${p}' not found.` }
				}
				return { value }
			}

			// Helper: optimize MST snapshot (strip defaults, truncate collections, limit depth)
			function optimizeSnapshot(value: any, d: number, maxDepth: number): any {
				if (d > maxDepth) {
					if (Array.isArray(value)) {
						return `[Array(${value.length})]`
					}
					if (value !== null && typeof value === "object") {
						const keys = Object.keys(value).filter((k) => !k.startsWith("$") && !k.startsWith("_"))
						return { type: "object", keys: keys.slice(0, 10) }
					}
					return value
				}
				if (Array.isArray(value)) {
					const filtered = value
						.filter(
							(item: any) =>
								item !== null &&
								item !== false &&
								item !== "" &&
								!(Array.isArray(item) && item.length === 0),
						)
						.map((item: any) => optimizeSnapshot(item, d + 1, maxDepth))
					if (filtered.length > 3) {
						return [...filtered.slice(0, 3), `[... +${filtered.length - 3} hidden items]`]
					}
					return filtered
				}
				if (value !== null && typeof value === "object") {
					const result: Record<string, any> = {}
					for (const [key, val] of Object.entries(value)) {
						if (key.startsWith("$") || key.startsWith("_")) continue
						if (val === null || val === false || val === "" || (Array.isArray(val) && val.length === 0))
							continue
						result[key] = optimizeSnapshot(val, d + 1, maxDepth)
					}
					return result
				}
				return value
			}

			// --- GRAPH MODE ---
			if (mode === "graph") {
				const graphDepth = depth ?? 2
				const structure = buildGraphStructure(mstStore, 0, graphDepth)
				return { store: storeKey, mode: "graph", depth: graphDepth, structure }
			}

			// --- QUERY MODE ---
			const queryDepth = depth ?? 3
			let targetValue: any
			let resolvedPath: string

			if (path) {
				const result = resolvePath(mstStore, path)
				if (result.error) {
					return { error: result.error }
				}
				targetValue = result.value
				resolvedPath = path
			} else if (nodeId) {
				if (typeof mstStore.nodes?.get === "function") {
					targetValue = mstStore.nodes.get(nodeId)
				} else {
					targetValue = (mstStore.nodes as any)?.[nodeId]
				}
				if (!targetValue) {
					return { error: `Node '${nodeId}' not found in store '${storeKey}'.` }
				}
				resolvedPath = `nodes.${nodeId}`
			} else {
				return {
					error: "Full store access is not allowed. Use mode:'graph' to explore structure, or mode:'query' with a specific path/nodeId to get data.",
				}
			}

			// Apply field filtering if requested
			if (fields && targetValue && typeof targetValue === "object") {
				const fieldList = fields.split(",").map((f: string) => f.trim())
				const filtered: Record<string, any> = {}
				for (const field of fieldList) {
					if (field in targetValue) {
						filtered[field] = targetValue[field]
					}
				}
				targetValue = filtered
			}

			return {
				store: storeKey,
				mode: "query",
				path: resolvedPath,
				data: optimizeSnapshot(targetValue, 0, queryDepth),
			}
		},

		async getExtensionInfo(): Promise<any> {
			return {
				name: Package.name,
				version: Package.version,
				stackSize: provider.getTaskStackSize(),
			}
		},

		async getCurrentState(): Promise<any> {
			const targetTask = provider.getCurrentTask()
			if (!targetTask) {
				return { hasTask: false }
			}
			return {
				hasTask: true,
				taskId: targetTask.taskId,
				mode: targetTask.taskMode || (await targetTask.getTaskMode()),
				isStreaming: targetTask.isStreaming,
				todoCount: targetTask.todoList?.length ?? 0,
				askType: targetTask.idleAsk?.ask || targetTask.resumableAsk?.ask || null,
				childTaskCount: targetTask.childTasks?.length ?? 0,
			}
		},

		// ── Screenshot ──────────────────────────────────────────────────────

		async getScreenshot(): Promise<string> {
			return sendDomQuery(provider, "getScreenshot", {})
		},

		// ── Drag ────────────────────────────────────────────────────────────

		async dragElement(selector: string, direction: string, pixels: number): Promise<string> {
			return sendDomQuery(provider, "dragElement", { selector, direction, pixels })
		},

		async dragFromTo(
			from: { l?: number; t?: number; r?: number; b?: number },
			to: { l?: number; t?: number; r?: number; b?: number },
		): Promise<string> {
			return sendDomQuery(provider, "dragFromTo", { from, to })
		},
	}
}

/**
 * Send a DOM query to the webview using the request/response message pattern.
 * Each query type (findElementById, clickElement, etc.) is sent as a typed
 * message to the webview, which processes it and sends back a response.
 */
async function sendDomQuery(provider: ClineProvider, type: string, params: Record<string, any>): Promise<string> {
	const { postMessageToWebview } = await import("../features/foundation/window-manager/store")
	const p = provider as any
	const requestId = Math.random().toString(36).substring(7)

	return new Promise<string>((resolve, reject) => {
		if (!p.pendingDomRequests) {
			p.pendingDomRequests = new Map()
		}

		// Timeout after 10 seconds
		const timeout = setTimeout(() => {
			if (p.pendingDomRequests.has(requestId)) {
				p.pendingDomRequests.delete(requestId)
				reject(new Error(`Timeout waiting for DOM response (${type}, req: ${requestId})`))
			}
		}, 10000)

		// Store a wrapper that clears the timeout before resolving
		p.pendingDomRequests.set(requestId, (result: string) => {
			clearTimeout(timeout)
			resolve(result)
		})

		postMessageToWebview(provider, {
			type: "action",
			action: type,
			requestId,
			...params,
		} as any)
	})
}

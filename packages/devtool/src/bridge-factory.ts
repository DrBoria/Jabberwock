/**
 * Generic bridge factory for @jabberwock/devtool.
 *
 * This file provides the `createDevtoolBridge` factory function that creates
 * an ExtensionBridge implementation from a generic `DevtoolBridgeProvider`
 * interface. The extension (ClineProvider) implements the provider interface,
 * and the factory lives here — NOT in the extension — so @jabberwock/devtool
 * is fully self-contained.
 *
 * The provider interface defines only the capabilities the bridge needs,
 * without importing any extension-internal types (no ClineProvider coupling).
 */

import type { ExtensionBridge } from "./bridge.js"
import { diagnosticsManager } from "./diagnostics/index.js"

/**
 * Generic provider interface for the bridge factory.
 *
 * The extension implements this interface to provide its capabilities
 * to the devtool bridge. No extension-internal types are imported here.
 */
export interface DevtoolBridgeProvider {
	/** Get the webview DOM as a serialized tree string */
	findElement(selector: string, depth?: number, maxChildren?: number, command?: string): Promise<string>

	/** Post a message to the webview */
	postMessageToWebview(message: Record<string, unknown>): void

	/**
	 * Register a pending DOM request callback.
	 * The extension stores the callback and invokes it when a DOM response arrives.
	 */
	setDomRequestCallback(requestId: string, callback: (result: string) => void): void

	/**
	 * Register a pending active page request callback.
	 * The extension stores the callback and invokes it when an active page response arrives.
	 */
	setActivePageRequestCallback(requestId: string, callback: (result: string) => void): void

	/** Get the current mode slug */
	getMode(): Promise<string>

	/** Get available modes */
	getModes(): Promise<{ slug: string; name: string }[]>

	/** Get a task by ID */
	getTaskWithId?(id: string): Promise<Record<string, unknown> | null>

	/** Chat store (MST) */
	chatStore?: Record<string, unknown>

	/** Command execution store (MST) */
	commandExecutionStore?: Record<string, unknown>

	/** MCP execution store (MST) */
	mcpExecutionStore?: Record<string, unknown>

	/** Diagnostics store (MST) */
	diagnosticsStoreMst?: Record<string, unknown>

	/** Checkpoint store (MST) */
	checkpointStore?: Record<string, unknown>

	/** Task history store (MST) */
	taskHistoryStoreMst?: Record<string, unknown>

	/** Package version string */
	packageVersion?: string

	/** Package name string */
	packageName?: string
}

/**
 * Create an ExtensionBridge implementation from a generic provider interface.
 *
 * @param provider - The extension's provider implementing DevtoolBridgeProvider
 * @param storeRegistry - Optional mapping of store names to provider property names
 * @returns An ExtensionBridge implementation
 */

/**
 * Register global error handlers to capture unhandled rejections and exceptions.
 */
function registerGlobalErrorHandlers(): void {
	const g = globalThis as Record<string, unknown>
	if (g.__JABBERWOCK_GLOBAL_ERROR_HANDLERS__) return
	g.__JABBERWOCK_GLOBAL_ERROR_HANDLERS__ = true
	process.on("unhandledRejection", (reason: unknown) => {
		const message =
			reason instanceof Error
				? `[UNHANDLED_REJECTION] ${reason.stack || reason.message}`
				: `[UNHANDLED_REJECTION] ${String(reason)}`
		diagnosticsManager.log(message, "error")
	})
	process.on("uncaughtException", (error: Error) => {
		const message = `[UNCAUGHT_EXCEPTION] ${error.stack || error.message}`
		diagnosticsManager.log(message, "error")
	})
	diagnosticsManager.log("[DiagnosticsManager] Global error handlers registered", "info")
}

/**
 * Intercept VS Code notification methods (showErrorMessage, showWarningMessage,
 * showInformationMessage) so they are also captured in the diagnostics console.
 */
async function interceptVscodeNotifications(): Promise<void> {
	try {
		const vscode = await import("vscode")
		const win = vscode.window as Record<string, unknown>
		const levels = [
			{ method: "showErrorMessage", level: "error" as const },
			{ method: "showWarningMessage", level: "warn" as const },
			{ method: "showInformationMessage", level: "info" as const },
		]
		for (const { method, level } of levels) {
			const original = win[method] as (...args: unknown[]) => unknown
			if (typeof original !== "function") continue
			const wrapped = function (this: unknown, ...args: unknown[]): unknown {
				const message = typeof args[0] === "string" ? args[0] : String(args[0])
				diagnosticsManager.log(`[VSCODE_${method.toUpperCase()}] ${message}`, level)
				return original.apply(vscode.window, args)
			}
			try {
				Object.defineProperty(win, method, { value: wrapped, writable: true, configurable: true })
			} catch {
				/* skip */
			}
		}
	} catch {
		/* vscode module may not be available */
	}
}

export function createDevtoolBridge(
	provider: DevtoolBridgeProvider,
	storeRegistry?: Record<string, string>,
	backendRootStore?: { getSnapshot(): Record<string, unknown>; getActionBuffer(): unknown[] },
): ExtensionBridge {
	// Activate console interception so all extension host console.log/warn/error/debug
	// calls are captured in diagnosticsManager and available via get_console_logs / get_logs.
	diagnosticsManager.registerConsoleInterceptor()

	// Register global error handlers to capture unhandled rejections/exceptions.
	registerGlobalErrorHandlers()

	// Intercept VS Code notification methods so popup messages are captured.
	interceptVscodeNotifications().catch(() => {})

	return {
		// ── DOM Interaction ──────────────────────────────────────────────────

		async findElement(selector: string, depth?: number, maxChildren?: number, command?: string): Promise<string> {
			return sendDomQuery(provider, "findElement", { selector, depth, maxChildren, command })
		},

		async clickElement(id?: string, selector?: string): Promise<string> {
			return sendDomQuery(provider, "clickElement", { id, selector })
		},

		async scrollElement(id?: string, direction?: string, selector?: string): Promise<string> {
			return sendDomQuery(provider, "scrollElement", { id, direction, selector })
		},

		async typeText(id?: string, selector?: string, text?: string, submit?: boolean): Promise<string> {
			return sendDomQuery(provider, "typeText", { id, selector, text, submit })
		},

		async selectOption(id: string, value: string): Promise<string> {
			return sendDomQuery(provider, "selectOption", { id, value })
		},

		async runCommand(command: string): Promise<string> {
			return sendDomQuery(provider, "runCommand", { command })
		},

		async executeVscodeCommand(command: string, args?: unknown): Promise<string> {
			try {
				const { commands } = await import("vscode")
				const result = await commands.executeCommand(command, args)
				return JSON.stringify({ success: true, result })
			} catch (error) {
				return JSON.stringify({ success: false, error: String(error) })
			}
		},

		async getActivePage(): Promise<string> {
			const requestId = Math.random().toString(36).substring(7)
			return new Promise<string>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error("Timeout waiting for active page response after 3s"))
				}, 3000)

				provider.setActivePageRequestCallback(requestId, (result: string) => {
					clearTimeout(timeout)
					resolve(result)
				})

				provider.postMessageToWebview({
					type: "action",
					action: "getActivePage",
					requestId,
				})
			})
		},

		// ── Console ─────────────────────────────────────────────────────────

		async getConsoleLogs(
			level?: "error" | "warn" | "info" | "debug",
			limit: number = 3,
			offset: number = 0,
		): Promise<string> {
			const allLogs =
				(diagnosticsManager as unknown as { logs: { level: string; timestamp: number; message: string }[] })[
					"logs"
				] || []
			let filtered = allLogs

			if (level) {
				filtered = filtered.filter((l: { level: string }) => l.level === level)
			}

			// offset from the end (most recent entries), then reverse so newest is first
			const start = Math.max(0, filtered.length - offset - limit)
			const end = filtered.length - offset
			const selected = filtered.slice(Math.max(0, start), Math.max(0, end))

			return JSON.stringify(selected.reverse(), null, 2)
		},

		// ── Diagnostics ─────────────────────────────────────────────────────

		async getLogs(lines: number = 100): Promise<string> {
			const snapshot = diagnosticsManager.getSnapshot({ limit: lines, includeLogs: true })
			return (snapshot.logs || [])
				.slice()
				.reverse()
				.map((l: { timestamp: number; level: string; message: string }) => {
					const ts = new Date(l.timestamp).toISOString()
					return `[${ts}] [${l.level.toUpperCase()}] ${l.message}`
				})
				.join("\n")
		},

		async getDiagnosticsSnapshot(params?: Record<string, unknown>): Promise<string> {
			return JSON.stringify(diagnosticsManager.getSnapshot(params as never))
		},

		async clearDiagnostics(): Promise<string> {
			diagnosticsManager.clear()
			return JSON.stringify({ success: true })
		},

		// ── State ───────────────────────────────────────────────────────────

		async getMstState(params?: Record<string, unknown>): Promise<string> {
			const storeKey = String(params?.store || "chatStore")
			const mode = String(params?.mode || "graph")
			const depth = Number(params?.depth) || 3
			const path = params?.path as string | undefined
			const nodeId = params?.nodeId as string | undefined
			const fields = params?.fields as string | undefined

			// Use the provided store registry, or fall back to the default mapping.
			const registry: Record<string, string> = storeRegistry || {
				chatStore: "chatStore",
				commandExecutionStore: "commandExecutionStore",
				mcpExecutionStore: "mcpExecutionStore",
				diagnosticsStoreMst: "diagnosticsStoreMst",
				checkpointStore: "checkpointStore",
				taskHistoryStoreMst: "taskHistoryStoreMst",
			}

			const resolvedKey = registry[storeKey]
			if (!resolvedKey) {
				return JSON.stringify({
					error: `Unknown store '${storeKey}'. Available stores: ${Object.keys(registry).join(", ")}`,
				})
			}

			const mstStore = (provider as unknown as Record<string, unknown>)[resolvedKey]
			if (!mstStore) {
				return JSON.stringify({ error: `Store '${storeKey}' is not available.` })
			}

			// Helper: build structural graph of MST node shape (keys + types, no data values)
			function buildGraphStructure(obj: unknown, d: number, maxDepth: number): unknown {
				if (obj === null || obj === undefined) {
					return null
				}
				if (d >= maxDepth) {
					return { type: typeof obj, value: String(obj).slice(0, 100) }
				}
				if (
					typeof obj === "object" &&
					typeof (obj as Record<string, unknown>).keys === "function" &&
					typeof (obj as Record<string, unknown>).get === "function"
				) {
					const mapObj = obj as { keys(): Iterable<unknown>; get(k: unknown): unknown }
					const keys = Array.from(mapObj.keys())
					return {
						type: "map",
						size: keys.length,
						keys: keys.slice(0, 20),
						children:
							keys.length > 0 ? buildGraphStructure(mapObj.get(keys[0]), d + 1, maxDepth) : undefined,
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
					const record = obj as Record<string, unknown>
					const keys = Object.keys(record)
					const visibleKeys = keys.filter((k) => !k.startsWith("$") && !k.startsWith("_"))
					// If all keys are internal MST fields ($, _), the object is an MST model node.
					// Use toJSON() to get the actual data instead of returning {}.
					if (visibleKeys.length === 0 && typeof (record as { toJSON?(): unknown }).toJSON === "function") {
						return buildGraphStructure((record as { toJSON(): unknown }).toJSON(), d, maxDepth)
					}
					const result: Record<string, unknown> = {}
					for (const key of keys) {
						if (key.startsWith("$") || key.startsWith("_")) continue
						result[key] = buildGraphStructure(record[key], d + 1, maxDepth)
					}
					return result
				}
				return { type: typeof obj, value: String(obj).slice(0, 100) }
			}

			// Helper: resolve a dot-separated path on an object
			function resolvePath(obj: unknown, p: string): { value: unknown; error?: string } {
				const parts = p.split(".")
				let current: unknown = obj
				for (const part of parts) {
					if (current === null || current === undefined) {
						return { value: null, error: `Path '${p}' — '${part}' is null/undefined` }
					}
					const currentRecord = current as Record<string, unknown>
					if (
						typeof current === "object" &&
						typeof currentRecord.get === "function" &&
						typeof currentRecord.keys === "function"
					) {
						const mapObj = current as {
							get(k: string): unknown
							keys(): Iterable<string>
							has?(k: string): boolean
						}
						// For ObservableMap-like objects:
						//   - "size" → use keys().length (MST proxy may not expose .size directly)
						//   - known map key → get(key)
						//   - otherwise → fall back to property access
						if (part === "size") {
							current = Array.from(mapObj.keys()).length
						} else if (typeof mapObj.has === "function" && mapObj.has(part)) {
							current = mapObj.get(part)
						} else {
							current = currentRecord[part]
						}
					} else if (typeof current === "object") {
						current = currentRecord[part]
					} else {
						return { value: null, error: `Path '${p}' — '${part}' is not an object` }
					}
				}
				return { value: current }
			}

			// Helper: optimize snapshot for serialization
			function optimizeSnapshot(value: unknown, d: number, maxDepth: number): unknown {
				if (value === null || value === undefined) return null
				if (d >= maxDepth) return String(value).slice(0, 200)
				if (typeof value === "string") return value.slice(0, 2000)
				if (typeof value !== "object") return value

				if (Array.isArray(value)) {
					if (value.length === 0) return []
					const sample = optimizeSnapshot(value[0], d + 1, maxDepth)
					return {
						_type: "array",
						length: value.length,
						sample,
					}
				}

				const valueRecord = value as Record<string, unknown>
				// Handle MST maps
				if (typeof valueRecord.keys === "function" && typeof valueRecord.get === "function") {
					const mapObj = value as { keys(): Iterable<unknown>; get(k: unknown): unknown }
					const keys = Array.from(mapObj.keys())
					const sampleKey = keys[0]
					const sampleVal = sampleKey ? optimizeSnapshot(mapObj.get(sampleKey), d + 1, maxDepth) : null
					return {
						_type: "map",
						size: keys.length,
						keys: keys.slice(0, 20),
						sample: sampleVal,
					}
				}

				const result: Record<string, unknown> = {}
				for (const key of Object.keys(valueRecord)) {
					if (key.startsWith("$") || key.startsWith("_")) continue
					try {
						result[key] = optimizeSnapshot(valueRecord[key], d + 1, maxDepth)
					} catch {
						result[key] = "<error>"
					}
				}
				return result
			}

			try {
				if (mode === "graph") {
					return JSON.stringify(buildGraphStructure(mstStore, 0, depth))
				}

				if (mode === "query") {
					if (nodeId) {
						const nodeRecord = mstStore as Record<string, unknown>
						const nodes = nodeRecord.nodes as { get?(id: string): unknown } | undefined
						const node = nodes?.get ? nodes.get(nodeId) : undefined
						if (!node) return JSON.stringify({ error: `Node '${nodeId}' not found` })
						if (fields) {
							const fieldList = fields.split(",").map((f: string) => f.trim())
							const result: Record<string, unknown> = {}
							for (const field of fieldList) {
								result[field] = optimizeSnapshot((node as Record<string, unknown>)[field], 0, depth)
							}
							return JSON.stringify(result)
						}
						return JSON.stringify(optimizeSnapshot(node, 0, depth))
					}

					if (path) {
						const resolved = resolvePath(mstStore, path)
						if (resolved.error) return JSON.stringify({ error: resolved.error })
						return JSON.stringify(optimizeSnapshot(resolved.value, 0, depth))
					}

					return JSON.stringify(optimizeSnapshot(mstStore, 0, depth))
				}

				return JSON.stringify({ error: `Unknown mode '${mode}'. Use 'graph' or 'query'.` })
			} catch (err: unknown) {
				return JSON.stringify({
					error: `Error querying MST state: ${err instanceof Error ? err.message : String(err)}`,
				})
			}
		},

		async getExtensionInfo(): Promise<string> {
			return JSON.stringify({
				version: provider.packageVersion || "0.0.0",
				name: provider.packageName || "unknown",
				environment: process.env.NODE_ENV || "production",
				mode: provider.getMode ? await provider.getMode() : "unknown",
				modes: provider.getModes ? await provider.getModes() : [],
				devtoolEnabled: true,
			})
		},

		async getCurrentState(): Promise<string> {
			try {
				const chatStore = provider.chatStore
				const activeNodeId = (chatStore?.activeNodeId as string) || ""
				const task = provider.getTaskWithId && activeNodeId ? await provider.getTaskWithId(activeNodeId) : null
				return JSON.stringify({
					taskId: activeNodeId || null,
					mode: (chatStore?.activeNode as Record<string, unknown>)?.mode || null,
					taskTitle: task?.title || null,
					isLoading: (chatStore?.isLoading as boolean) || false,
					isStreaming: (chatStore?.isStreaming as boolean) || false,
					parentTaskId: (chatStore?.activeNode as Record<string, unknown>)?.parentTaskId || null,
					summary: task?.summary || null,
				})
			} catch {
				return JSON.stringify({ error: "Could not get current state" })
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

		// ── Store State (backend + frontend) ────────────────────────────────

		async getStoreState(params: {
			store: "backend" | "frontend"
			path?: string
			limit?: number
			cursor?: number
		}): Promise<string> {
			if (params.store === "frontend") {
				return sendDomQuery(provider, "getStoreSnapshot", {
					store: "rootStore",
					path: params.path,
					limit: params.limit ?? 10,
					cursor: params.cursor ?? 0,
				})
			}
			if (!backendRootStore) return JSON.stringify({ error: "Backend root store is not available" })
			try {
				const snapshot = backendRootStore.getSnapshot()
				if (params.path) {
					const parts = params.path.split(".")
					let value: unknown = snapshot
					for (const part of parts) {
						if (value && typeof value === "object" && part in (value as Record<string, unknown>)) {
							value = (value as Record<string, unknown>)[part]
						} else {
							return JSON.stringify({ error: `Path '${params.path}' not found at '${part}'` })
						}
					}
					if (value && typeof value === "object" && !Array.isArray(value)) {
						const entries = Object.entries(value as Record<string, unknown>)
						const start = (params.cursor ?? 0) * (params.limit ?? 10)
						const limit = params.limit ?? 10
						const sliced = entries.slice(start, start + limit)
						return JSON.stringify({
							items: sliced.map(([k, v]) => ({ key: k, value: v })),
							cursor: (params.cursor ?? 0) + 1,
							countLeft: Math.max(0, entries.length - (start + limit)),
							prevCount: Math.min(start, entries.length),
							total: entries.length,
						})
					}
					return JSON.stringify({
						items: [{ path: params.path, value }],
						cursor: 1,
						countLeft: 0,
						prevCount: 0,
						total: 1,
					})
				}
				const entries = Object.entries(snapshot)
				const start = (params.cursor ?? 0) * (params.limit ?? 10)
				const limit = params.limit ?? 10
				const sliced = entries.slice(start, start + limit)
				return JSON.stringify({
					items: sliced.map(([k, v]) => ({ key: k, value: v })),
					cursor: (params.cursor ?? 0) + 1,
					countLeft: Math.max(0, entries.length - (start + limit)),
					prevCount: Math.min(start, entries.length),
					total: entries.length,
				})
			} catch (error) {
				return JSON.stringify({
					error: `Error getting backend store state: ${error instanceof Error ? error.message : String(error)}`,
				})
			}
		},

		async getStoreActions(params: {
			store: "backend" | "frontend"
			limit?: number
			cursor?: number
		}): Promise<string> {
			if (params.store === "frontend") {
				return sendDomQuery(provider, "getStoreActions", {
					store: "rootStore",
					limit: params.limit ?? 10,
					cursor: params.cursor ?? 0,
				})
			}
			if (!backendRootStore) return JSON.stringify({ error: "Backend root store is not available" })
			try {
				const buffer = backendRootStore.getActionBuffer()
				const names = (buffer as { action?: { name?: string } }[]).map((e) => e.action?.name || String(e))
				const start = (params.cursor ?? 0) * (params.limit ?? 10)
				const limit = params.limit ?? 10
				const sliced = names.slice(start, start + limit)
				return JSON.stringify({
					items: sliced.map((name) => ({ name })),
					cursor: (params.cursor ?? 0) + 1,
					countLeft: Math.max(0, names.length - (start + limit)),
					prevCount: Math.min(start, names.length),
					total: names.length,
				})
			} catch (error) {
				return JSON.stringify({
					error: `Error getting backend store actions: ${error instanceof Error ? error.message : String(error)}`,
				})
			}
		},

		async filterState(params: {
			store: "backend" | "frontend"
			path: string
			limit?: number
			cursor?: number
		}): Promise<string> {
			if (params.store === "frontend") {
				return sendDomQuery(provider, "filterStoreState", {
					store: "rootStore",
					path: params.path,
					limit: params.limit ?? 10,
					cursor: params.cursor ?? 0,
				})
			}
			return this.getStoreState({
				store: "backend",
				path: params.path,
				limit: params.limit,
				cursor: params.cursor,
			})
		},

		async filterActions(params: {
			store: "backend" | "frontend"
			pattern: string
			limit?: number
			cursor?: number
		}): Promise<string> {
			if (params.store === "frontend") {
				return sendDomQuery(provider, "filterStoreActions", {
					store: "rootStore",
					pattern: params.pattern,
					limit: params.limit ?? 10,
					cursor: params.cursor ?? 0,
				})
			}
			if (!backendRootStore) return JSON.stringify({ error: "Backend root store is not available" })
			try {
				const buffer = backendRootStore.getActionBuffer()
				const names = (buffer as { action?: { name?: string } }[]).map((e) => e.action?.name || String(e))
				const pattern = params.pattern.toLowerCase()
				const filtered = names.filter((name) => name.toLowerCase().includes(pattern))
				const start = (params.cursor ?? 0) * (params.limit ?? 10)
				const limit = params.limit ?? 10
				const sliced = filtered.slice(start, start + limit)
				return JSON.stringify({
					items: sliced.map((name) => ({ name })),
					cursor: (params.cursor ?? 0) + 1,
					countLeft: Math.max(0, filtered.length - (start + limit)),
					prevCount: Math.min(start, filtered.length),
					total: filtered.length,
				})
			} catch (error) {
				return JSON.stringify({
					error: `Error filtering backend store actions: ${error instanceof Error ? error.message : String(error)}`,
				})
			}
		},

		async searchActions(params: {
			store: "backend" | "frontend"
			query: string
			limit?: number
			cursor?: number
		}): Promise<string> {
			if (params.store === "frontend") {
				return sendDomQuery(provider, "searchStoreActions", {
					store: "rootStore",
					query: params.query,
					limit: params.limit ?? 10,
					cursor: params.cursor ?? 0,
				})
			}
			return this.filterActions({
				store: "backend",
				pattern: params.query,
				limit: params.limit,
				cursor: params.cursor,
			})
		},

		async countActions(params: { store: "backend" | "frontend" }): Promise<string> {
			if (params.store === "frontend") {
				return sendDomQuery(provider, "countStoreActions", { store: "rootStore" })
			}
			if (!backendRootStore) return JSON.stringify({ error: "Backend root store is not available" })
			try {
				const buffer = backendRootStore.getActionBuffer()
				return JSON.stringify({ store: "backend", count: (buffer as unknown[]).length })
			} catch (error) {
				return JSON.stringify({
					error: `Error counting backend store actions: ${error instanceof Error ? error.message : String(error)}`,
				})
			}
		},

		async applyPreviousState(params: { store: "backend" | "frontend" }): Promise<string> {
			if (params.store === "frontend") {
				return sendDomQuery(provider, "applyStoreSnapshot", { store: params.store })
			}
			return JSON.stringify({ error: "applyPreviousState is not supported for backend store" })
		},

		async applyNextState(params: { store: "backend" | "frontend" }): Promise<string> {
			if (params.store === "frontend") {
				return sendDomQuery(provider, "applyStoreSnapshot", { store: params.store })
			}
			return JSON.stringify({ error: "applyNextState is not supported for backend store" })
		},

		async getStoreActionsLog(params: {
			store: "backend" | "frontend"
			before?: number
			after?: number
		}): Promise<string> {
			if (params.store === "frontend") {
				return sendDomQuery(provider, "getStoreActionsLog", {
					store: "rootStore",
					before: params.before,
					after: params.after,
				})
			}
			if (!backendRootStore) return JSON.stringify({ error: "Backend root store is not available" })
			try {
				const buffer = backendRootStore.getActionBuffer()
				const entries = buffer as { timestamp?: number; action?: { name?: string } }[]
				const before = params.before ?? entries.length
				const after = params.after ?? 0
				const start = Math.max(0, entries.length - before)
				const end = Math.min(entries.length, start + after + before)
				const sliced = entries.slice(start, end)
				return JSON.stringify(sliced)
			} catch (error) {
				return JSON.stringify({
					error: `Error getting backend store actions log: ${error instanceof Error ? error.message : String(error)}`,
				})
			}
		},
	}
}

/**
 * Send a DOM query to the webview using the request/response message pattern.
 * Each query type (findElementById, clickElement, etc.) is sent as a typed
 * message to the webview, which processes it and sends back a response.
 */
async function sendDomQuery(
	provider: DevtoolBridgeProvider,
	type: string,
	params: Record<string, unknown>,
): Promise<string> {
	const requestId = Math.random().toString(36).substring(7)

	return new Promise<string>((resolve, reject) => {
		// Timeout after 10 seconds
		const timeout = setTimeout(() => {
			reject(new Error(`Timeout waiting for DOM response (${type}, req: ${requestId})`))
		}, 10000)

		// Register the callback via the provider method
		provider.setDomRequestCallback(requestId, (result: string) => {
			clearTimeout(timeout)
			resolve(result)
		})

		provider.postMessageToWebview({
			type: "action",
			action: type,
			requestId,
			...params,
		} as Record<string, unknown>)
	})
}

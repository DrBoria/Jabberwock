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
	getWebviewDom(maxDepth?: number, maxChildren?: number): Promise<string>

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
export function createDevtoolBridge(
	provider: DevtoolBridgeProvider,
	storeRegistry?: Record<string, string>,
): ExtensionBridge {
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

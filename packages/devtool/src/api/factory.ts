import type { ExtensionBridge } from "./bridge.js"
import { getStoreState } from "./mst/snapshot.js"
import { searchBackendState, searchFrontendState } from "./mst/search.js"
import {
	getStoreActions,
	filterActions,
	searchActions,
	countActions,
	getStoreActionsLog,
	getFrontendStoreActions,
	filterFrontendActions,
	searchFrontendActions,
	countFrontendActions,
	getFrontendStoreActionsLog,
} from "./mst/actions.js"
import { MessageInterceptor } from "./utils/interceptor.js"
import type { BackendStore, FrontendBridge } from "./mst/types.js"
import { diagnosticsManager } from "../diagnostics/DiagnosticsManager.js"
import type { SnapshotFilters } from "../diagnostics/types.js"

/**
 * Provider interface that must be implemented by the consumer (e.g., the VS Code extension).
 */
export interface DevtoolBridgeProvider {
	findElement: (selector: string, depth?: number, maxChildren?: number, command?: string) => Promise<string>
	getActivePage: (requestId: string) => void
	setActivePageRequestCallback: (requestId: string, callback: (result: string) => void) => void
	setDomRequestCallback: (requestId: string, callback: (result: string) => void) => void
	postMessageToWebview: (type: string, payload?: Record<string, unknown>) => void
	getModes: () => string[]
	getMode: () => string
	getTaskWithId?: (taskId: string) => Record<string, unknown> | undefined
}

function registerGlobalErrorHandlers(): void {
	process.on("unhandledRejection", (reason: unknown) => {
		console.error("[devtool] Unhandled Rejection:", reason)
	})
	process.on("uncaughtException", (error: Error) => {
		console.error("[devtool] Uncaught Exception:", error)
	})
}

let requestCounter = 0
function nextRequestId(): string {
	return `devtool-req-${++requestCounter}`
}

async function sendDomQuery(
	provider: DevtoolBridgeProvider,
	type: string,
	payload: Record<string, unknown> = {},
): Promise<string> {
	const requestId = nextRequestId()
	return new Promise<string>((resolve, reject) => {
		const timeout = setTimeout(() => {
			reject(new Error(`DOM query "${type}" timed out after 30s`))
		}, 30_000)
		provider.setDomRequestCallback(requestId, (result: string) => {
			clearTimeout(timeout)
			resolve(result)
		})
		provider.postMessageToWebview("action", { action: type, requestId, ...payload })
	})
}

/**
 * Creates an ExtensionBridge from a DevtoolBridgeProvider implementation.
 * The bridge provides all MCP tool handlers with typed methods.
 */
export function createDevtoolBridge(
	provider: DevtoolBridgeProvider,
	backendStore?: BackendStore,
	frontendBridge?: FrontendBridge,
): ExtensionBridge {
	registerGlobalErrorHandlers()

	const interceptor = new MessageInterceptor({
		executeVscodeCommand: async (command: string, args: unknown) => {
			const vscode = await import("vscode")
			await vscode.commands.executeCommand(command, ...(Array.isArray(args) ? args : []))
			return ""
		},
		getActivePage: async () => {
			const requestId = nextRequestId()
			return new Promise<string>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error("getActivePage timed out"))
				}, 10_000)
				provider.setActivePageRequestCallback(requestId, (result: string) => {
					clearTimeout(timeout)
					resolve(result)
				})
				provider.postMessageToWebview("action", { action: "getActivePage", requestId })
			})
		},
		getConsole: (_params: { env: "backend" | "frontend"; level?: string; limit?: number; cursor?: number }) =>
			Promise.resolve(JSON.stringify({ lines: [], totalLines: 0 })),
		searchConsole: (_params: {
			query: string
			env?: "backend" | "frontend"
			level?: string
			limit?: number
			cursor?: number
		}) => Promise.resolve(JSON.stringify({ lines: [], totalLines: 0 })),
		getLogs: (_lines?: number) => Promise.resolve(""),
		getExtensionInfo: () =>
			Promise.resolve(
				JSON.stringify({
					name: "Jabberwock DevTools",
					version: "1.0.0",
					stores: ["chat", "settings", "foundation"],
				}),
			),
		getCurrentState: () => Promise.resolve("{}"),
		getStoreState: () => Promise.resolve("{}"),
		searchState: () => Promise.resolve('{"results":[]}'),
		getStoreActions: () => Promise.resolve('{"actions":[]}'),
		filterActions: () => Promise.resolve('{"actions":[]}'),
		searchActions: () => Promise.resolve('{"actions":[]}'),
		countActions: () => Promise.resolve('{"count":0}'),
		getStoreActionsLog: () => Promise.resolve('{"actions":[]}'),
	} as unknown as ExtensionBridge)

	return {
		async executeVscodeCommand(command: string, args?: unknown): Promise<string> {
			const vscode = await import("vscode")
			await vscode.commands.executeCommand(command, ...(Array.isArray(args) ? args : []))
			return JSON.stringify({ success: true, command })
		},

		async getActivePage() {
			const requestId = nextRequestId()
			return new Promise<string>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error("getActivePage timed out"))
				}, 10_000)
				provider.setActivePageRequestCallback(requestId, (result: string) => {
					clearTimeout(timeout)
					resolve(result)
				})
				provider.postMessageToWebview("action", { action: "getActivePage", requestId })
			})
		},

		async getConsole({ env, level, limit = 10, cursor = 0 }) {
			try {
				if (env === "backend") {
					const allLogs = diagnosticsManager.getAllLogs()
					let filtered = allLogs

					// Filter by level
					if (level) {
						const normalizedLevel =
							level === "info" ? ("info" as const) : (level as "warn" | "error" | "debug")
						filtered = filtered.filter((e) => e.level === normalizedLevel)
					}

					const totalLines = filtered.length
					const endIndex = filtered.length - cursor
					const startIndex = Math.max(0, endIndex - limit)
					const sliced = filtered.slice(startIndex, endIndex).reverse()

					const lines = sliced.map((e) => {
						const timestamp = new Date(e.timestamp).toISOString()
						return `[${timestamp}][${e.level.toUpperCase()}] ${e.message}`
					})

					return JSON.stringify({ lines, totalLines })
				}

				if (env === "frontend") {
					if (!frontendBridge) {
						return JSON.stringify({ lines: [], totalLines: 0 })
					}
					return frontendBridge.getConsoleLogs({ level, limit, cursor })
				}

				return JSON.stringify({ lines: [], totalLines: 0, error: `Unknown env: ${env}` })
			} catch (error) {
				return JSON.stringify({
					lines: [],
					totalLines: 0,
					error: error instanceof Error ? error.message : String(error),
				})
			}
		},

		async searchConsole({ env, query, level, limit = 10, cursor = 0 }) {
			try {
				const results: { lines: string[]; totalLines: number; env: string }[] = []
				const envs = env ? [env] : (["backend", "frontend"] as const)

				for (const e of envs) {
					if (e === "backend") {
						const allLogs = diagnosticsManager.getAllLogs()
						let filtered = allLogs

						if (level) {
							const normalizedLevel =
								level === "info" ? ("info" as const) : (level as "warn" | "error" | "debug")
							filtered = filtered.filter((l) => l.level === normalizedLevel)
						}

						const searchLower = query.toLowerCase()
						filtered = filtered.filter((l) => l.message.toLowerCase().includes(searchLower))

						const totalLines = filtered.length
						const endIndex = filtered.length - cursor
						const startIndex = Math.max(0, endIndex - limit)
						const sliced = filtered.slice(startIndex, endIndex).reverse()

						const lines = sliced.map((e) => {
							const timestamp = new Date(e.timestamp).toISOString()
							return `[${timestamp}][${e.level.toUpperCase()}] ${e.message}`
						})

						results.push({ lines, totalLines, env: "backend" })
					}

					if (e === "frontend") {
						if (!frontendBridge) {
							results.push({ lines: [], totalLines: 0, env: "frontend" })
							continue
						}
						const frontendResult = await frontendBridge.searchConsole!({ query, level, limit, cursor })
						const parsed = JSON.parse(frontendResult) as { lines: string[]; totalLines: number }
						results.push({ ...parsed, env: "frontend" })
					}
				}

				// If searching both envs, merge and sort by timestamp
				if (results.length === 1) {
					const single = results[0]!
					return JSON.stringify({ lines: single.lines, totalLines: single.totalLines })
				}

				// Merge results from both environments
				const allLines = results.flatMap((r) => r.lines)
				const totalLines = results.reduce((sum, r) => sum + r.totalLines, 0)
				return JSON.stringify({ lines: allLines, totalLines })
			} catch (error) {
				return JSON.stringify({
					lines: [],
					totalLines: 0,
					error: error instanceof Error ? error.message : String(error),
				})
			}
		},

		async getLogs(lines = 100) {
			const allLogs = diagnosticsManager.getAllLogs()
			const totalLines = allLogs.length
			const endIndex = allLogs.length
			const startIndex = Math.max(0, endIndex - lines)
			const sliced = allLogs.slice(startIndex, endIndex).reverse()
			const formattedLines = sliced.map((e) => {
				const timestamp = new Date(e.timestamp).toISOString()
				return `[${timestamp}][${e.level.toUpperCase()}] ${e.message}`
			})
			return JSON.stringify({ lines: formattedLines, totalLines })
		},

		async getDiagnosticsSnapshot(params?: Record<string, unknown>) {
			const snapshot = diagnosticsManager.getSnapshot(params as SnapshotFilters)
			return JSON.stringify(snapshot)
		},

		async clearDiagnostics(): Promise<string> {
			diagnosticsManager.clear()
			return JSON.stringify({ success: true })
		},

		async getExtensionInfo() {
			try {
				const vscode = await import("vscode")
				const ext = vscode.extensions.getExtension("rooveterinaryinc.roo-cline")
				return JSON.stringify({
					name: "Jabberwock DevTools",
					version: ext?.packageJSON?.version ?? "dev",
					stores: ["chat", "settings", "foundation"],
				})
			} catch {
				return JSON.stringify({
					name: "Jabberwock DevTools",
					version: "dev",
					stores: ["chat", "settings", "foundation"],
				})
			}
		},

		async getCurrentState() {
			if (backendStore) {
				const mstStore = backendStore.getMstStore()
				if (mstStore) {
					return JSON.stringify({
						chat: Object.keys(mstStore.chat ?? {}),
						settings: Object.keys(mstStore.settings ?? {}),
						foundation: Object.keys(mstStore.foundation ?? {}),
					})
				}
			}
			return JSON.stringify({ error: "No store available" })
		},

		async getStoreState(params) {
			return getStoreState(
				{ env: params?.env ?? "backend", store: params?.store, limit: params?.limit, cursor: params?.cursor },
				backendStore,
				frontendBridge,
			)
		},

		async searchState(params) {
			if (params.env === "backend") {
				return searchBackendState(params, backendStore)
			}
			return searchFrontendState(params, frontendBridge)
		},

		async getStoreActions(params) {
			if (params.env === "backend") {
				return getStoreActions(params, backendStore)
			}
			return getFrontendStoreActions(params, frontendBridge)
		},

		async filterActions(params) {
			if (params.env === "backend") {
				return filterActions(params, backendStore)
			}
			return filterFrontendActions(params, frontendBridge)
		},

		async searchActions(params) {
			if (params.env === "backend") {
				return searchActions(params, backendStore)
			}
			return searchFrontendActions(params, frontendBridge)
		},

		async countActions(params) {
			if (params.env === "backend") {
				return countActions(params, backendStore)
			}
			return countFrontendActions(params, frontendBridge)
		},

		async getStoreActionsLog(params) {
			if (params.env === "backend") {
				return getStoreActionsLog(params, backendStore)
			}
			return getFrontendStoreActionsLog(params, frontendBridge)
		},

		async runCommand(command) {
			return sendDomQuery(provider, "runCommand", { command })
		},

		async findElement(selector, depth, maxChildren, command) {
			return sendDomQuery(provider, "findElement", { selector, depth, maxChildren, command })
		},

		async clickElement(id, selector) {
			return sendDomQuery(provider, "clickElement", { id, selector })
		},

		async typeText(id, selector, text, submit) {
			return sendDomQuery(provider, "typeText", { id, selector, text, submit })
		},

		async scrollElement(id, direction, selector) {
			return sendDomQuery(provider, "scrollElement", { id, direction, selector })
		},

		async selectOption(id, value) {
			return sendDomQuery(provider, "selectOption", { id, value })
		},

		async getScreenshot() {
			return sendDomQuery(provider, "getScreenshot")
		},

		async dragElement(selector, direction, pixels) {
			return sendDomQuery(provider, "dragElement", { selector, direction, pixels })
		},

		async dragFromTo(from, to) {
			return sendDomQuery(provider, "dragFromTo", { from, to })
		},

		async sendMessage(type: string, action: string, payload: unknown) {
			provider.postMessageToWebview(type, { action, payload })
		},

		async setMessageInterceptor(
			direction: "send" | "receive",
			type: string,
			action: string | undefined,
			response: unknown,
		) {
			interceptor.set({ direction, type, action, response: response as Record<string, unknown> | undefined })
		},

		async clearInterceptors() {
			interceptor.clear()
		},

		async getActiveInterceptors() {
			return JSON.stringify(interceptor.getActive())
		},

		async clearMessageTrace() {
			interceptor.clearTrace()
		},

		async applyPreviousState(): Promise<string> {
			return JSON.stringify({ success: false, error: "Not implemented" })
		},

		async applyNextState(): Promise<string> {
			return JSON.stringify({ success: false, error: "Not implemented" })
		},

		async getModes(): Promise<string> {
			const modes = await provider.getModes()
			return JSON.stringify(modes)
		},

		async getMode(): Promise<string> {
			const mode = await provider.getMode()
			return JSON.stringify(mode)
		},
	}
}

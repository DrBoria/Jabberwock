import type { DiagnosticLog } from "@jabberwock/types"

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

export function registerGlobalErrorHandlers(): void {
	process.on("unhandledRejection", (reason: unknown) => {
		console.error("[devtool] Unhandled Rejection:", reason)
	})
	process.on("uncaughtException", (error: Error) => {
		console.error("[devtool] Uncaught Exception:", error)
	})
}

let requestCounter = 0
export function nextRequestId(): string {
	return `devtool-req-${++requestCounter}`
}

export function sendDomQuery(
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
 * Filter and paginate backend console logs by level and search text.
 */
export function filterBackendLogs(
	allLogs: DiagnosticLog[],
	level?: string,
	search?: string,
	limit = 10,
	cursor = 0,
): { lines: string[]; totalLines: number } {
	let filtered = allLogs
	if (level) {
		const normalizedLevel = level === "info" ? ("info" as const) : (level as "warn" | "error" | "debug")
		filtered = filtered.filter((e) => e.level === normalizedLevel)
	}
	if (search) {
		const searchLower = search.toLowerCase()
		filtered = filtered.filter((e) => e.message.toLowerCase().includes(searchLower))
	}
	const totalLines = filtered.length
	const endIndex = filtered.length - cursor
	const startIndex = Math.max(0, endIndex - limit)
	const sliced = filtered.slice(startIndex, endIndex).reverse()
	const lines = sliced.map((e) => {
		const timestamp = new Date(e.timestamp).toISOString()
		return `[${timestamp}][${e.level.toUpperCase()}] ${e.message}`
	})
	return { lines, totalLines }
}

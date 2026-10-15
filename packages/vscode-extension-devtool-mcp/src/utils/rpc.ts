export interface JsonRpcError {
	code: number
	message: string
	data?: unknown
}

export interface JsonRpcResponse {
	id: number
	result?: unknown
	error?: JsonRpcError
}

export const DEFAULT_PORT = 60060

let _requestId = 0
export function nextId(): number {
	return ++_requestId
}

export const INITIALIZED_NOTIFICATION = JSON.stringify({
	jsonrpc: "2.0",
	method: "notifications/initialized",
})

/**
 * Resolve the ws-server URL the stdio client connects to.
 *
 * Priority: explicit `url` option > `DEVTOOL_MCP_URL` env var > localhost
 * default on the given port. No hardcoded host-specific paths.
 */
export function resolveUrl(options?: { url?: string; port?: number }): string {
	if (options?.url) return options.url
	const envUrl = typeof process !== "undefined" ? process.env.DEVTOOL_MCP_URL : undefined
	if (envUrl) return envUrl
	const port = options?.port ?? DEFAULT_PORT
	return `ws://127.0.0.1:${port}/ws`
}

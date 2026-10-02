import type { FrontendBridge, FrontendQueryResult } from "../../api/mst/types.js"

/**
 * Options for creating a frontend bridge.
 */
export interface CreateFrontendBridgeOptions {
	/**
	 * Sends a message to the webview.
	 * Returns a promise that resolves to `true` if the message was sent, `false` otherwise.
	 */
	postMessageToWebview: (message: Record<string, unknown>) => Promise<boolean>

	/**
	 * Registers a pending DOM request callback that will be resolved when
	 * the webview sends a domResponse for the given requestId. The callback
	 * receives the raw result string plus the connector id of the surface that
	 * answered ("vscode" | "web"), stamped by the frontend connector.
	 */
	setDomRequestCallback: (requestId: string, callback: (result: string, connector?: string) => void) => void
}

/**
 * Create a FrontendBridge implementation that communicates with the webview
 * via the postMessage protocol.
 *
 * Each method:
 * 1. Generates a unique requestId
 * 2. Registers a pending callback via setDomRequestCallback
 * 3. Posts a storeQuery message to the webview
 * 4. Returns a Promise that resolves when the webview responds via domResponse
 * 5. Rejects with "Timeout: <action>" after 10 seconds
 * 6. Rejects with "Webview is not available" if the message could not be sent
 *
 * @param options - The bridge options
 * @returns A FrontendBridge implementation
 */
export function createFrontendBridge(options: CreateFrontendBridgeOptions): FrontendBridge {
	const { postMessageToWebview, setDomRequestCallback } = options

	function sendQuery<T>(
		action: string,
		parseResult: (result: string) => T,
		extra?: Record<string, unknown>,
	): Promise<FrontendQueryResult<T>> {
		const requestId = Math.random().toString(36).substring(7)
		console.log(`[devtool] [FRONTEND_BRIDGE] sendQuery: action=${action} req=${requestId}`)
		return new Promise<FrontendQueryResult<T>>((resolve, reject) => {
			const timeout = setTimeout(() => {
				console.warn(`[devtool] [FRONTEND_BRIDGE] TIMEOUT: action=${action} req=${requestId} after 10s`)
				reject(new Error(`Timeout: ${action}`))
			}, 10000)
			setDomRequestCallback(requestId, (result: string, connector?: string) => {
				console.log(
					`[devtool] [FRONTEND_BRIDGE] CALLBACK: action=${action} req=${requestId} connector=${connector ?? "unknown"} result.length=${result.length}`,
				)
				clearTimeout(timeout)
				try {
					resolve({ data: parseResult(result), connector })
				} catch {
					resolve({ data: undefined as unknown as T, connector })
				}
			})
			postMessageToWebview({
				type: "action",
				action,
				requestId,
				...extra,
			}).then((sent) => {
				console.log(
					`[devtool] [FRONTEND_BRIDGE] postMessageToWebview result: sent=${sent} action=${action} req=${requestId}`,
				)
				if (!sent) {
					clearTimeout(timeout)
					reject(new Error("Webview is not available"))
				}
			})
		})
	}

	return {
		getRootSnapshot: () =>
			sendQuery("getRootSnapshot", (result) => {
				try {
					return JSON.parse(result) as Record<string, unknown>
				} catch {
					return {}
				}
			}),

		getNestedStoreState: (store, path?) =>
			sendQuery(
				"getNestedStoreState",
				(result) => {
					try {
						return JSON.parse(result) as Record<string, unknown>
					} catch {
						return {}
					}
				},
				{ store, path },
			),

		getActionBuffer: () =>
			sendQuery("getActionBuffer", (result) => {
				try {
					return JSON.parse(result) as unknown[]
				} catch {
					return []
				}
			}),

		applySnapshot: async (snapshot) => {
			await sendQuery("applySnapshot", () => undefined, { snapshot })
		},

		getConsoleLogs: async (params) => {
			const { data, connector } = await sendQuery("getConsoleLogs", (result) => result, {
				level: params.level,
				limit: params.limit,
				cursor: params.cursor,
				search: params.search,
			})
			return withConnector(data, connector)
		},

		searchConsole: async (params) => {
			const { data, connector } = await sendQuery("searchConsole", (result) => result, {
				query: params.query,
				level: params.level,
				limit: params.limit,
				cursor: params.cursor,
			})
			return withConnector(data, connector)
		},
	}
}

/**
 * Merge the connector id into an already-JSON-encoded console result string so
 * the MCP tool output carries `connector: "vscode" | "web"`. Falls back to the
 * raw string if it is not a JSON object (e.g. an error message).
 */
function withConnector(json: string, connector?: string): string {
	try {
		const obj = JSON.parse(json) as Record<string, unknown>
		if (obj && typeof obj === "object" && !Array.isArray(obj)) {
			return JSON.stringify({ ...obj, connector: connector ?? null })
		}
		return JSON.stringify({ connector: connector ?? null, result: json })
	} catch {
		return JSON.stringify({ connector: connector ?? null, result: json })
	}
}

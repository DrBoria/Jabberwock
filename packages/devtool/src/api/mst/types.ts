import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

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

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export interface FrontendBridge {
	readonly getRootSnapshot: () => Promise<Record<string, unknown>>
	readonly getActionBuffer: () => Promise<unknown[]>
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

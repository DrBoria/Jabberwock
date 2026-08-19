import { readFileSync, existsSync } from "fs"
import { homedir } from "os"
import { join } from "path"

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

export const MCP_SETTINGS_PATH = join(
	homedir(),
	"Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json",
)

let _requestId = 0
export function nextId(): number {
	return ++_requestId
}

export const INITIALIZED_NOTIFICATION = JSON.stringify({
	jsonrpc: "2.0",
	method: "notifications/initialized",
})

export function resolveUrl(options?: { port?: number }): string {
	try {
		if (existsSync(MCP_SETTINGS_PATH)) {
			const raw = readFileSync(MCP_SETTINGS_PATH, "utf-8")
			const settings = JSON.parse(raw)
			const jabberwockServer = settings?.mcpServers?.["jabberwock-devtools"]
			if (jabberwockServer?.url) {
				return jabberwockServer.url
			}
		}
	} catch {
		// Fall through to default
	}
	const port = options?.port ?? DEFAULT_PORT
	return `ws://127.0.0.1:${port}/ws`
}

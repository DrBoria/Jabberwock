import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerConsoleTools, registerDiagnosticTools } from "./console.js"
import { registerCommandTools } from "./commands.js"
import type { DevtoolMethods } from "../mcp/server.js"

/**
 * Backend domain tools.
 *
 * Imports tools from the `console/` and `commands/` files and decides which
 * are active. The backend (extension host) always exists, so its tools are
 * always registered:
 *
 * - `get_logs`, `get_diagnostics_snapshot`, `clear_diagnostics` (console)
 * - `get_console`, `search_console` (console, env-aware)
 * - `execute_vscode_command` (commands)
 *
 * `get_extension_info` (full health check) lives in `info.ts`.
 */
export function registerBackendTools(mcpServer: McpServer, methods: DevtoolMethods): void {
	registerDiagnosticTools(mcpServer, methods)
	registerConsoleTools(mcpServer, methods)
	registerCommandTools(mcpServer, methods)
}

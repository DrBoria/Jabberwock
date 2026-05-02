import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

/**
 * DevtoolModel is the interface that an extension provides to the Devtool wrapper.
 *
 * The Devtool wrapper registers generic tools (DOM, click, diagnostics, tracing)
 * automatically. The extension implements this interface to provide domain-specific
 * tools (task management, agent control, workspace operations, etc.) that are
 * registered alongside the generic ones.
 *
 * This replaces the old "e2e_dsl" concept — the extension's concrete implementation
 * is its "model" layer, not a test DSL.
 */
export interface DevtoolModel {
	/**
	 * Register domain-specific tools on the given MCP server.
	 * Called automatically by the Devtool wrapper during startup.
	 */
	registerTools(mcpServer: McpServer): void
}

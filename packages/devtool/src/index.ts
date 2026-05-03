export { WsMcpServer } from "./ws-mcp-server.js"
export { WebSocketServerTransport } from "./transport.js"
export type { DevtoolModel } from "./model.js"
export type { ExtensionBridge } from "./bridge.js"

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { WsMcpServer } from "./ws-mcp-server.js"
import type { DevtoolModel } from "./model.js"
import type { ExtensionBridge } from "./bridge.js"
import { registerDomTools } from "./tools/dom.js"
import { registerConsoleTools } from "./tools/console.js"
import { registerDiagnosticTools } from "./tools/diagnostics.js"
import { registerStateTools } from "./tools/state.js"

/**
 * Devtool is the main wrapper class that combines a WebSocket MCP server with
 * tool registration. It follows the pattern:
 *
 *   <Devtool><Extension/></Devtool>
 *
 * Where:
 * - Devtool provides generic tools (DOM, click, diagnostics, tracing)
 * - Extension provides its model (domain-specific tools via DevtoolModel)
 *
 * Usage:
 *   const devtool = new Devtool(bridge, model, 60060)
 *   await devtool.start()
 *   // ... later ...
 *   await devtool.stop()
 */
export { DevtoolClient } from "./client.js"
export type { DevtoolClientOptions } from "./client.js"
export { CommandRegistry } from "./command-registry.js"
export type { ExtensionCommand } from "./command-registry.js"

export class Devtool {
	private wsServer: WsMcpServer
	private bridge?: ExtensionBridge
	private model?: DevtoolModel

	constructor(bridge?: ExtensionBridge, model?: DevtoolModel, port: number = 60060) {
		this.wsServer = new WsMcpServer(port)
		this.bridge = bridge
		this.model = model
	}

	/**
	 * Start the WebSocket MCP server and register all tools.
	 * Generic tools are registered first, then the model's domain-specific tools.
	 */
	async start(): Promise<void> {
		await this.wsServer.start()
		const mcpServer = this.wsServer.getMcpServer()

		// Register generic tools (dom, console, diagnostics, state, settings)
		if (this.bridge) {
			this.registerGenericTools(mcpServer)
		}

		// Register domain-specific tools from the model
		if (this.model) {
			this.model.registerTools(mcpServer)
		}
	}

	/**
	 * Stop the WebSocket MCP server.
	 */
	async stop(): Promise<void> {
		await this.wsServer.stop()
	}

	/**
	 * Register generic tools that every devtool instance provides.
	 */
	private registerGenericTools(mcpServer: McpServer): void {
		if (!this.bridge) return
		registerDomTools(mcpServer, this.bridge)
		registerConsoleTools(mcpServer, this.bridge)
		registerDiagnosticTools(mcpServer, this.bridge)
		registerStateTools(mcpServer, this.bridge)
	}

	/**
	 * Stop the global Devtool instance (used from extension.ts deactivate()).
	 * This is a convenience wrapper around WsMcpServer's global state cleanup.
	 */
	static async stopGlobalInstance(): Promise<void> {
		const server = new WsMcpServer()
		await server.stop()
	}
}

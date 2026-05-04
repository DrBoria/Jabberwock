export { WsMcpServer } from "./ws-mcp-server.js"
export { WebSocketServerTransport } from "./transport.js"
export type { DevtoolModel } from "./model.js"
export type { ExtensionBridge } from "./bridge.js"
export { createDevtoolBridge } from "./bridge-factory.js"
export type { DevtoolBridgeProvider } from "./bridge-factory.js"

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { WsMcpServer } from "./ws-mcp-server.js"
import type { DevtoolModel } from "./model.js"
import type { ExtensionBridge } from "./bridge.js"
import { registerDomTools } from "./tools/dom.js"
import { registerConsoleTools } from "./tools/console.js"
import { registerDiagnosticTools } from "./tools/diagnostics.js"
import { registerStateTools } from "./tools/state.js"
import { registerEventBusTools } from "./tools/eventBus.js"
import { registerCommandTools } from "./tools/commands.js"
import { MessageInterceptor } from "./interceptor.js"

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

// Diagnostics module (moved from src/core/devtools/)
export {
	DiagnosticsManager,
	diagnosticsManager,
	DevToolsLogger,
	Tracer,
	ResourceMonitor,
	TimelineTracker,
	LifecycleManager,
	LogFileManager,
} from "./diagnostics/index.js"
export type {
	ToolTrace,
	TaskTrace,
	SnapshotFilters,
	ExtendedDiagnosticSnapshot,
	TimelineEvent,
	TimelineEventType,
	TimelineFilters,
} from "./diagnostics/types.js"

export { MessageInterceptor } from "./interceptor.js"
export type { InterceptorConfig, TraceEntry, TraceFilter } from "./interceptor.js"

export class Devtool {
	private wsServer: WsMcpServer
	private bridge?: ExtensionBridge
	private model?: DevtoolModel
	private interceptor?: MessageInterceptor

	constructor(
		bridge?: ExtensionBridge,
		model?: DevtoolModel,
		port: number = 60060,
		interceptor?: MessageInterceptor,
	) {
		this.wsServer = new WsMcpServer(port)
		this.bridge = bridge
		this.model = model
		this.interceptor = interceptor
	}

	/**
	 * Start the WebSocket MCP server and register all tools.
	 * Generic tools are registered first, then the model's domain-specific tools.
	 */
	async start(): Promise<void> {
		await this.wsServer.start()
		const mcpServer = this.wsServer.getMcpServer()

		// Register generic tools (dom, console, diagnostics, state, eventBus)
		if (this.bridge) {
			this.registerGenericTools(mcpServer)
		}

		// Register event bus tools (interceptor-based)
		if (this.interceptor) {
			registerEventBusTools(mcpServer, this.interceptor)
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
		registerCommandTools(mcpServer, this.bridge)
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

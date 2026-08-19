import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { WsMcpServer } from "./server/ws-mcp-server.js"
import type { DevtoolModel } from "./api/mst/types.js"
import type { ExtensionBridge } from "./api/bridge.js"
import { registerDomTools } from "./api/tools/dom.js"
import { registerConsoleTools } from "./api/tools/console.js"
import { registerDiagnosticTools } from "./api/tools/diagnostics.js"
import { registerStateTools } from "./api/tools/state.js"
import { registerEventBusTools } from "./api/tools/eventBus.js"
import { registerCommandTools } from "./api/tools/commands.js"
import { MessageInterceptor } from "./api/utils/interceptor.js"
import { startHttpStatusServer, stopHttpStatusServer } from "./api/http-server.js"

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
export class Devtool {
	private wsServer: WsMcpServer
	private bridge?: ExtensionBridge
	private model?: DevtoolModel
	private interceptor?: MessageInterceptor
	private statusPort: number

	constructor(
		bridge?: ExtensionBridge,
		model?: DevtoolModel,
		port: number = 60060,
		interceptor?: MessageInterceptor,
		statusPort: number = 60061,
	) {
		this.wsServer = new WsMcpServer(port)
		this.bridge = bridge
		this.model = model
		this.interceptor = interceptor
		this.statusPort = statusPort
	}

	/**
	 * Start the HTTP status server, WebSocket MCP server, and register all tools.
	 * The status server is started first so the stdio MCP proxy can detect
	 * extension availability by polling http://127.0.0.1:{statusPort}/status.
	 * Generic tools are registered first, then the model's domain-specific tools.
	 */
	async start(): Promise<void> {
		// Start HTTP status server first (stdio proxy polls this)
		try {
			await startHttpStatusServer(this.statusPort)
		} catch (err) {
			console.warn(`[devtool] Failed to start HTTP status server on port ${this.statusPort}:`, err)
		}

		// Create the McpServer FIRST so tools can be registered
		// BEFORE the WebSocket server starts accepting connections.
		// This prevents the race condition where a client connects
		// during init handshake and sees empty capabilities.
		const mcpServer = this.wsServer.createServer()

		// Register generic tools (dom, console, diagnostics, state, eventBus)
		if (this.bridge) {
			this.registerGenericTools(mcpServer)
		}

		// Register event bus tools (interceptor-based)
		if (this.interceptor) {
			registerEventBusTools(mcpServer, this.interceptor)
		}

		// Register domain-specific tools from the model
		if (this.model?.registerTools) {
			this.model.registerTools(mcpServer)
		}

		// Now start the WebSocket server — all tools are already registered,
		// so any client that connects will immediately see them.
		await this.wsServer.start()
	}

	/**
	 * Stop the HTTP status server and WebSocket MCP server.
	 */
	async stop(): Promise<void> {
		stopHttpStatusServer()
		await this.wsServer.stop()
	}

	/**
	 * Register generic tools that every devtool instance provides.
	 *
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

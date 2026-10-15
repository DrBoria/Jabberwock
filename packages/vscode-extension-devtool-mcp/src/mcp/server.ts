/**
 * MCP orchestrator. Accepts a host provider plus a config, builds the concrete
 * devtool methods, starts the transports (HTTP status + WebSocket MCP), and
 * registers each domain's tools through its `tools.ts` selector. There is no
 * abstract "bridge" entity: every domain tool calls straight into the single
 * concrete {@link DevtoolMethods} object.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { DevtoolModel, BackendStore, FrontendBridge, StoreEnv } from "../types.js"
import { MessageInterceptor } from "./interceptor/index.js"
import { registerBackendInterceptorTools } from "../backend/interceptor/tools.js"
import { registerFrontendInterceptorTools } from "../frontend/interceptor/tools.js"
import type { FrontendMessageInterceptor } from "../frontend/interceptor/index.js"
import type { DevtoolConfig } from "./config.js"
import { WsMcpServer } from "./transport/ws.js"
import { startHttpStatusServer, stopHttpStatusServer, type HostIdentity } from "./transport/http.js"
import { buildDevtoolMethods } from "./methods.js"
import type { DevtoolMethods } from "./methods.js"
import { registerBackendTools } from "../backend/tools.js"
import { registerStoreTools } from "../stores/tools.js"
import { registerFrontendTools } from "../frontend/tools.js"

// Re-exported so consumers keep a single import point for the orchestrator's
// public surface (methods type + DOM-query plumbing).
export type { DevtoolMethods } from "./methods.js"
export { sendDomQuery, nextRequestId, registerGlobalErrorHandlers } from "./dom-query.js"
export type { DomQueryResult } from "./dom-query.js"

// ── Tool result helpers ─────────────────────────────────────────────────────

export type ToolResult = {
	content: Array<{ type: "text"; text: string }>
	isError?: boolean
}

export async function wrapBridge<T>(bridgeCall: () => Promise<T>): Promise<ToolResult> {
	try {
		const result = await bridgeCall()
		return { content: [{ type: "text", text: String(result) }] }
	} catch (error) {
		return {
			content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
			isError: true,
		}
	}
}

// ── Provider plumbing ────────────────────────────────────────────────────────

/**
 * Provider interface that must be implemented by the consumer (e.g., the VS Code extension).
 */
export interface DevtoolBridgeProvider {
	findElement: (selector: string, depth?: number, maxChildren?: number, command?: string) => Promise<string>
	getActivePage: (requestId: string) => void
	setActivePageRequestCallback: (requestId: string, callback: (result: string, connector?: string) => void) => void
	setDomRequestCallback: (requestId: string, callback: (result: string, connector?: string) => void) => void
	postMessageToWebview: (type: string, payload?: Record<string, unknown>) => void
	getModes: () => string[]
	getMode: () => string
	getTaskWithId?: (taskId: string) => Record<string, unknown> | undefined
	/** Execute a host command (`vscode.commands.executeCommand` in extension mode). */
	executeCommand?: (command: string, args?: unknown) => Promise<void>
	/** Host extension version for `getExtensionInfo`; absent in server mode ("dev"). */
	getExtensionVersion?: () => string | undefined
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

/**
 * DevtoolServer combines a WebSocket MCP server with tool registration: it
 * builds the concrete devtool methods from a host provider (or accepts
 * pre-built methods), starts the transports, and registers each domain's tools
 * through its `tools.ts` selector.
 */
export class DevtoolServer {
	private wsServer: WsMcpServer
	private methods?: DevtoolMethods
	private model?: DevtoolModel
	private interceptor?: MessageInterceptor
	private frontendInterceptor?: FrontendMessageInterceptor
	private statusPort: number
	private identity?: HostIdentity
	private storeEnvs: StoreEnv[]

	/**
	 * @param init - Either a host provider (the methods are built internally
	 *   from it plus the config) or pre-built methods.
	 * @param model - Optional domain-specific model (registers extra MCP tools).
	 * @param port - WebSocket MCP port.
	 * @param interceptor - Optional backend message interceptor (registers the
	 *   backend interceptor tools).
	 * @param statusPort - HTTP status port (polled by the stdio proxy).
	 * @param identity - Window/workspace identity for the status server.
	 * @param storeEnvs - Store environments whose state tools are registered.
	 * @param frontendInterceptor - Optional webview-side interceptor (registers
	 *   the `frontend_*` interceptor tools).
	 */
	constructor(
		init:
			| {
					provider: DevtoolBridgeProvider
					config?: DevtoolConfig
					backendStore?: BackendStore
					frontendBridge?: FrontendBridge
			  }
			| { methods: DevtoolMethods }
			| undefined,
		model?: DevtoolModel,
		port: number = 60060,
		interceptor?: MessageInterceptor,
		statusPort: number = 60061,
		identity?: HostIdentity,
		storeEnvs: StoreEnv[] = ["backend", "frontend"],
		frontendInterceptor?: FrontendMessageInterceptor,
	) {
		this.wsServer = new WsMcpServer(port)
		if (init && "provider" in init) {
			this.methods = buildDevtoolMethods(init.provider, init.config, init.backendStore, init.frontendBridge)
		} else if (init && "methods" in init) {
			this.methods = init.methods
		}
		this.model = model
		this.interceptor = interceptor
		this.statusPort = statusPort
		this.identity = identity
		this.storeEnvs = storeEnvs
		this.frontendInterceptor = frontendInterceptor
	}

	/**
	 * Start the HTTP status server and WebSocket MCP server, and register all
	 * tools. The status server starts first so the stdio proxy can detect
	 * extension availability by polling http://127.0.0.1:{statusPort}/status.
	 */
	async start(): Promise<void> {
		// Identity is injected by the caller: the package must stay vscode-free
		// (it is also reachable from the web server bundle, where "vscode" is not
		// resolvable).
		try {
			await startHttpStatusServer(this.statusPort, this.identity)
		} catch (err) {
			console.warn(`[devtool] Failed to start HTTP status server on port ${this.statusPort}:`, err)
		}

		// The McpServer is created FIRST so tools are registered before the
		// WebSocket server accepts connections (a client connecting during the
		// init handshake would otherwise see empty capabilities).
		const mcpServer = this.wsServer.createServer()
		if (this.methods) {
			this.registerGenericTools(mcpServer)
		}
		if (this.model?.registerTools) {
			this.model.registerTools(mcpServer)
		}

		// All tools are registered now — any connecting client sees them.
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
	 * Register the generic tools every devtool instance provides, delegating to
	 * each domain's `tools.ts` selector: backend (console/diagnostics/commands/
	 * info), stores (env-gated), frontend (DOM/console/screenshot), and the
	 * backend and/or frontend interceptor tools (only when the corresponding
	 * interceptor exists).
	 */
	private registerGenericTools(mcpServer: McpServer): void {
		if (!this.methods) return
		registerBackendTools(mcpServer, this.methods)
		registerStoreTools(mcpServer, this.methods, this.storeEnvs)
		registerFrontendTools(mcpServer, this.methods)
		if (this.interceptor) {
			registerBackendInterceptorTools(mcpServer, this.interceptor)
		}
		if (this.frontendInterceptor) {
			registerFrontendInterceptorTools(mcpServer, this.frontendInterceptor)
		}
	}

	/**
	 * Stop the global Devtool instance (used from "extension.ts" deactivate()).
	 * This is a convenience wrapper around WsMcpServer's global state cleanup.
	 */
	static async stopGlobalInstance(): Promise<void> {
		const server = new WsMcpServer()
		await server.stop()
	}
}

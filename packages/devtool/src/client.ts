/**
 * DevtoolClient — WebSocket MCP client for Jabberwock E2E testing.
 *
 * This is the "Playwright" layer: it handles:
 * - Reading the WebSocket URL from mcp_settings.json
 * - WebSocket connection management (connect, disconnect, reconnect)
 * - JSON-RPC message passing (initialize, tools/call)
 * - Exposing raw primitives (getDom, clickElement, findElement, etc.)
 *
 * Tests should NOT use this directly. Instead, use ExtensionModel (Page Model)
 * which composes these primitives into declarative, domain-specific methods.
 *
 * Usage:
 *   const client = new DevtoolClient()
 *   await client.connect()
 *   const dom = await client.getDom()
 *   await client.clickElement("#some-id")
 *   await client.disconnect()
 */

import { readFileSync, existsSync } from "fs"
import { homedir } from "os"
import { join } from "path"

// ── JSON-RPC response types ────────────────────────────────────────────────────

interface JsonRpcError {
	code: number
	message: string
	data?: unknown
}

interface JsonRpcResponse {
	id: number
	result?: unknown
	error?: JsonRpcError
}

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_PORT = 60060
const MCP_SETTINGS_PATH = join(
	homedir(),
	"Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json",
)

// ── JSON-RPC helpers ───────────────────────────────────────────────────────

let _requestId = 0
function nextId(): number {
	return ++_requestId
}

function createInitializeRequest() {
	return JSON.stringify({
		jsonrpc: "2.0",
		id: nextId(),
		method: "initialize",
		params: {
			protocolVersion: "2024-11-05",
			capabilities: {},
			clientInfo: { name: "jabberwock-e2e", version: "1.0.0" },
		},
	})
}

const INITIALIZED_NOTIFICATION = JSON.stringify({
	jsonrpc: "2.0",
	method: "notifications/initialized",
})

function createToolCallRequest(name: string, args: Record<string, unknown> = {}) {
	return JSON.stringify({
		jsonrpc: "2.0",
		id: nextId(),
		method: "tools/call",
		params: { name, arguments: args },
	})
}

// ── Transport ──────────────────────────────────────────────────────────────

/**
 * Raw WebSocket transport for JSON-RPC communication.
 * Uses native WebSocket (available in Node.js 22+ and modern runtimes).
 */
class RawWsTransport {
	private ws: WebSocket | null = null
	private url: string
	private messageQueue: string[] = []
	private isConnected = false
	private pendingResolve: ((value: void) => void) | null = null
	private pendingReject: ((err: Error) => void) | null = null

	onmessage?: (message: { content: unknown }) => void
	onerror?: (error: Error) => void
	onclose?: () => void

	constructor(url: URL) {
		this.url = url.toString()
	}

	async start(): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				this.ws = new WebSocket(this.url)
			} catch (err) {
				reject(err)
				return
			}
			this.pendingResolve = resolve
			this.pendingReject = reject

			this.ws.onopen = () => {
				this.isConnected = true
				for (const msg of this.messageQueue) {
					this.ws?.send(msg)
				}
				this.messageQueue = []
				if (this.pendingResolve) {
					this.pendingResolve()
					this.pendingResolve = null
				}
			}

			this.ws.onerror = () => {
				const err = new Error("WebSocket connection error")
				this.onerror?.(err)
				if (this.pendingReject) {
					this.pendingReject(err)
					this.pendingResolve = null
					this.pendingReject = null
				}
			}

			this.ws.onmessage = (event: MessageEvent) => {
				try {
					const data = JSON.parse(event.data as string)
					this.onmessage?.({ content: data })
				} catch {
					this.onmessage?.({ content: event.data })
				}
			}

			this.ws.onclose = () => {
				this.isConnected = false
				if (this.pendingReject) {
					this.pendingReject(new Error("WebSocket closed before connection established"))
					this.pendingResolve = null
					this.pendingReject = null
				}
				this.onclose?.()
			}
		})
	}

	async send(message: unknown): Promise<void> {
		const json = JSON.stringify(message)
		if (this.ws && this.isConnected) {
			this.ws.send(json)
		} else {
			this.messageQueue.push(json)
		}
	}

	async close(): Promise<void> {
		this.isConnected = false
		this.ws?.close()
		this.ws = null
	}
}

// ── Client ─────────────────────────────────────────────────────────────────

export interface DevtoolClientOptions {
	/** WebSocket port (default: 60060) */
	port?: number
	/** Auto-reconnect on disconnect (default: true) */
	autoReconnect?: boolean
	/** Timeout for JSON-RPC requests in ms (default: 30000) */
	requestTimeout?: number
}

/**
 * DevtoolClient is the "Playwright" layer for Jabberwock E2E testing.
 *
 * Responsibilities:
 * - Read WebSocket URL from mcp_settings.json (or use default port)
 * - Connect/disconnect/reconnect to the devtool WebSocket server
 * - Send JSON-RPC tool calls and receive responses
 * - Expose raw primitives matching the MCP tools
 *
 * This class contains NO test logic, NO page model methods.
 * It is purely transport + primitives.
 */
export class DevtoolClient {
	private transport: RawWsTransport | null = null
	private connected = false
	private pendingRequests: Map<number, { resolve: (val: unknown) => void; reject: (err: Error) => void }> = new Map()
	private options: Required<DevtoolClientOptions>

	constructor(options: DevtoolClientOptions = {}) {
		this.options = {
			port: options.port ?? DEFAULT_PORT,
			autoReconnect: options.autoReconnect ?? true,
			requestTimeout: options.requestTimeout ?? 30000,
		}
	}

	// ── Connection Management ────────────────────────────────────────────

	/**
	 * Read the WebSocket URL from mcp_settings.json.
	 * Falls back to the default port if the file doesn't exist or parsing fails.
	 */
	static resolveUrl(options?: { port?: number }): string {
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

	/**
	 * Connect to the devtool WebSocket server.
	 * Performs MCP initialize handshake automatically.
	 */
	async connect(): Promise<void> {
		if (this.connected) return

		const url = DevtoolClient.resolveUrl({ port: this.options.port })
		this.transport = new RawWsTransport(new URL(url))

		this.transport.onmessage = (msg: { content: unknown }) => {
			const response = msg.content as JsonRpcResponse
			if (response.id !== undefined && this.pendingRequests.has(response.id)) {
				const { resolve, reject } = this.pendingRequests.get(response.id)!
				this.pendingRequests.delete(response.id)
				if (response.error) {
					reject(new Error(response.error.message || "JSON-RPC error"))
				} else {
					resolve(response.result)
				}
			}
		}

		this.transport.onerror = (err: Error) => {
			console.error("[DevtoolClient] Transport error:", err.message)
		}

		this.transport.onclose = () => {
			console.log("[DevtoolClient] Transport closed")
			this.connected = false
			for (const [id, { reject }] of this.pendingRequests) {
				reject(new Error(`WebSocket closed, request ${id} rejected`))
			}
			this.pendingRequests.clear()

			if (this.options.autoReconnect) {
				console.log("[DevtoolClient] Auto-reconnecting in 1s...")
				setTimeout(() => {
					this.connect().catch((err) => console.error("[DevtoolClient] Reconnect failed:", err.message))
				}, 1000)
			}
		}

		await this.transport.start()

		// MCP initialize handshake
		const initResponse = await this.rawRequest(createInitializeRequest())
		const initResult = initResponse as { protocolVersion?: string }
		if (initResult?.protocolVersion) {
			console.log(`[DevtoolClient] MCP initialized (protocol: ${initResult.protocolVersion})`)
		}

		await this.transport.send(JSON.parse(INITIALIZED_NOTIFICATION))

		this.connected = true
		console.log(`[DevtoolClient] Connected to devtool at ${url}`)
	}

	/**
	 * Disconnect from the devtool WebSocket server.
	 */
	async disconnect(): Promise<void> {
		if (!this.connected) return
		if (this.transport) {
			await this.transport.close()
		}
		this.connected = false
	}

	/**
	 * Reconnect (disconnect + connect).
	 */
	async reconnect(): Promise<void> {
		await this.disconnect()
		await this.connect()
	}

	/**
	 * Hard reconnect with a delay.
	 */
	async hardReconnect(): Promise<void> {
		await this.disconnect()
		await new Promise((r) => setTimeout(r, 500))
		await this.connect()
	}

	/**
	 * Check if the client is currently connected.
	 */
	get isConnected(): boolean {
		return this.connected
	}

	// ── Low-level JSON-RPC ───────────────────────────────────────────────

	/**
	 * Send a raw JSON-RPC request and wait for the response.
	 * @internal
	 */
	private async rawRequest(requestJson: string): Promise<unknown> {
		const request = JSON.parse(requestJson)
		const id = request.id
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.pendingRequests.delete(id)
				reject(new Error(`JSON-RPC request ${id} timed out after ${this.options.requestTimeout}ms`))
			}, this.options.requestTimeout)

			this.pendingRequests.set(id, {
				resolve: (val: unknown) => {
					clearTimeout(timeout)
					resolve(val)
				},
				reject: (err: Error) => {
					clearTimeout(timeout)
					reject(err)
				},
			})

			this.transport?.send(request).catch((err) => {
				clearTimeout(timeout)
				this.pendingRequests.delete(id)
				reject(err)
			})
		})
	}

	/**
	 * Call an MCP tool and return the parsed result.
	 * @internal
	 */
	async callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
		if (!this.connected) {
			await this.connect()
		}
		try {
			const result = await this.rawRequest(createToolCallRequest(name, args))
			const resultRecord = result as { content?: Array<{ type: string; text: string }> }
			const content = resultRecord?.content || []
			const textContent = content
				.filter((c) => c.type === "text")
				.map((c) => c.text)
				.join("\n")
			try {
				return JSON.parse(textContent)
			} catch {
				return textContent
			}
		} catch (error) {
			console.error(`[DevtoolClient] Tool call failed: ${name}`, error)
			throw error
		}
	}

	// ══════════════════════════════════════════════════════════════════════
	//  CORE PRIMITIVES — Playwright-style DOM interaction
	// ══════════════════════════════════════════════════════════════════════

	/**
	 * Get the full DOM serialization of the webview.
	 */
	async getDom(maxDepth?: number, maxChildren?: number): Promise<string> {
		return this.callTool("get_dom", { maxDepth, maxChildren }) as Promise<string>
	}

	/**
	 * Find a DOM element by selector (text, CSS, or data-testid).
	 */
	async findElement(selector: string): Promise<string> {
		return this.callTool("find_element", { selector }) as Promise<string>
	}

	/**
	 * Click a DOM element by its id or CSS selector.
	 */
	async clickElement(id: string): Promise<string> {
		return this.callTool("click_element", { id }) as Promise<string>
	}

	/**
	 * Type text into an input/textarea element by its id.
	 */
	async typeText(id: string, text: string): Promise<string> {
		return this.callTool("type_text", { id, text }) as Promise<string>
	}

	/**
	 * Scroll a DOM element in a direction.
	 */
	async scrollElement(id: string, direction: "up" | "down" | "left" | "right"): Promise<string> {
		return this.callTool("scroll_element", { id, direction }) as Promise<string>
	}

	/**
	 * Select an option in a select element.
	 */
	async selectOption(id: string, value: string): Promise<string> {
		return this.callTool("select_option", { id, value }) as Promise<string>
	}

	// ══════════════════════════════════════════════════════════════════════
	//  CONSOLE & DIAGNOSTICS
	// ══════════════════════════════════════════════════════════════════════

	/**
	 * Get console logs from the devtool.
	 */
	async getConsoleLogs(level?: string, limit?: number, offset?: number): Promise<string> {
		return this.callTool("get_console_logs", { level, limit, offset }) as Promise<string>
	}

	/**
	 * Get diagnostic logs.
	 */
	async getLogs(lines?: number): Promise<string> {
		return this.callTool("get_logs", { lines }) as Promise<string>
	}

	/**
	 * Get a diagnostics snapshot.
	 */
	async getDiagnosticsSnapshot(params?: {
		limit?: number
		offset?: number
		level?: string
		search?: string
		includeLogs?: boolean
		includeMetrics?: boolean
		includePatches?: boolean
		includeTraces?: boolean
		includeResources?: boolean
	}): Promise<string> {
		return this.callTool("get_diagnostics_snapshot", params ?? {}) as Promise<string>
	}

	/**
	 * Clear diagnostics.
	 */
	async clearDiagnostics(): Promise<string> {
		return this.callTool("clear_diagnostics", {}) as Promise<string>
	}

	// ══════════════════════════════════════════════════════════════════════
	//  MST STATE
	// ══════════════════════════════════════════════════════════════════════

	/**
	 * Query an MST store.
	 */
	async getMstState(params: {
		store?: string
		mode?: string
		depth?: number
		path?: string
		nodeId?: string
		fields?: string
	}): Promise<unknown> {
		return this.callTool("get_mst_state", params)
	}

	/**
	 * Get extension info.
	 */
	async getExtensionInfo(): Promise<unknown> {
		return this.callTool("get_extension_info", {})
	}

	/**
	 * Get current state.
	 */
	async getCurrentState(): Promise<unknown> {
		return this.callTool("get_current_state", {})
	}

	// ══════════════════════════════════════════════════════════════════════
	//  TASK MANAGEMENT
	// ══════════════════════════════════════════════════════════════════════

	/**
	 * Create a new task.
	 */
	async createNewTask(text: string, mode?: string, force?: boolean): Promise<unknown> {
		return this.callTool("create_new_task", { text, mode, force })
	}

	/**
	 * Start a task.
	 */
	async startTask(text: string, mode?: string, force?: boolean): Promise<unknown> {
		return this.callTool("start_task", { text, mode, force })
	}

	/**
	 * Clear the current task.
	 */
	async clearTask(): Promise<unknown> {
		return this.callTool("clear_task", {})
	}

	/**
	 * Pop the current window.
	 */
	async popWindow(): Promise<unknown> {
		return this.callTool("pop_window", {})
	}

	/**
	 * Navigate to a specific task.
	 */
	async navigateToTask(taskId: string): Promise<unknown> {
		return this.callTool("navigate_to_task", { taskId })
	}

	/**
	 * Get task status.
	 */
	async getTaskStatus(): Promise<unknown> {
		return this.callTool("get_task_status", {})
	}

	/**
	 * Get task hierarchy.
	 */
	async getTaskHierarchy(): Promise<unknown> {
		return this.callTool("get_task_hierarchy", {})
	}

	/**
	 * Get child tasks.
	 */
	async getChildTasks(): Promise<unknown> {
		return this.callTool("get_child_tasks", {})
	}

	/**
	 * Get task summary.
	 */
	async getTaskSummary(): Promise<unknown> {
		return this.callTool("get_task_summary", {})
	}

	/**
	 * Get todo list.
	 */
	async getTodoList(): Promise<unknown> {
		return this.callTool("get_todo_list", {})
	}

	/**
	 * Mark a task as async.
	 */
	async markTaskAsync(taskId: string): Promise<unknown> {
		return this.callTool("mark_task_async", { taskId })
	}

	/**
	 * Wait for a task to be idle.
	 */
	async waitForTaskIdle(timeoutMs?: number): Promise<unknown> {
		return this.callTool("wait_for_task_idle", { timeoutMs })
	}

	/**
	 * Wait for an ask response.
	 */
	async waitForAsk(timeoutMs?: number, askType?: string): Promise<unknown> {
		return this.callTool("wait_for_ask", { timeoutMs, askType })
	}

	/**
	 * Get workspace state.
	 */
	async getWorkspaceState(): Promise<unknown> {
		return this.callTool("get_workspace_state", {})
	}

	/**
	 * Get virtual files.
	 */
	async getVirtualFiles(): Promise<unknown> {
		return this.callTool("get_virtual_files", {})
	}

	/**
	 * Get checkpoint info.
	 */
	async getCheckpointInfo(): Promise<unknown> {
		return this.callTool("get_checkpoint_info", {})
	}

	/**
	 * Create child tasks.
	 */
	async createChildTasks(tasks: Array<{ message: string; mode?: string; todos?: string }>): Promise<unknown> {
		return this.callTool("create_child_tasks", { tasks })
	}

	// ══════════════════════════════════════════════════════════════════════
	//  AGENT / MODE
	// ══════════════════════════════════════════════════════════════════════

	/**
	 * Get available native tools (agents/modes).
	 */
	async getAvailableNativeTools(): Promise<unknown> {
		return this.callTool("get_available_native_tools", {})
	}

	// ══════════════════════════════════════════════════════════════════════
	//  SCREENSHOT & DRAG
	// ══════════════════════════════════════════════════════════════════════

	/**
	 * Capture a screenshot of the webview as a base64-encoded PNG.
	 */
	async getScreenshot(): Promise<string> {
		return this.callTool("get_screenshot", {}) as Promise<string>
	}

	/**
	 * Drag a DOM element in a direction by a number of pixels.
	 * @param selector - CSS selector of the element to drag
	 * @param direction - Direction: "l" (left), "r" (right), "t" (top/up), "b" (bottom/down)
	 * @param pixels - Number of pixels to drag
	 */
	async dragElement(selector: string, direction: "l" | "r" | "t" | "b", pixels: number): Promise<string> {
		return this.callTool("drag_element", { selector, direction, pixels }) as Promise<string>
	}

	/**
	 * Drag from one coordinate to another.
	 * Coordinates use l (left), t (top), r (right from viewport edge), b (bottom from viewport edge).
	 * @param from - Starting position
	 * @param to - Ending position
	 */
	async dragFromTo(
		from: { l?: number; t?: number; r?: number; b?: number },
		to: { l?: number; t?: number; r?: number; b?: number },
	): Promise<string> {
		return this.callTool("drag_from_to", { from, to }) as Promise<string>
	}
}

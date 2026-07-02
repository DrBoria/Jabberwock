import { RawWsTransport } from "./transport.js"
import { JsonRpcResponse, INITIALIZED_NOTIFICATION, resolveUrl, nextId } from "./client-rpc.js"

export interface DevtoolClientOptions {
	port?: number
	autoReconnect?: boolean
	requestTimeout?: number
}

export class DevtoolClient {
	private transport: RawWsTransport | null = null
	private connected = false
	private pendingRequests = new Map<number, { resolve: (value: unknown) => void; reject: (err: Error) => void }>()
	private options: Required<DevtoolClientOptions>

	constructor(options: DevtoolClientOptions = {}) {
		this.options = {
			port: options.port ?? 60060,
			autoReconnect: options.autoReconnect ?? true,
			requestTimeout: options.requestTimeout ?? 30000,
		}
	}

	static resolveUrl(options?: { port?: number }): string {
		return resolveUrl(options)
	}

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
			console.error("[devtool] [DevtoolClient] Transport error:", err.message)
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
					this.connect().catch((err) =>
						console.error("[devtool] [DevtoolClient] Reconnect failed:", err.message),
					)
				}, 1000)
			}
		}

		await this.transport.start()

		const initResponse = await this.rawRequest({
			jsonrpc: "2.0",
			id: nextId(),
			method: "initialize",
			params: {
				protocolVersion: "2024-11-05",
				capabilities: {},
				clientInfo: { name: "jabberwock-e2e", version: "1.0.0" },
			},
		})
		const initResult = initResponse as { protocolVersion?: string }
		if (initResult?.protocolVersion) {
			console.log(`[DevtoolClient] MCP initialized (protocol: ${initResult.protocolVersion})`)
		}

		await this.transport.send(JSON.parse(INITIALIZED_NOTIFICATION))

		this.connected = true
		console.log(`[DevtoolClient] Connected to devtool at ${url}`)
	}

	async disconnect(): Promise<void> {
		if (!this.connected) return
		if (this.transport) {
			await this.transport.close()
		}
		this.connected = false
	}

	async reconnect(): Promise<void> {
		await this.disconnect()
		await this.connect()
	}

	async hardReconnect(): Promise<void> {
		await this.disconnect()
		await new Promise((r) => setTimeout(r, 500))
		await this.connect()
	}

	get isConnected(): boolean {
		return this.connected
	}

	private async rawRequest(request: Record<string, unknown>): Promise<unknown> {
		const id = request.id as number
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

	async callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
		if (!this.connected) {
			await this.connect()
		}
		try {
			const result = await this.rawRequest({
				jsonrpc: "2.0",
				id: nextId(),
				method: "tools/call",
				params: { name, arguments: args },
			})
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
			console.error(`[devtool] [DevtoolClient] Tool call failed: ${name}`, error)
			throw error
		}
	}
}

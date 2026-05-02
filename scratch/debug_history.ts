import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import WebSocket from "ws"

class WebSocketClientTransport implements Transport {
	private ws!: WebSocket
	onclose?: () => void
	onerror?: (error: Error) => void
	onmessage?: (message: any) => void

	constructor(private url: string) {}

	async start(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.ws = new WebSocket(this.url)
			this.ws.on("open", () => resolve())
			this.ws.on("error", (err) => reject(err))
			this.ws.on("message", (data) => {
				try {
					const message = JSON.parse(data.toString())
					this.onmessage?.(message)
				} catch (err) {
					this.onerror?.(err as Error)
				}
			})
			this.ws.on("close", () => this.onclose?.())
		})
	}

	async send(message: any): Promise<void> {
		this.ws.send(JSON.stringify(message))
	}

	async close(): Promise<void> {
		this.ws.close()
	}
}

async function debug() {
	const transport = new WebSocketClientTransport("ws://127.0.0.1:60060/ws")
	await transport.start()
	const client = new Client({ name: "debug", version: "1.0.0" }, { capabilities: { tools: {} } })
	await client.connect(transport)

	const history = await client.callTool({ name: "get_task_history", arguments: {} })
	console.log(JSON.stringify(history, null, 2))
	process.exit(0)
}

debug().catch(console.error)

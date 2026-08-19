/**
 * Raw WebSocket transport for JSON-RPC communication.
 * Uses native WebSocket (available in Node.js 22+ and modern runtimes).
 */
export class RawWsTransport {
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

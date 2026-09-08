import { describe, expect, it, vi } from "vitest"

import { BrowserWsFrontendConnector } from "./connector"
import { BrowserWsEventBus, isDomLocalMessageType } from "./event-bus"
import type { WsSocket } from "./socket"

/**
 * Phase D2 criterion C-4 (plan §4.5 line 463, §8.3): DOM-local messages must be
 * handled IN-PROCESS via a loopback and NEVER sent on the WS wire.
 *
 * In the browser, DOM-local class B traffic (`{type:"action"}`, `{type:"pushWindow"}`
 * and friends) is posted via the standard `window.postMessage` Web API. The bus holds
 * one window listener that loops such messages back to subscribers WITHOUT touching
 * the socket. Host messages, by contrast, are framed as ConnectorEnvelope WS frames.
 *
 * This suite proves that a DOM-local message delivered through the window channel is
 * routed to subscribers while `ws.send` is NOT called, and that host messages ARE sent.
 */

/** A controllable fake socket recording every `send` payload. */
class FakeSocket implements WsSocket {
	readyState = 1 // OPEN
	onopen: (() => void) | null = null
	onmessage: ((data: unknown) => void) | null = null
	onclose: ((info: { code: number; reason: string; wasClean: boolean }) => void) | null = null
	onerror: (() => void) | null = null
	sent: string[] = []
	send(data: string): void {
		this.sent.push(data)
	}
	close(): void {
		this.readyState = 3 // CLOSED
	}
}

/** Minimal window-like object capturing the registered message listener. */
function makeWindowLike() {
	const listeners = new Map<string, (event: MessageEvent) => void>()
	return {
		listeners,
		addEventListener: vi.fn((type: string, handler: (event: MessageEvent) => void) => {
			listeners.set(type, handler)
		}),
		removeEventListener: vi.fn((type: string) => {
			listeners.delete(type)
		}),
	}
}

/** Parse the last recorded frame into its envelope shape. */
function lastEnvelope(socket: FakeSocket): { protocolVersion: number; body: { type: string } } {
	const last = socket.sent[socket.sent.length - 1]
	if (!last) {
		throw new Error("no frame was sent")
	}
	return JSON.parse(last) as { protocolVersion: number; body: { type: string } }
}

describe("isDomLocalMessageType", () => {
	it("classifies the class B DOM-local types as DOM-local", () => {
		expect(isDomLocalMessageType("action")).toBe(true)
		expect(isDomLocalMessageType("dom-response")).toBe(true)
		expect(isDomLocalMessageType("domResponse")).toBe(true)
		expect(isDomLocalMessageType("pushWindow")).toBe(true)
	})

	it("does not classify host protocol types as DOM-local", () => {
		expect(isDomLocalMessageType("state")).toBe(false)
		expect(isDomLocalMessageType("streamChunk")).toBe(false)
		expect(isDomLocalMessageType("requestState")).toBe(false)
		expect(isDomLocalMessageType("newTask")).toBe(false)
	})
})

describe("BrowserWsEventBus DOM-local loopback (criterion C-4)", () => {
	it("loops a DOM-local window message back to subscribers WITHOUT calling sendFrame", () => {
		const sendFrame = vi.fn()
		const windowLike = makeWindowLike()
		const bus = new BrowserWsEventBus({ sendFrame, windowLike })
		const received: Array<{ type: string; action?: string }> = []
		bus.subscribe({ types: ["action"] }, (msg) => received.push(msg as { type: string; action?: string }))

		// Simulate a class B component posting a DOM-local action via window.postMessage.
		const listener = windowLike.listeners.get("message")
		expect(listener).toBeDefined()
		listener?.({ data: { type: "action", action: "settingsButtonClicked" } } as MessageEvent)

		expect(received).toHaveLength(1)
		expect(received[0]?.type).toBe("action")
		expect(received[0]?.action).toBe("settingsButtonClicked")
		// C-4: the DOM-local message never reached the wire.
		expect(sendFrame).not.toHaveBeenCalled()
	})

	it("ignores non-DOM-local window messages (they arrive over the WS instead)", () => {
		const sendFrame = vi.fn()
		const windowLike = makeWindowLike()
		const bus = new BrowserWsEventBus({ sendFrame, windowLike })
		const received: Array<{ type: string }> = []
		bus.subscribe({}, (msg) => received.push(msg as { type: string }))

		const listener = windowLike.listeners.get("message")
		// A host frame (e.g. streamChunk) should NOT be consumed from the window channel.
		listener?.({ data: { type: "streamChunk", taskId: "t1", text: "hi" } } as MessageEvent)

		expect(received).toHaveLength(0)
		expect(sendFrame).not.toHaveBeenCalled()
	})
})

describe("BrowserWsFrontendConnector wire behaviour (criterion C-4)", () => {
	it("sends a hello handshake frame on connect", async () => {
		const socket = new FakeSocket()
		const connector = new BrowserWsFrontendConnector({
			wsUrl: "ws://localhost:3000/ws",
			windowLike: null,
			socketFactory: () => socket,
		})
		const connectPromise = connector.connect()
		socket.onopen?.()
		await connectPromise

		expect(socket.sent.length).toBeGreaterThanOrEqual(1)
		const hello = lastEnvelope(socket)
		expect(hello.protocolVersion).toBe(1)
		expect(hello.body.type).toBe("hello")
		connector.disconnect()
	})

	it("NEVER calls ws.send for a DOM-local window message (C-4)", async () => {
		const socket = new FakeSocket()
		const windowLike = makeWindowLike()
		const connector = new BrowserWsFrontendConnector({
			wsUrl: "ws://localhost:3000/ws",
			windowLike,
			socketFactory: () => socket,
		})
		const connectPromise = connector.connect()
		socket.onopen?.()
		await connectPromise

		// Clear the hello frame so we can assert no DOM-local frame is added.
		socket.sent.length = 0

		const received: Array<{ type: string; action?: string }> = []
		connector.eventBus.subscribe({ types: ["action"] }, (msg) =>
			received.push(msg as { type: string; action?: string }),
		)

		// A class B component posts a DOM-local action via window.postMessage.
		const listener = windowLike.listeners.get("message")
		listener?.({ data: { type: "action", action: "settingsButtonClicked" } } as MessageEvent)

		// C-4: the DOM-local message was delivered in-process and ws.send was NOT called.
		expect(received).toHaveLength(1)
		expect(received[0]?.action).toBe("settingsButtonClicked")
		expect(socket.sent).toHaveLength(0)
		connector.disconnect()
	})

	it("sends a host publish as a ConnectorEnvelope WS frame", async () => {
		const socket = new FakeSocket()
		const connector = new BrowserWsFrontendConnector({
			wsUrl: "ws://localhost:3000/ws",
			windowLike: null,
			socketFactory: () => socket,
		})
		const connectPromise = connector.connect()
		socket.onopen?.()
		await connectPromise

		socket.sent.length = 0
		connector.eventBus.publish({ type: "requestState" })

		expect(socket.sent).toHaveLength(1)
		const envelope = lastEnvelope(socket)
		expect(envelope.protocolVersion).toBe(1)
		expect(envelope.body.type).toBe("requestState")
		connector.disconnect()
	})

	it("routes an inbound state frame to subscribers and replays it to late subscribers", async () => {
		const socket = new FakeSocket()
		const connector = new BrowserWsFrontendConnector({
			wsUrl: "ws://localhost:3000/ws",
			windowLike: null,
			socketFactory: () => socket,
		})
		const connectPromise = connector.connect()
		socket.onopen?.()
		await connectPromise

		// Simulate the server's hello -> state handshake response.
		const stateFrame = JSON.stringify({
			protocolVersion: 1,
			clientId: "client-1",
			sentAt: Date.now(),
			body: { type: "state", state: { connectorId: "web" }, _hydration: true },
		})
		socket.onmessage?.(stateFrame)

		const received: Array<{ type: string }> = []
		connector.eventBus.subscribe({ types: ["state"] }, (msg) => received.push(msg as { type: string }))

		// The hydration state was cached and replayed to the late subscriber.
		expect(received).toHaveLength(1)
		expect(received[0]?.type).toBe("state")
		connector.disconnect()
	})

	it("reconnects with backoff after the socket closes and re-sends hello", async () => {
		const sockets: FakeSocket[] = []
		const connector = new BrowserWsFrontendConnector({
			wsUrl: "ws://localhost:3000/ws",
			windowLike: null,
			reconnectBaseMs: 1,
			reconnectMaxMs: 2,
			socketFactory: () => {
				const s = new FakeSocket()
				sockets.push(s)
				return s
			},
		})
		const connectPromise = connector.connect()
		sockets[0]?.onopen?.()
		await connectPromise

		// Drop the connection: the connector should open a second socket and re-hello.
		sockets[0]?.onclose?.({ code: 1006, reason: "abnormal", wasClean: false })

		// Wait for the backoff timer (1ms) to fire and the reconnect to open.
		await new Promise((resolve) => setTimeout(resolve, 20))
		expect(sockets.length).toBeGreaterThanOrEqual(2)
		sockets[1]?.onopen?.()

		// The reconnect socket sent a fresh hello handshake.
		const hello = lastEnvelope(sockets[1]!)
		expect(hello.body.type).toBe("hello")
		connector.disconnect()
	})
})

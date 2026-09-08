import { describe, expect, it } from "vitest"
import type { BackendCapabilities, ClientTarget, IBackendConnector, WebviewMessage } from "@jabberwock/types"

import { AskClaimTracker } from "./ask-claims"
import { EventBridge } from "./EventBridge"
import { EventBusPubSub } from "@features/foundation/capabilities/pubsub"
import { InMemoryMessageQueue } from "@features/foundation/capabilities/in-memory-queue"
import { wireInboundToQueue } from "./inbound-wiring"
import { onWebviewMessage, webviewMessageHandler } from "./events/handlers/on-webview-message"

/**
 * v4 §4.2 FakeConnector — in-memory IBackendConnector used by the transport-agnostic
 * EventBridge unit tests. `sendOutbound` records into `outbox[]`; `inject(clientId, body)`
 * drives the inbound stream. No vscode, no network — deterministic.
 */
class FakeConnector implements IBackendConnector {
	readonly id = "vscode" as const
	readonly outbox: Array<{ message: { type: string; [key: string]: unknown }; target?: ClientTarget }> = []

	private inboundHandlers: Array<(clientId: string, body: WebviewMessage) => void> = []
	private isStarted = false

	async start(_deps: BackendCapabilities, _opts?: Record<string, unknown>): Promise<void> {
		this.isStarted = true
	}

	async stop(): Promise<void> {
		this.isStarted = false
		this.inboundHandlers = []
	}

	sendOutbound(message: { type: string; [key: string]: unknown }, target?: ClientTarget): void {
		this.outbox.push({ message, target })
	}

	onInbound(handler: (clientId: string, body: WebviewMessage) => void) {
		this.inboundHandlers.push(handler)
		return { dispose: () => this.removeInboundHandler(handler) }
	}

	/** Push an inbound message exactly as a transport client would. */
	inject(clientId: string, body: WebviewMessage): void {
		for (const handler of [...this.inboundHandlers]) {
			handler(clientId, body)
		}
	}

	get started(): boolean {
		return this.isStarted
	}

	private removeInboundHandler(handler: (clientId: string, body: WebviewMessage) => void): void {
		const idx = this.inboundHandlers.indexOf(handler)
		if (idx !== -1) this.inboundHandlers.splice(idx, 1)
	}
}

function createCapabilities(): BackendCapabilities {
	return {
		hashmapMemory: {
			get: async () => undefined,
			set: async () => {},
			delete: async () => {},
			keys: async () => [],
		},
		queue: new InMemoryMessageQueue(),
		pubsub: new EventBusPubSub(),
		config: {
			get: <T>(_section: string, _key: string, defaultValue?: T): T | undefined => defaultValue,
			update: async (_section: string, _key: string, _value: unknown): Promise<void> => {},
		},
		uiDialogs: {
			showOpenDialog: async () => undefined,
			showInputBox: async () => undefined,
			showInformationMessage: async () => undefined,
			showWarningMessage: async () => undefined,
			showSaveDialog: async () => undefined,
			showConfirmDialog: async () => undefined,
		},
		hostContext: { storageDir: "/tmp/jabberwock-test", workspaceRoot: "" },
		logger: {
			info: () => {},
			warn: () => {},
			appendLine: () => {},
		},
	}
}

/** Test-only cast for fictional/injected message shapes that are not (yet) members of the WebviewMessage union. */
function makeMessage(body: Record<string, unknown>): WebviewMessage {
	return body as never as WebviewMessage
}

/** Drain `count` items from the queue and feed them to the existing webviewMessageHandler resolver (§4.6). */
async function drainQueue(caps: BackendCapabilities, provider: EventBridge, count: number): Promise<void> {
	const iterable = caps.queue.drain()
	let drained = 0
	for await (const item of iterable) {
		await webviewMessageHandler(provider, item.body)
		drained++
		if (drained >= count) break
	}
}

describe("EventBridge (transport-agnostic, §4.2)", () => {
	it("postMessageToWebview routes through connector.sendOutbound → outbox", async () => {
		const connector = new FakeConnector()
		const caps = createCapabilities()
		const bridge = new EventBridge(connector, caps)

		await bridge.postMessageToWebview({ type: "action", action: "chatButtonClicked" })

		expect(connector.outbox).toHaveLength(1)
		expect(connector.outbox[0].message).toMatchObject({ type: "action", action: "chatButtonClicked" })
		expect(connector.outbox[0].target).toBeUndefined()
	})

	it("postMessageToWebview forwards broadcast and client targets verbatim", async () => {
		const connector = new FakeConnector()
		const caps = createCapabilities()
		const bridge = new EventBridge(connector, caps)

		await bridge.postMessageToWebview(
			{ type: "notification.ask.follow_up", requestId: "req-1" },
			{ kind: "broadcast" },
		)
		await bridge.postMessageToWebview({ type: "some.type" }, { kind: "client", clientId: "watch-1" })

		expect(connector.outbox).toHaveLength(2)
		expect(connector.outbox[0].target).toEqual({ kind: "broadcast" })
		expect(connector.outbox[1].target).toEqual({ kind: "client", clientId: "watch-1" })
	})

	it("inject → queue → drain → webviewMessageHandler resolver (connector → queue → resolver, §4.6)", async () => {
		const connector = new FakeConnector()
		const caps = createCapabilities()
		const bridge = new EventBridge(connector, caps)

		wireInboundToQueue(connector, caps.queue, "vscode")

		const received: Array<{ type: string; [key: string]: unknown }> = []
		onWebviewMessage("test.ping", (_provider, message) => {
			received.push(message as { type: string; [key: string]: unknown })
		})

		connector.inject("sidebar", makeMessage({ type: "test.ping", ping: true }))

		await drainQueue(caps, bridge, 1)

		expect(received).toHaveLength(1)
		expect(received[0]).toMatchObject({ type: "test.ping", ping: true })
	})

	it("ask is broadcast to all clients and the FIRST response wins per requestId (§6.4)", async () => {
		const connector = new FakeConnector()
		const caps = createCapabilities()
		const bridge = new EventBridge(connector, caps)

		wireInboundToQueue(connector, caps.queue, "vscode")

		const tracker = new AskClaimTracker<"yes" | "no">()

		onWebviewMessage("askResponse", (provider, message) => {
			const ask = message as never as { requestId: string; answer: "yes" | "no" }
			const result = tracker.claim(ask.requestId, ask.answer)
			if (result.status === "already-answered") {
				void provider.postMessageToWebview({
					type: "askResponseAck",
					requestId: ask.requestId,
					status: "already-answered",
				})
			}
		})

		// Ask is broadcast to every connected client.
		await bridge.postMessageToWebview(
			{ type: "notification.ask.tool_approval", requestId: "req-1" },
			{ kind: "broadcast" },
		)
		expect(connector.outbox[0].target).toEqual({ kind: "broadcast" })

		// Two clients answer the same requestId: browser says "yes", smartwatch says "no".
		connector.inject("browser", makeMessage({ type: "askResponse", requestId: "req-1", answer: "yes" }))
		connector.inject("smartwatch", makeMessage({ type: "askResponse", requestId: "req-1", answer: "no" }))

		await drainQueue(caps, bridge, 2)

		// First response wins; the late responder is acked as already-answered.
		expect(tracker.getDecision("req-1")).toBe("yes")
		const ack = connector.outbox.find((entry) => entry.message.type === "askResponseAck")
		expect(ack).toBeDefined()
		expect(ack?.message).toMatchObject({ requestId: "req-1", status: "already-answered" })
	})
})

describe("AskClaimTracker (first-response-wins, §6.4)", () => {
	it("claims the first decision and rejects later ones for the same requestId", () => {
		const tracker = new AskClaimTracker<"yes" | "no">()

		expect(tracker.claim("req-1", "yes")).toEqual({ status: "claimed", decision: "yes" })
		expect(tracker.claim("req-1", "no")).toEqual({ status: "already-answered", decision: "yes" })

		expect(tracker.has("req-1")).toBe(true)
		expect(tracker.getDecision("req-1")).toBe("yes")

		// Different requestIds are independent.
		expect(tracker.claim("req-2", "no")).toEqual({ status: "claimed", decision: "no" })
	})
})

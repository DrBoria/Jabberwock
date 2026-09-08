/**
 * Browser WS event bus + DOM-local classification (plan §4.5, criterion C-4).
 *
 * The browser event bus adapts the standalone server's WebSocket transport into an
 * in-app `IConnectorEventBus`. Inbound host frames arrive from the socket; DOM-local
 * class B traffic arrives via the standard `window.postMessage` Web API and is looped
 * back to subscribers IN-PROCESS — it never touches the WS wire (plan §4.5 line 463).
 *
 * This module is split out of `connector.ts` so that file stays within the repo's
 * `max-lines` lint budget while keeping the bus and its DOM-local classification
 * co-located.
 */

import type {
	DisposableLike,
	IConnectorEventBus,
	InboundAppMessage,
	MessageFilter,
	WebviewMessage,
} from "@jabberwock/types"

/**
 * Structural subset of `Window` used for the DOM-local loopback listener. Typed
 * structurally (rather than `Pick<Window, ...>`, which carries the full overloaded
 * DOM signature) so tests can inject a minimal fake in a plain Node environment.
 */
export interface WindowLike {
	addEventListener(type: string, handler: (event: MessageEvent) => void): void
	removeEventListener(type: string, handler: (event: MessageEvent) => void): void
}

/**
 * Returns true when a message type is DOM-local and must never leave the document.
 *
 * DOM-local types are class B allowlist traffic (plan §4.5 line 463): UI<->UI
 * messages (`{type:"action", action:"..."}`), devtool/iframe responses
 * (`dom-response` / `domResponse`) and panel navigation (`pushWindow`) — none of
 * them are host protocol.
 */
export function isDomLocalMessageType(type: string): boolean {
	switch (type) {
		case "action":
		case "dom-response":
		case "domResponse":
		case "pushWindow":
			return true
		default:
			return false
	}
}

/** A registered bus subscription: a filter plus the handler it dispatches to. */
interface Subscription {
	filter: MessageFilter
	handler: (msg: InboundAppMessage) => void
}

/** Options for the browser event bus (internal wiring of the connector). */
export interface BrowserWsEventBusOptions {
	/** Sends one host `WebviewMessage` as a ConnectorEnvelope WS frame. */
	sendFrame: (message: WebviewMessage) => void
	/** Document window used for the DOM-local loopback listener; null outside a browser. */
	windowLike: WindowLike | null
}

/**
 * A free-form object with a string `type` — the minimum shape of every message that
 * travels through the connector (envelope body, DOM-local messages, inbound frames).
 */
function isMessageLike(value: unknown): value is { type: unknown } {
	return typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string"
}

/**
 * The browser WS event bus implementation. Inbound host frames arrive from the
 * socket and DOM-local traffic arrives from the document window; both are routed to
 * matching subscribers. Outbound `publish()` sends host messages over the wire.
 */
export class BrowserWsEventBus implements IConnectorEventBus {
	private readonly subscriptions: Subscription[] = []
	private readonly sendFrame: (message: WebviewMessage) => void
	private readonly windowLike: WindowLike | null
	private readonly windowListener: ((event: MessageEvent) => void) | null = null
	/**
	 * The most recent hydration `state` frame (plan §6.2). Replayed to each new
	 * subscriber whose filter matches, so the app still hydrates when the handshake
	 * completes before the root-store subscription is registered.
	 */
	private hydrationState: InboundAppMessage | null = null

	constructor(options: BrowserWsEventBusOptions) {
		this.sendFrame = options.sendFrame
		this.windowLike = options.windowLike
		if (this.windowLike) {
			// One window listener: DOM-local class B traffic posted to the document is
			// looped back to subscribers IN-PROCESS and never sent on the WS wire (C-4).
			this.windowListener = (event: MessageEvent) => {
				const message: unknown = event.data
				if (!isMessageLike(message)) {
					return
				}
				const type = message.type
				if (typeof type !== "string" || !isDomLocalMessageType(type)) {
					return
				}
				this.dispatch(message as InboundAppMessage)
			}
			this.windowLike.addEventListener("message", this.windowListener)
		}
	}

	/** Returns true when the message satisfies the filter. */
	private matches(filter: MessageFilter, message: InboundAppMessage): boolean {
		if (typeof filter === "function") {
			return filter(message)
		}
		if (!filter.types || filter.types.length === 0) {
			return true
		}
		return filter.types.includes((message as { type: string }).type)
	}

	/** Dispatch an inbound message to every matching subscriber. */
	private dispatch(message: InboundAppMessage): void {
		for (const sub of this.subscriptions) {
			if (this.matches(sub.filter, message)) {
				try {
					sub.handler(message)
				} catch (error) {
					console.error("[browser-connector] subscriber handler error:", error)
				}
			}
		}
	}

	/**
	 * Outbound path: send a host message over the WS transport as a ConnectorEnvelope
	 * frame. DOM-local traffic is NOT published here — it arrives via `window.postMessage`
	 * (class B, standard Web API) and is caught by the bus's window listener, which loops
	 * it back to subscribers in-process and never puts it on the wire (plan §4.5 line 463,
	 * criterion C-4).
	 */
	publish(message: WebviewMessage): void {
		this.sendFrame(message)
	}

	/**
	 * Route an inbound host frame (already unwrapped to its `body`) to subscribers.
	 * Called by the connector when a WS frame arrives. Frames received before the
	 * first subscriber is registered would otherwise be lost — the hydration state
	 * is cached so late subscribers still hydrate.
	 */
	dispatchInbound(message: InboundAppMessage): void {
		const type = (message as { type: string }).type
		if (type === "state" && (message as { _hydration?: unknown })._hydration === true) {
			this.hydrationState = message
		}
		this.dispatch(message)
	}

	/** Inbound: register a handler for messages matching the filter. */
	subscribe(filter: MessageFilter, handler: (msg: InboundAppMessage) => void): DisposableLike {
		const sub: Subscription = { filter, handler }
		this.subscriptions.push(sub)
		// A subscriber that attaches after the handshake still receives the hydration
		// state (the boot sequence registers the root-store subscriber after connect).
		const hydration = this.hydrationState
		if (hydration && this.matches(filter, hydration)) {
			handler(hydration)
		}
		return {
			dispose: () => {
				const index = this.subscriptions.indexOf(sub)
				if (index >= 0) {
					this.subscriptions.splice(index, 1)
				}
			},
		}
	}

	/** Remove the window listener and clear all subscriptions. */
	dispose(): void {
		if (this.windowLike && this.windowListener) {
			this.windowLike.removeEventListener("message", this.windowListener)
		}
		this.subscriptions.length = 0
		this.hydrationState = null
	}
}

/**
 * VscodeWebviewFrontendConnector — v4 frontend host adapter for the VSCode webview.
 *
 * Implements `IFrontendConnector` (plan §4.4) by adapting the VSCode webview
 * postMessage transport into an in-app `IConnectorEventBus` (plan §4.5).
 *
 * The connector holds EXACTLY ONE `window.addEventListener("message", ...)`
 * listener — the single subscription point for the whole webview (plan §4.5,
 * line 462). Inbound host messages and DOM-local messages arrive on the same
 * physical DOM MessageEvent channel; the bus router dispatches each message to
 * the subscribers whose `MessageFilter` matches.
 *
 * Outbound `publish()` delegates to an injected postMessage function. During the
 * D1a transition the app still uses the `@jabberwock/devtool/webview` `vscode`
 * wrapper (which owns the single `acquireVsCodeApi()` call) for the not-yet
 * migrated class A call sites, so the connector reuses that same wrapper rather
 * than calling `acquireVsCodeApi()` a second time (VS Code throws if it is
 * called more than once). The connector-bus singleton injects the wrapper's
 * postMessage when it constructs this connector.
 *
 * This is the ONLY place in the frontend that touches the raw host transport.
 * App-level code (frontend/src/**) must go through the connector bus.
 */

import type { WebviewMessage } from "@jabberwock/types"
import type {
	DisposableLike,
	IConnectorEventBus,
	IFrontendConnector,
	InboundAppMessage,
	MessageFilter,
} from "@jabberwock/types"

/** A registered bus subscription: a filter plus the handler it dispatches to. */
interface Subscription {
	filter: MessageFilter
	handler: (msg: InboundAppMessage) => void
}

/**
 * The vscode-webview event bus implementation. Owns the single window message
 * listener and routes inbound messages to matching subscribers.
 */
class VscodeWebviewEventBus implements IConnectorEventBus {
	private readonly subscriptions: Subscription[] = []
	private readonly windowListener: (event: MessageEvent) => void
	private readonly postMessage: (message: WebviewMessage) => void

	constructor(postMessage: (message: WebviewMessage) => void) {
		this.postMessage = postMessage
		// The single subscription point for the whole webview (plan §4.5 line 462).
		this.windowListener = (event: MessageEvent) => {
			const message = event.data
			if (!message || typeof message !== "object" || typeof (message as { type?: unknown }).type !== "string") {
				return
			}
			const inbound = message as InboundAppMessage
			for (const sub of this.subscriptions) {
				if (this.matches(sub.filter, inbound)) {
					sub.handler(inbound)
				}
			}
		}
		window.addEventListener("message", this.windowListener)
	}

	/** Returns true when the message satisfies the filter. */
	private matches(filter: MessageFilter, message: InboundAppMessage): boolean {
		if (typeof filter === "function") {
			return filter(message)
		}
		if (!filter.types || filter.types.length === 0) {
			return true
		}
		const type = (message as { type: string }).type
		return filter.types.includes(type)
	}

	/** Outbound: send a host message through the vscode webview transport. */
	publish(message: WebviewMessage): void {
		this.postMessage(message)
	}

	/** Inbound: register a handler for messages matching the filter. */
	subscribe(filter: MessageFilter, handler: (msg: InboundAppMessage) => void): DisposableLike {
		const sub: Subscription = { filter, handler }
		this.subscriptions.push(sub)
		return {
			dispose: () => {
				const index = this.subscriptions.indexOf(sub)
				if (index >= 0) {
					this.subscriptions.splice(index, 1)
				}
			},
		}
	}

	/** Remove the single window listener and clear all subscriptions. */
	dispose(): void {
		window.removeEventListener("message", this.windowListener)
		this.subscriptions.length = 0
	}
}

/**
 * VSCode webview frontend connector. The event bus is created eagerly so the
 * single window listener is registered as soon as the connector is constructed;
 * `connect()` is effectively a no-op for the vscode webview transport.
 *
 * @param postMessage Outbound host transport function. Injected by the
 *   connector-bus from the shared `@jabberwock/devtool/webview` `vscode` wrapper
 *   so `acquireVsCodeApi()` is only ever called once per webview.
 */
export class VscodeWebviewFrontendConnector implements IFrontendConnector {
	readonly id = "vscode" as const
	private readonly bus: VscodeWebviewEventBus

	constructor(postMessage: (message: WebviewMessage) => void) {
		this.bus = new VscodeWebviewEventBus(postMessage)
	}

	get eventBus(): IConnectorEventBus {
		return this.bus
	}

	async connect(): Promise<void> {
		// The vscode webview transport needs no explicit connection step; the
		// single window listener is already registered by the bus constructor.
	}

	disconnect(): void {
		this.bus.dispose()
	}
}

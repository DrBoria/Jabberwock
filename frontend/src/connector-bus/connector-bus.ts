/**
 * Frontend connector-bus singleton implementation (plan §4.5, §7.3).
 *
 * The connector-bus is the single in-app entry point through which app-level
 * frontend code publishes outbound host messages and subscribes to inbound
 * ones. It wraps the active `IFrontendConnector` (chosen by environment) behind
 * an `IConnectorEventBus` and exposes it as a module-level singleton plus a
 * React context/hook.
 *
 * The app never sees the raw transport — it only calls `bus.publish(...)` and
 * `bus.subscribe(...)`. Whether the bus is backed by the vscode webview
 * postMessage channel or (in D2+) a websocket is an implementation detail of
 * the active connector.
 *
 * NOTE: this file intentionally holds the logic; `index.ts` in this directory
 * is a pure re-export barrel to satisfy the `local/no-logic-in-index` lint rule.
 */

import { createContext, useContext } from "react"

import type { IConnectorEventBus, IFrontendConnector } from "@jabberwock/types"
import { vscode } from "@jabberwock/devtool/webview"

import { VscodeWebviewFrontendConnector } from "../../../connectors/vscode/frontend/connector"
import { BrowserWsFrontendConnector } from "../../../connectors/web/frontend/connector"

/** Host environment discriminator used to select the active frontend connector. */
export type FrontendEnv = "vscode" | "web"

/** Module-level singleton holding the active connector bus once initialized. */
let activeBus: IConnectorEventBus | null = null

/** Module-level singleton holding the active connector once initialized. */
let activeConnector: IFrontendConnector | null = null

/**
 * Detect the host environment. In the vscode webview the `acquireVsCodeApi`
 * global is present; in a plain browser it is not (plan §7.3 lines 652-657).
 */
function detectEnv(): FrontendEnv {
	if (typeof acquireVsCodeApi === "function") {
		return "vscode"
	}
	return "web"
}

/**
 * True when running outside the VS Code webview (standalone "web"/watch mode, the
 * ICG-D1 display surface). In web mode the app shell can render the full-history
 * Timeline; in vscode mode it is not part of the chat layout.
 */
export function isWebMode(): boolean {
	return detectEnv() === "web"
}

/**
 * Create a frontend connector for the given environment (plan §7.3).
 *
 * "vscode" wraps the shared devtool `vscode` wrapper's postMessage; "web" opens a
 * WebSocket to the standalone server and performs the hello -> state handshake.
 */
export async function createFrontendConnector(env: FrontendEnv): Promise<IFrontendConnector> {
	switch (env) {
		case "vscode":
			// Reuse the shared devtool `vscode` wrapper's postMessage so that
			// `acquireVsCodeApi()` is only ever called once per webview (the
			// wrapper owns it; VS Code throws on a second call).
			return new VscodeWebviewFrontendConnector((message) => vscode.postMessage(message))
		case "web":
			// Standalone server mode (Phase D2): the browser connector opens a WebSocket
			// to the server's /ws endpoint and performs the hello -> state handshake on
			// connect(). DOM-local messages are looped back in-process (never on the wire).
			return new BrowserWsFrontendConnector()
	}
}

/**
 * Initialize the connector bus singleton: create the connector for the detected
 * environment, connect it, and cache its event bus. Safe to call more than once
 * (returns the already-initialized bus).
 */
export async function initConnectorBus(): Promise<IConnectorEventBus> {
	if (activeBus) {
		return activeBus
	}
	const connector = await createFrontendConnector(detectEnv())
	await connector.connect()
	activeConnector = connector
	activeBus = connector.eventBus
	return activeBus
}

/**
 * Return the initialized connector bus singleton. Throws if `initConnectorBus()`
 * has not been called yet.
 */
export function getConnectorBus(): IConnectorEventBus {
	if (!activeBus) {
		throw new Error(
			"[connector-bus] Connector bus not initialized. Call initConnectorBus() during bootstrap first.",
		)
	}
	return activeBus
}

/** React context providing the active connector bus to the component tree. */
export const ConnectorBusContext = createContext<IConnectorEventBus | null>(null)

/**
 * React hook returning the active connector bus from context.
 *
 * The context is populated by the bootstrap after `initConnectorBus()` resolves.
 * Throws if the bus is not available in context.
 */
export function useConnectorBus(): IConnectorEventBus {
	const bus = useContext(ConnectorBusContext)
	if (!bus) {
		throw new Error("[connector-bus] Connector bus not available in context. Ensure the provider is mounted.")
	}
	return bus
}

/** For tests / teardown: reset the module-level singleton state. */
export function __resetConnectorBusForTests(): void {
	activeConnector?.disconnect()
	activeConnector = null
	activeBus = null
}

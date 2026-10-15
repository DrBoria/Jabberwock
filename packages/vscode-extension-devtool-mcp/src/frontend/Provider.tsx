/**
 * <DevtoolProvider> — the single frontend entrypoint of this package.
 *
 * Wraps the host extension's webview App and provides all devtool/DOM
 * interaction capabilities out of the box: listens for window message events
 * and delegates handling to the `dom/` module (findElement, click, type,
 * scroll, select, drag, runCommand, screenshot, getActivePage, store queries,
 * console queries).
 *
 * When the config declares a frontend store adapter, the adapter's change
 * subscription is wired into the provider's `storeSubscriptions` hook so
 * store change events flow to the backend automatically.
 *
 * Usage:
 *   <DevtoolProvider config={config} postMessage={postMessage}>
 *     <AppContent />
 *   </DevtoolProvider>
 *
 * The component is self-contained: it does NOT call `acquireVsCodeApi()` and
 * does NOT import any host-internal stores. The host passes its own
 * `postMessage` and a {@link DevtoolConfig} whose `frontend.store` adapter
 * (if any) is used to stream store change events.
 */
import React, { useEffect, useMemo } from "react"
import { createDomMessageHandler } from "./dom/index.js"
import type { DevtoolConfig } from "../mcp/config.js"
import { resolveConfig } from "../mcp/config.js"

// ── Types ─────────────────────────────────────────────────────────────────

/**
 * A function that sets up store subscriptions (e.g., MST onSnapshot listeners).
 * Receives a `postMessage` function to send snapshot data back to the extension.
 * Returns a cleanup function (called on unmount).
 */
export type StoreSubscriptionSetup = (postMessage: (msg: unknown) => void) => (() => void) | void

export interface DevtoolProviderProps {
	children: React.ReactNode
	/**
	 * The postMessage function from the host's VS Code API wrapper (or the
	 * web connector's transport). Passed straight through to the provider.
	 */
	postMessage: (message: unknown) => void
	/**
	 * The devtool configuration. Its `frontend.store` adapter (if present) is
	 * used to stream store change events to the backend.
	 */
	config: DevtoolConfig
	/**
	 * Optional explicit store subscription setup. When provided, it takes
	 * precedence over the config-derived subscription.
	 */
	storeSubscriptions?: StoreSubscriptionSetup
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Build the `storeSubscriptions` setup from a frontend store adapter. Returns
 * `undefined` when the adapter does not support change subscriptions, so the
 * provider simply skips that wiring.
 */
function buildStoreSubscriptions(config: DevtoolConfig): StoreSubscriptionSetup | undefined {
	const resolved = resolveConfig(config)
	const store = resolved.frontendStore
	if (!store || typeof store.subscribeChanges !== "function") return undefined

	return (postMessage: (msg: unknown) => void) => {
		const unsubscribe = store.subscribeChanges?.((change) => {
			postMessage({ type: "devtool:storeChange", framework: store.framework, change })
		})
		return () => {
			if (typeof unsubscribe === "function") unsubscribe()
		}
	}
}

// ── Component ──────────────────────────────────────────────────────────────

export const DevtoolProvider: React.FC<DevtoolProviderProps> = ({
	children,
	postMessage,
	config,
	storeSubscriptions,
}) => {
	const effectiveSubscriptions = useMemo(
		() => storeSubscriptions ?? buildStoreSubscriptions(config),
		[storeSubscriptions, config],
	)

	// ── Store Subscriptions ──────────────────────────────────────────────
	useEffect(() => {
		if (!effectiveSubscriptions) return
		const cleanup = effectiveSubscriptions((msg: unknown) => postMessage(msg))
		return () => {
			if (typeof cleanup === "function") cleanup()
		}
	}, [effectiveSubscriptions])

	// ── DOM Message Handler ──────────────────────────────────────────────
	const onMessage = useMemo(() => createDomMessageHandler(postMessage), [postMessage])

	useEffect(() => {
		window.addEventListener("message", onMessage)
		return () => window.removeEventListener("message", onMessage)
	}, [onMessage])

	return <>{children}</>
}

export default DevtoolProvider

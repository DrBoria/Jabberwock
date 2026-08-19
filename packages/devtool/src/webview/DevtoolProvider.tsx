/**
 * DevtoolProvider — a React component that wraps the Jabberwock webview App
 * and provides all devtool/DOM interaction capabilities out of the box.
 *
 * Usage:
 *   <DevtoolProvider>
 *     <AppContent />
 *   </DevtoolProvider>
 *
 * The provider listens for VS Code message events and delegates handling to
 * the `dom/` module, which provides:
 * - findElement (CSS selector + text content fallback, with depth/maxChildren/command)
 * - clickElement (3-strategy fallback: native .click() → pointer events → aria popover)
 * - typeText (input/textarea value setting with React controlled input support)
 * - scrollElement (scroll by direction)
 * - selectOption (dropdown selection)
 * - getScreenshot (placeholder — not supported in webview)
 * - dragElement (drag element by selector in direction by pixels)
 * - dragFromTo (drag from one coordinate to another)
 * - getActivePage (DOM-based active page detection via data-window-type)
 * - runCommand (browser console eval — with acquireVsCodeApi blocked for security)
 *
 * This component is self-contained and does NOT depend on any Jabberwock
 * internal stores or modules — it only uses the VS Code API for message passing.
 */
import React, { useEffect, useMemo } from "react"
import { createDomMessageHandler } from "../dom/index.js"

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
	 * The postMessage function from the VS Code API wrapper.
	 * Pass `postMessage` from the consumer (App.tsx).
	 * DevtoolProvider does NOT call acquireVsCodeApi() itself to avoid
	 * "An instance of the VS Code API has already been acquired" errors.
	 */
	postMessage: (message: unknown) => void
	/**
	 * Optional store subscription setup. Use this to inject MST store listeners
	 * from the consumer (e.g., App.tsx) to avoid circular dependencies.
	 *
	 * Example:
	 * ```
	 * <DevtoolProvider
	 *   postMessage={postMessage}
	 *   storeSubscriptions={(postMessage) => {
	 *     const unsub1 = onSnapshot(mcpStore, (s) => postMessage({ type: "mcpSnapshot", s }))
	 *     return () => { unsub1() }
	 *   }}
	 * >
	 *   <AppContent />
	 * </DevtoolProvider>
	 * ```
	 */
	storeSubscriptions?: StoreSubscriptionSetup
}

// ── Component ──────────────────────────────────────────────────────────────

export const DevtoolProvider: React.FC<DevtoolProviderProps> = ({ children, postMessage, storeSubscriptions }) => {
	const renderCount = React.useRef(0)
	renderCount.current++
	console.log(`[DEBUG:DEVTOOL] DevtoolProvider RENDER #${renderCount.current}`)

	// ── Store Subscriptions ──────────────────────────────────────────────
	useEffect(() => {
		if (!storeSubscriptions) return
		console.log(`[DEBUG:DEVTOOL] storeSubscriptions EFFECT setup (render #${renderCount.current})`)
		const cleanup = storeSubscriptions((msg: unknown) => postMessage(msg))
		return () => {
			console.log(`[DEBUG:DEVTOOL] storeSubscriptions EFFECT cleanup`)
			if (typeof cleanup === "function") cleanup()
		}
	}, [storeSubscriptions])

	// ── DOM Message Handler ──────────────────────────────────────────────
	const onMessage = useMemo(() => {
		console.log(
			`[DEBUG:DEVTOOL] RECREATING onMessage handler (render #${renderCount.current}) — postMessage ref changed!`,
		)
		return createDomMessageHandler(postMessage)
	}, [postMessage])

	useEffect(() => {
		console.log(`[DEBUG:DEVTOOL] Adding message listener (render #${renderCount.current})`)
		window.addEventListener("message", onMessage)
		return () => {
			console.log(`[DEBUG:DEVTOOL] Removing message listener — handler was recreated!`)
			window.removeEventListener("message", onMessage)
		}
	}, [onMessage])

	return <>{children}</>
}

export default DevtoolProvider

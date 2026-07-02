/**
 * DOM interaction module — the public entry point.
 *
 * Provides `createDomMessageHandler` which returns a `(e: MessageEvent) => void`
 * function that handles all DOM interaction messages from the extension host:
 *   - findElement    — query and serialize DOM by CSS selector
 *   - runCommand     — execute arbitrary JS in the webview console
 *   - clickElement   — click an element (native .click() + pointer event chain)
 *   - scrollElement  — scroll an element by direction
 *   - typeText       — type text into an input/textarea/contenteditable
 *   - selectOption   — select a dropdown option
 *   - getScreenshot  — not supported in webview (returns placeholder)
 *   - dragElement    — drag an element in a direction
 *   - dragFromTo     — drag from one coordinate to another
 *   - getActivePage  — return current window location (hash/pathname)
 *   - getConsoleLogs — return console log entries (from in-memory log buffer)
 *   - searchConsole  — search console log entries
 *   - dom-response   — internal: resolves pending iframe queries
 *   - getRootSnapshot — return MST root store snapshot
 *   - getActionBuffer — return action log entries
 *   - applySnapshot   — apply MST snapshot
 *
 * Usage:
 *   import { createDomMessageHandler } from "../dom/index.js"
 *   const onMessage = useMemo(() => createDomMessageHandler(postMessage, rootStore, { getActionBuffer }), [postMessage, rootStore])
 *   useEffect(() => { window.addEventListener("message", onMessage); return () => window.removeEventListener("message", onMessage) }, [onMessage])
 */

export { createDomMessageHandler } from "./create-message-handler.js"
export type { StoreQueryOptions } from "./store-query-handlers.js"

// ── Webview Store Bridge (optional, kept for backward compatibility) ──
export { createWebviewStoreBridge } from "./bridge/webview-store-bridge.js"
export type { WebviewStoreBridgeOptions } from "./bridge/webview-store-bridge.js"

// ── Frontend Bridge (extension-side, generic) ──────────────────────
export { registerDomResponseHandler } from "./bridge/register-dom-response-handler.js"
export { createFrontendBridge } from "./bridge/create-frontend-bridge.js"
export type { CreateFrontendBridgeOptions } from "./bridge/create-frontend-bridge.js"

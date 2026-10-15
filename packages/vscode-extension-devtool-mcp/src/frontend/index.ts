/**
 * Frontend entry point (`vscode-extension-devtool-mcp/webview`).
 *
 * Browser-safe only — no Node.js built-ins — so Vite can bundle it
 * for the webview.
 */

// ── <DevtoolProvider> — the main webview component (DOM message handling + store subscriptions) ─
export { DevtoolProvider } from "./Provider.js"
export type { DevtoolProviderProps, StoreSubscriptionSetup } from "./Provider.js"

// ── VSCode API wrapper (webview ↔ extension host messaging) ──────────────
export { vscode } from "./vscode.js"

// ── LocatorBridge — Alt+Click source navigation ──────────────────────────
export { LocatorBridge } from "./locator/index.js"

// ── Webview Console Bridge — intercepts console.log/warn/error/debug ─────
export { initWebviewConsoleBridge, getWebviewConsoleLogs, clearWebviewConsoleLogs } from "./console/index.js"

// ── Source map utilities + initializer ───────────────────────────────────
export type { EnhancedError } from "./source-maps/resolve.js"
export {
	applySourceMapsToStack,
	applySourceMapsToComponentStack,
	enhanceErrorWithSourceMaps,
	parseStackTrace,
} from "./source-maps/resolve.js"
export { initializeSourceMaps, exposeSourceMapsForDebugging } from "./source-maps/preload.js"

// ── DOM message handler + store bridge (direct initialization) ───────────
export { createDomMessageHandler, createWebviewStoreBridge } from "./dom/index.js"
export type { StoreQueryOptions } from "./dom/index.js"

// ── Frontend Bridge (extension-side, generic) ────────────────────────────
export { registerDomResponseHandler } from "./dom/bridge/register-dom-response-handler.js"
export { createFrontendBridge } from "./dom/bridge/create-frontend-bridge.js"
export type { CreateFrontendBridgeOptions } from "./dom/bridge/create-frontend-bridge.js"

// ── Profiler metrics ─────────────────────────────────────────────────────
export { MetricsCollector } from "./profiler/index.js"
export type { RequestMetrics, MemorySample, HistogramBucket } from "./profiler/index.js"

// ── Frontend message interceptor (mirrors the backend one) ───────────────
export { FrontendMessageInterceptor, createFrontendInterceptor } from "./interceptor/index.js"
export type { PostMessageFn } from "./interceptor/index.js"

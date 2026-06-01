/**
 * Webview-only entry point for `@jabberwock/devtool/webview`.
 *
 * This file exports ONLY browser-safe modules — no Node.js built-ins
 * (fs, path, util, etc.) — so Vite can bundle it for the webview.
 *
 * For the Node.js (extension host) entry point, see ./index.ts.
 */

// ── DevtoolProvider — the main webview-side MCP tool handler ──────────────
export { DevtoolProvider } from "./webview/DevtoolProvider.js"
export type { DevtoolProviderProps } from "./webview/DevtoolProvider.js"

// ── VSCode API wrapper (webview ↔ extension host messaging) ────────────
export { vscode } from "./webview/vscode.js"

// ── DevToolsStore — MST store for devtools UI state ─────────────────────
export { DevToolsStore, devToolsStore } from "./webview/store.js"
export type { IDevToolsStore } from "./webview/store.js"

// ── LocatorBridge — Alt+Click source navigation ────────────────────────
export { LocatorBridge } from "./webview/LocatorBridge.js"

// ── Webview Console Bridge — intercepts console.log/warn/error/debug ───
export { initWebviewConsoleBridge, getWebviewConsoleLogs, clearWebviewConsoleLogs } from "./webview/console.js"

// ── Source map utilities + initializer ──────────────────────────────────
export {
	applySourceMapsToStack,
	applySourceMapsToComponentStack,
	enhanceErrorWithSourceMaps,
	parseStackTrace,
	initializeSourceMaps,
	exposeSourceMapsForDebugging,
} from "./webview/sourceMap.js"
export type { EnhancedError } from "./webview/sourceMap.js"

// ── DOM message handler for direct initialization (bypasses DevtoolProvider) ─
export { createDomMessageHandler } from "./dom/index.js"

// ── Webview Store Bridge (handles devtool store queries via rootStore) ─────
export { createWebviewStoreBridge } from "./dom/index.js"
export type { WebviewStoreBridgeOptions } from "./dom/index.js"

// ── DiagnosticDashboard — webview diagnostic panel ──────────────────────
export { default as DiagnosticDashboard } from "./webview/diagnostic-dashboard/diagnostic-dashboard.js"

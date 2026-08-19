/**
 * Webview-only entry point for `@jabberwock/devtool/webview`.
 *
 * This file exports ONLY browser-safe modules — no Node.js built-ins
 * (fs, path, util, etc.) — so Vite can bundle it for the webview.
 *
 * For the Node.js (extension host) entry point, see ../index.ts.
 */

// ── DevtoolProvider — the main webview-side MCP tool handler ──────────────
export { DevtoolProvider } from "./DevtoolProvider.js"
export type { DevtoolProviderProps } from "./DevtoolProvider.js"

// ── VSCode API wrapper (webview ↔ extension host messaging) ────────────
export { vscode } from "./vscode.js"

// ── DevToolsStore — MST store for devtools UI state ─────────────────────
export { DevToolsStore, devToolsStore } from "./DevToolsStore/store.js"
export type { IDevToolsStore } from "./DevToolsStore/store.js"

// ── LocatorBridge — Alt+Click source navigation ────────────────────────
export { LocatorBridge } from "./LocatorBridge.js"

// ── Webview Console Bridge — intercepts console.log/warn/error/debug ───
export { initWebviewConsoleBridge, getWebviewConsoleLogs, clearWebviewConsoleLogs } from "./console.js"

// ── Source map utilities + initializer ──────────────────────────────────
export type { EnhancedError } from "./sourceMap-utils.js"
export {
	applySourceMapsToStack,
	applySourceMapsToComponentStack,
	enhanceErrorWithSourceMaps,
	parseStackTrace,
} from "./sourceMap-utils.js"
export { initializeSourceMaps, exposeSourceMapsForDebugging } from "./sourceMap.js"

// ── DOM message handler for direct initialization (bypasses DevtoolProvider) ─
export { createDomMessageHandler } from "../dom/index.js"

// ── Webview Store Bridge (handles devtool store queries via rootStore) ─────
export { createWebviewStoreBridge } from "../dom/index.js"
export type { WebviewStoreBridgeOptions } from "../dom/index.js"

// ── DiagnosticDashboard — webview diagnostic panel ──────────────────────
export { default as DiagnosticDashboard } from "./diagnostic-dashboard/diagnostic-dashboard.js"

/**
 * Browser-safe entry point for the @jabberwock/devtool package.
 *
 * This entry point only exports components that work in the browser/webview
 * context (no Node.js dependencies like `fs` or `ws`).
 *
 * Usage in webview-ui:
 *   import { DevtoolProvider } from "@jabberwock/devtool/react"
 *   import { vscode } from "@jabberwock/devtool/react"
 *   import { devToolsStore } from "@jabberwock/devtool/react"
 *   import { LocatorBridge } from "@jabberwock/devtool/react"
 *   import { initWebviewConsoleBridge } from "@jabberwock/devtool/react"
 *   import { initializeSourceMaps } from "@jabberwock/devtool/react"
 */

// DevtoolProvider — the main webview-side MCP tool handler
export { DevtoolProvider } from "./react/DevtoolProvider.js"
export type { DevtoolProviderProps } from "./react/DevtoolProvider.js"

// VSCode API wrapper (webview ↔ extension host messaging)
export { vscode } from "./react/vscode.js"

// DevToolsStore — MST store for devtools UI state
export { DevToolsStore, devToolsStore } from "./react/store.js"
export type { IDevToolsStore } from "./react/store.js"

// LocatorBridge — Alt+Click source navigation
export { LocatorBridge } from "./react/LocatorBridge.js"

// Webview Console Bridge — intercepts console.log/warn/error/debug
export { initWebviewConsoleBridge } from "./react/webviewConsoleBridge.js"

// Source map utilities
export {
	applySourceMapsToStack,
	applySourceMapsToComponentStack,
	enhanceErrorWithSourceMaps,
	parseStackTrace,
} from "./react/sourceMapUtils.js"
export type { EnhancedError } from "./react/sourceMapUtils.js"

// Source map initializer
export { initializeSourceMaps, exposeSourceMapsForDebugging } from "./react/sourceMapInitializer.js"

// DiagnosticDashboard — webview diagnostic panel
export { default as DiagnosticDashboard } from "./react/diagnostic-dashboard/diagnostic-dashboard.js"

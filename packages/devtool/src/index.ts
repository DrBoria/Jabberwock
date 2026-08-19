export { WsMcpServer } from "./server/ws-mcp-server.js"
export { WebSocketServerTransport } from "./server/transport.js"
// ══════════════════════════════════════════════════════════════════
//  MCP API — re-exported from the api/ subtree
// ══════════════════════════════════════════════════════════════════

export type { DevtoolModel, FrontendBridge } from "./api/mst/types.js"
export type { ExtensionBridge } from "./api/bridge.js"
export { createDevtoolBridge } from "./api/factory.js"
export type { DevtoolBridgeProvider } from "./api/factories/factory-helpers.js"

// ══════════════════════════════════════════════════════════════════
//  Devtool class
// ══════════════════════════════════════════════════════════════════

export { Devtool } from "./devtool.js"

export type { DevtoolClient, DevtoolClientOptions } from "./client.js"
export { CommandRegistry } from "./utils/command-registry.js"
export type { ExtensionCommand } from "./utils/command-registry.js"

// Diagnostics module (moved from src/core/devtools/)
export {
	DiagnosticsManager,
	diagnosticsManager,
	DevToolsLogger,
	Tracer,
	ResourceMonitor,
	TimelineTracker,
	LifecycleManager,
	LogFileManager,
} from "./diagnostics/index.js"
export type {
	ToolTrace,
	TaskTrace,
	SnapshotFilters,
	ExtendedDiagnosticSnapshot,
	TimelineEvent,
	TimelineEventType,
	TimelineFilters,
} from "./diagnostics/types.js"

export { MessageInterceptor } from "./api/utils/interceptor.js"
export type { InterceptorConfig, TraceEntry, TraceFilter } from "./api/utils/interceptor.js"

// HTTP status server (polled by stdio MCP entry to detect extension availability)
export { startHttpStatusServer, stopHttpStatusServer, getBuildTimestamp } from "./api/http-server.js"

// ── Webview entry (browser-safe exports for webview-ui) ─────────────────

// DevtoolProvider — the main webview-side MCP tool handler
export { DevtoolProvider } from "./webview/DevtoolProvider.js"
export type { DevtoolProviderProps } from "./webview/DevtoolProvider.js"

// VSCode API wrapper (webview ↔ extension host messaging)
export { vscode } from "./webview/vscode.js"

// DevToolsStore — MST store for devtools UI state
export { DevToolsStore, devToolsStore } from "./webview/DevToolsStore/store.js"
export type { IDevToolsStore } from "./webview/DevToolsStore/store.js"

// LocatorBridge — Alt+Click source navigation
export { LocatorBridge } from "./webview/LocatorBridge.js"

// Webview Console Bridge — intercepts console.log/warn/error/debug
export { initWebviewConsoleBridge } from "./webview/console.js"

// Source map utilities + initializer (re-exported via webview/index.ts)
export {
	applySourceMapsToStack,
	applySourceMapsToComponentStack,
	enhanceErrorWithSourceMaps,
	parseStackTrace,
	initializeSourceMaps,
	exposeSourceMapsForDebugging,
} from "./webview/index.js"
export type { EnhancedError } from "./webview/index.js"

// DOM message handler for direct initialization (bypasses DevtoolProvider)
export { createDomMessageHandler } from "./dom/index.js"

// domResponse handler registration (extension-side, generic)
export { registerDomResponseHandler } from "./dom/index.js"
export { createFrontendBridge } from "./dom/index.js"
export type { CreateFrontendBridgeOptions } from "./dom/index.js"

// DiagnosticDashboard — webview diagnostic panel
export { default as DiagnosticDashboard } from "./webview/diagnostic-dashboard/diagnostic-dashboard.js"

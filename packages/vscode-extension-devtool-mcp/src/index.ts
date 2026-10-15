export { WsMcpServer, WebSocketServerTransport } from "./mcp/transport/ws.js"
// ══════════════════════════════════════════════════════════════════
//  MCP API — re-exported from "the" api/ subtree
// ══════════════════════════════════════════════════════════════════

export type { DevtoolModel, FrontendBridge } from "./types.js"
export type { DevtoolBridgeProvider, DevtoolMethods } from "./mcp/server.js"

// Framework store adapters — the single point where a state framework is
// touched. Pass the resulting IStoreAdapter into DevtoolConfig to activate
// that side's state MCP tools.
export {
	createMobxAdapter,
	createReduxAdapter,
	createZustandAdapter,
	createApolloAdapter,
	createPlainAdapter,
	SnapshotHistory,
	ChangeLog,
} from "./stores/index.js"
export type {
	MobxAdapterOptions,
	ReduxAdapterOptions,
	ReduxStoreLike,
	ZustandAdapterOptions,
	ZustandStoreLike,
	ApolloAdapterOptions,
	PlainAdapterOptions,
} from "./stores/index.js"
export { frameworkLabel } from "./types.js"

// ══════════════════════════════════════════════════════════════════
//  Devtool class
// ══════════════════════════════════════════════════════════════════

export { DevtoolServer } from "./mcp/server.js"

export { CommandRegistry } from "./mcp/command-registry.js"
export type { ExtensionCommand } from "./mcp/command-registry.js"

// Diagnostics module (moved from "src/core/devtools/")
export {
	DiagnosticsManager,
	diagnosticsManager,
	DevToolsLogger,
	Tracer,
	ResourceMonitor,
	TimelineTracker,
	LifecycleManager,
	LogFileManager,
} from "./backend/profiler/index.js"
export type {
	ToolTrace,
	TaskTrace,
	SnapshotFilters,
	ExtendedDiagnosticSnapshot,
	TimelineEvent,
	TimelineEventType,
	TimelineFilters,
} from "./backend/profiler/types.js"

export { MessageInterceptor } from "./mcp/interceptor/index.js"
export type { InterceptorConfig, TraceEntry, TraceFilter } from "./mcp/interceptor/index.js"
export {
	createFrontendInterceptor,
	type FrontendMessageInterceptor,
	type PostMessageFn,
} from "./frontend/interceptor/index.js"

// HTTP status server (polled by stdio MCP entry to detect extension availability)
export { startHttpStatusServer, stopHttpStatusServer, getBuildTimestamp } from "./mcp/transport/http.js"

// ── Shared, environment-agnostic utilities ─────────────────────────────
// NOTE: browser-only React components (DevtoolProvider, <Devtool>,
// LocatorBridge, DiagnosticDashboard, the vscode webview wrapper, source-map
// initializers, …) are intentionally NOT exported from this Node entry — they
// are reachable only through the browser-safe
// `vscode-extension-devtool-mcp/webview` subpath. Keeping them out of the main
// entry is what makes this package importable from a Node/extension-host
// context without pulling in React or CSS.

// Per-request performance profiling (pure — works in browser + Node)
export { MetricsCollector } from "./frontend/profiler/index.js"
export type { RequestMetrics, MemorySample, HistogramBucket } from "./frontend/profiler/index.js"

// Config — the single source of truth for which MCP tool groups are active
export { resolveConfig, availableStoreEnvs, DEFAULT_MCP_PORT, DEFAULT_STATUS_PORT } from "./mcp/config.js"
export type { DevtoolConfig, DevtoolSideConfig, ResolvedDevtoolConfig } from "./mcp/config.js"

// Host framework adapters (express / nest) — dependency-free structural types
export {
	createExpressDevtool,
	devtoolMiddleware,
	createNestDevtool,
	DevtoolNestMiddleware,
} from "./backend/hosts/index.js"
export type { ExpressDevtoolOptions, NestDevtoolOptions } from "./backend/hosts/index.js"

// Source-map utilities (pure, environment-agnostic). The DOM-attached
// initializers (initializeSourceMaps / exposeSourceMapsForDebugging) live in
// the browser-safe `vscode-extension-devtool-mcp/webview` subpath.
export {
	applySourceMapsToStack,
	applySourceMapsToComponentStack,
	enhanceErrorWithSourceMaps,
	parseStackTrace,
} from "./frontend/source-maps/resolve.js"
export type { EnhancedError } from "./frontend/source-maps/resolve.js"

// DOM response plumbing (extension-side, generic — Node-safe)
export { registerDomResponseHandler } from "./frontend/dom/index.js"
export { createFrontendBridge } from "./frontend/dom/index.js"
export type { CreateFrontendBridgeOptions } from "./frontend/dom/index.js"

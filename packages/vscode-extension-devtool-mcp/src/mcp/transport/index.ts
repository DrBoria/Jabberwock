/**
 * Transport barrel for the MCP layer.
 *
 * - `ws`     — WebSocket MCP server (extension host side, port 60060)
 * - `http`   — HTTP status server (port 60061, polled by the stdio entry)
 * - `errors` — shared error/timeout/retry policy + reachability probes
 * - `stdio`  — AgentEntrypoint: stdio MCP entry (agent side), proxies host tools
 * - `target-identity` — which VS Code window the host is (learned from /status)
 *
 * `stdio.ts` is also a standalone subpath entry point (`./mcp-entry`).
 * The CDP renderer console lives in `mcp/console/` (see `../console/index.js`).
 */
export * from "./errors.js"
export * from "./ws.js"
export * from "./http.js"
export * from "./target-identity.js"
export { startStdioProxy } from "./stdio.js"

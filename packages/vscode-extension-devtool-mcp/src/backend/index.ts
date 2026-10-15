/**
 * Public API of the `./backend` subpath: the Devtool MCP server and the
 * status HTTP server. The orchestrator lives in `../mcp/server.js`; this
 * barrel keeps the subpath import surface stable.
 */
export { DevtoolServer as Devtool } from "../mcp/server.js"
export type { DevtoolBridgeProvider } from "../mcp/server.js"
export type { HostIdentity } from "../mcp/transport/http.js"
export { startHttpStatusServer, stopHttpStatusServer, getBuildTimestamp } from "../mcp/transport/http.js"
export { WS_PORT, HTTP_STATUS_PORT } from "../mcp/transport/errors.js"
export { startStdioProxy } from "../mcp/transport/stdio.js"

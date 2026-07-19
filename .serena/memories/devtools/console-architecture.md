# Console Logging Architecture

## Overview

Console log retrieval is split by **environment** (`backend` = extension host, `frontend` = webview) and routed through the **store query path** (not DOM query path) to avoid timeouts.

## Data Sources

- **Backend (extension host)**: `DiagnosticsManager` singleton intercepts `console.log/warn/error/debug` via `registerConsoleInterceptor()`. Logs are stored in `DiagnosticsManager.logs[]`.
- **Frontend (webview)**: `initWebviewConsoleBridge()` monkey-patches `console.log/warn/error/debug` in the webview, populating an in-memory `logBuffer[]`. Retrieved via `getWebviewConsoleLogs()`.

## Message Flow (Frontend Console)

```
MCP tool → bridge.getConsole({env:"frontend"}) → frontendBridge.getConsoleLogs()
→ sendQuery("getConsoleLogs") → postMessageToWebview({type:"storeQuery", action:"getConsoleLogs"})
→ createWebviewStoreBridge.handleStoreAction("getConsoleLogs") → getWebviewConsoleLogs()
→ postDomResponse(requestId, result) → resolve
```

This uses the **store query path** (type: "storeQuery"), NOT the DOM action path (type: "action"). The old DOM path had a 30-second timeout; the store query path uses a 10-second timeout and works reliably.

## Key Files

- `packages/devtool/src/api/bridge.ts` — `ExtensionBridge` interface: `getConsole(params)`, `searchConsole(params)`
- `packages/devtool/src/api/mst/types.ts` — `FrontendBridge` interface: `getConsoleLogs(params)`, `searchConsole(params)`
- `packages/devtool/src/api/factory.ts` — `createDevtoolBridge`: env-aware `getConsole`/`searchConsole` implementation
- `packages/devtool/src/api/tools/console.ts` — MCP tools: `get_console` and `search_console`
- `packages/devtool/src/dom/create-frontend-bridge.ts` — `createFrontendBridge`: sends `storeQuery` messages to webview
- `packages/devtool/src/dom/webview-store-bridge.ts` — `createWebviewStoreBridge`: handles `getConsoleLogs`/`searchConsole` actions in webview
- `packages/devtool/src/webview/console.ts` — `getWebviewConsoleLogs(level?, limit=10, cursor=0, search?)`: cursor-based pagination with text search
- `packages/devtool/src/diagnostics/DiagnosticsManager.ts` — Backend console interceptor + `getAllLogs()`

## MCP Tools

1. `get_console` — params: `env` (required, "backend"|"frontend"), `level` (optional), `limit` (default 10), `cursor` (default 0)
2. `search_console` — params: `query` (required), `env` (optional, defaults to both), `level` (optional), `limit` (default 10), `cursor` (default 0)

Returns JSON `{ lines: string[], totalLines: number }`. Each line format: `[timestamp][LEVEL] message`.

## Pagination

Cursor-based: `cursor` = number of entries to skip from the end. `endIndex = totalLength - cursor`, `startIndex = max(0, endIndex - limit)`. Default limit = 10.

## Removal of DOM Path

The old `getConsoleLogs` handler was removed from `packages/devtool/src/dom/index.ts` `actionHandlers` since console queries now route through the store query path.

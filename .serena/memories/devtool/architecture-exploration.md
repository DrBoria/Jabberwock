# Devtool Architecture — Complete Exploration

## 1. Package Location

- **Package**: `@jabberwock/devtool` at [`packages/devtool/package.json`](packages/devtool/package.json)
- **Entry points**:
    - `"."` → `packages/devtool/src/index.ts` (main — Devtool class, DevtoolClient)
    - `"./webview"` → `packages/devtool/src/webview/index.ts` (webview-side console bridge)
    - `"./dom/consumer"` → `packages/devtool/src/dom/consumer/index.ts` (DOM consumer for e2e)
    - `"./mcp-entry"` → `packages/devtool/src/api/mcp-entry/index.ts` (MCP entry point)

## 2. MCP Server (WebSocket)

- **Class**: [`WsMcpServer`](packages/devtool/src/server/ws-mcp-server.ts:56) — wraps `ws.WebSocketServer` + `@modelcontextprotocol/sdk` `McpServer`
- **Port**: Default `60060` (static), status server on `60061`
- **Flow**: `createServer()` → register tools → `start()` → WebSocket listener on `127.0.0.1:60060`
- **Transport**: `WebSocketServerTransport` from MCP SDK — each WebSocket connection gets an MCP transport
- **Retry logic**: `start()` retries up to 3 times with exponential backoff on `EADDRINUSE`

## 3. Devtool Class (Orchestrator)

- **Class**: [`Devtool`](packages/devtool/src/devtool.ts:29)
- **`start()`** (line 57): Starts HTTP status server → creates McpServer → registers generic tools (DOM, console, diagnostics, state, eventBus) → registers domain-specific tools from model → starts WebSocket
- **`registerGenericTools()`** (line 105): Calls `registerDomTools`, `registerConsoleTools`, `registerDiagnosticTools`, `registerStateTools`, `registerCommandTools`

## 4. MCP Tool Handler Definitions

All tool registrations use `mcpServer.tool(name, schema, handler)` pattern:

| Tool Group  | File                                                                                     | Registration Function       |
| ----------- | ---------------------------------------------------------------------------------------- | --------------------------- |
| DOM         | [`packages/devtool/src/api/tools/dom.ts`](packages/devtool/src/api/tools/dom.ts)         | `registerDomTools()`        |
| Console     | [`packages/devtool/src/api/tools/console.ts`](packages/devtool/src/api/tools/console.ts) | `registerConsoleTools()`    |
| State       | [`packages/devtool/src/api/tools/state.ts`](packages/devtool/src/api/tools/state.ts)     | `registerStateTools()`      |
| Diagnostics | (in diagnostics package)                                                                 | `registerDiagnosticTools()` |
| Commands    | (in commands package)                                                                    | `registerCommandTools()`    |
| EventBus    | (in eventBus package)                                                                    | `registerEventBusTools()`   |

Each handler calls `wrapBridge(() => bridge.method(params))` which wraps in try/catch returning `{content, isError}`.

## 5. `get_store_state` Implementation

### MCP Tool Registration

[`registerStateTools`](packages/devtool/src/api/tools/state.ts:5) registers `get_store_state` with params: `env`, `store`, `path`, `limit`, `cursor`, `fields`.
Handler calls `bridge.getStoreState(params)`.

### ExtensionBridge Interface

[`ExtensionBridge.getStoreState`](packages/devtool/src/api/bridge.ts:105) — returns `Promise<string>` (JSON).

### Bridge Implementation

[`createStateMethods`](packages/devtool/src/api/factories/factory-state.ts:24) → `getStoreState()` delegates to:

- [`getStoreState()`](packages/devtool/src/api/mst/snapshot/snapshot.ts:72) — dispatches by env:
    - `env="backend"` → [`getBackendState()`](packages/devtool/src/api/mst/snapshot/snapshot.ts:44) → `getBackendStoreHelper(backendStore, ...)` — reads MST store directly in extension host
    - `env="frontend"` → [`getFrontendState()`](packages/devtool/src/api/mst/snapshot/snapshot.ts:58) → `getFrontendStoreHelper(frontendBridge, ...)` — sends query to webview via `createFrontendBridge`

### Frontend Store Query Flow

[`createFrontendBridge`](packages/devtool/src/dom/bridge/create-frontend-bridge.ts:34):

- `sendQuery("getRootSnapshot", ...)` → `postMessageToWebview({type:"action", action:"getRootSnapshot", requestId})`
- Webview receives in [`createDomMessageHandler`](packages/devtool/src/dom/create-message-handler.ts:46)
- Routes to [`createStoreQueryHandlers`](packages/devtool/src/dom/store-query-handlers.ts:16) → `getRootSnapshot` handler calls `getSnapshot(rootStore)` and posts back `{type:"domResponse", requestId, text}`
- Extension receives via `registerDomResponseHandler` → resolves the promise

## 6. Console Monitoring

### Backend (Extension Host)

- **Class**: [`DiagnosticsManager`](packages/devtool/src/diagnostics/managers/DiagnosticsManager.ts:11)
- **`registerConsoleInterceptor()`** (line 41): Monkey-patches `console.log/warn/error/debug` via `Object.defineProperty`
- Stores in `this.logs[]` (max 1000 entries)
- **`getAllLogs()`** returns copy of logs

### Frontend (Webview)

- **File**: [`packages/devtool/src/webview/console.ts`](packages/devtool/src/webview/console.ts)
- **`initWebviewConsoleBridge()`** (line 83): Monkey-patches `console.log/warn/error/debug` in webview
- Stores in `logBuffer[]` (max 5000 entries via `MAX_BUFFER_SIZE`)
- **`getWebviewConsoleLogs()`** (line 107): Cursor-based pagination, level filtering, text search
- **`captureConsoleLog()`** (line 97): Formats args via `formatConsoleArgs` → pushes `LogEntry`

### Console Retrieval Flow

- MCP tool `get_console` → `bridge.getConsole()` → [`handleGetConsole()`](packages/devtool/src/api/factories/factory-console.ts:4):
    - `env="backend"` → `diagnosticsManager.getAllLogs()` → `filterBackendLogs()`
    - `env="frontend"` → `frontendBridge.getConsoleLogs()` → `sendQuery("getConsoleLogs")` → webview → `getWebviewConsoleLogs()`

## 7. Request/Response Flow

### DOM Operations (findElement, clickElement, etc.)

```
MCP Client → WsMcpServer (WebSocket) → McpServer.tool handler
  → wrapBridge(bridge.method())
    → createDomBridgeMethods → sendDomQuery(provider, type, payload)
      → provider.postMessageToWebview("action", {action, requestId, ...payload})
        → VS Code Webview API → webview window.addEventListener("message")
          → createDomMessageHandler → actionHandlers[action]()
            → DOM manipulation → postMessage({type:"domResponse", requestId, text})
              → VS Code Webview API → extension host
                → webviewMessageHandler → messageHandlers.get("domResponse")
                  → resolveDomRequest(requestId, result) → Promise resolves
                    → wrapBridge returns {content: [{type:"text", text: result}]}
                      → JSON-RPC response via WebSocket
```

### Store Queries (get_store_state env=frontend)

```
MCP Client → WsMcpServer → McpServer.tool handler
  → wrapBridge(bridge.getStoreState())
    → createStateMethods.getStoreState() → getStoreState()
      → getFrontendState() → getFrontendStoreHelper()
        → frontendBridge.getRootSnapshot()
          → sendQuery("getRootSnapshot")
            → postMessageToWebview({type:"action", action:"getRootSnapshot", requestId})
              → webview → createDomMessageHandler
                → createStoreQueryHandlers.getRootSnapshot
                  → getSnapshot(rootStore) → postMessage({type:"domResponse", requestId, text})
                    → resolveDomRequest → Promise resolves → response back
```

### Store Queries (get_store_state env=backend)

```
MCP Client → WsMcpServer → McpServer.tool handler
  → wrapBridge(bridge.getStoreState())
    → createStateMethods.getStoreState() → getStoreState()
      → getBackendState() → getBackendStoreHelper()
        → backendStore.getMstStore() → read MST snapshot directly
          → return JSON → response back
```

## 8. Timeout/Breakpoint Handling

### Existing Timeouts

| Location                                                                                         | Timeout                                     | What                                             |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------- | ------------------------------------------------ |
| [`sendDomQuery`](packages/devtool/src/api/factories/factory-helpers.ts:30)                       | **30s**                                     | DOM operations (findElement, clickElement, etc.) |
| [`createFrontendBridge.sendQuery`](packages/devtool/src/dom/bridge/create-frontend-bridge.ts:44) | **10s**                                     | Store queries (getRootSnapshot, getConsoleLogs)  |
| [`createDevtoolBridge.getActivePage`](packages/devtool/src/api/factory.ts:14)                    | **10s**                                     | getActivePage                                    |
| [`DevtoolClient.rawRequest`](packages/devtool/src/client.ts:115)                                 | **30s** (configurable via `requestTimeout`) | JSON-RPC requests from client side               |

### Breakpoint-Aware Behavior

**There is NO explicit breakpoint detection or handling.** When a breakpoint hits in the Extension Dev Host:

1. The extension host JavaScript thread pauses
2. `postMessageToWebview` (VS Code WebSocket) stops responding
3. `sendDomQuery` and `sendQuery` timeouts fire after 30s/10s
4. The error surfaces as `"DOM query \"...\" timed out after 30s"` or `"Timeout: ..."`
5. The devtool WebSocket MCP server is still running (separate process), but it can't reach the extension host

**This is expected behavior** — the AGENTS.md rule says: "devtool timeout = breakpoint hit. STOP retrying devtool."

### Error Handling

- [`wrapBridge`](packages/devtool/src/api/tools/tool-utils.ts:7): Catches all errors, returns `{content, isError: true}`
- [`registerGlobalErrorHandlers`](packages/devtool/src/api/factories/factory-helpers.ts:16): `process.on("unhandledRejection")` and `process.on("uncaughtException")`
- [`DevtoolClient.rawRequest`](packages/devtool/src/client.ts:115): Timeout + transport error handling
- [`DevtoolClient.onclose`](packages/devtool/src/client.ts:92): Rejects all pending requests on WebSocket close
- Console tools have per-handler try/catch returning error text

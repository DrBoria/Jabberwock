# Devtool MCP Message Protocol

## Two message flows from extension host to webview

### Flow 1: DOM Operations (sendDomQuery)

Used by: findElement, clickElement, typeText, scrollElement, selectOption, getScreenshot, dragElement, dragFromTo, getConsoleLogs, getActivePage

Extension → Webview:

- `sendDomQuery(provider, type, payload)` in `packages/devtool/src/api/factory.ts:62-78`
- Sends via `provider.postMessageToWebview("action", { action: type, requestId, ...payload })`
- This calls EventBridge's `postMessageToWebview` which does `state.view.webview.postMessage(message)` (VS Code Webview API)
- Message format: `{ type: "action", action: "clickElement", requestId: "abc123", ...extraParams }`

Webview handler:

- `createDomMessageHandler` in `packages/devtool/src/dom/index.ts:72-116`
- Registers via `window.addEventListener("message", handler)`
- Routes by `message.action` to `actionHandlers` map (line 42-62)
- Response sent as `{ type: "domResponse", requestId, text: string }`

Extension receives response:

- `registerDomResponseHandler` in `dom/register-dom-response-handler.ts:26-40`
- Registers `onWebviewMessage("domResponse", handler)`
- Handles via `webviewMessageHandler` in `src/features/foundation/webview/events/handlers/on-webview-message.ts:43-54`
- Calls `resolveDomRequest(requestId, text)` which invokes the pending callback

### Flow 2: Store Queries (via createDomMessageHandler)

Used by: getRootSnapshot, getActionBuffer, applySnapshot

**REFACTORED**: `createWebviewStoreBridge` (`dom/webview-store-bridge.ts`) was DELETED and consolidated into `createDomMessageHandler`. Store queries now route through the same `actionHandlers` map as DOM operations.

Extension → Webview:

- `createFrontendBridge.sendQuery(action, parseResult)` in `dom/create-frontend-bridge.ts:44-66`
- Sends via `postMessageToWebview({ type: "storeQuery", action, requestId })` via EventBridge
- Message format: `{ type: "storeQuery", action: "getRootSnapshot", requestId: "abc123" }`

Webview handler:

- `createDomMessageHandler` in `packages/devtool/src/dom/index.ts` — handles ALL message types
- Routes by `message.action` to `actionHandlers` map (same map as Flow 1 DOM operations)
- Store actions: getRootSnapshot, getActionBuffer, applySnapshot handled via `createStoreQueryHandlers`
- Response sent as `{ type: "domResponse", requestId, text: JSON.stringify(...) }` via `vscode.postMessage(msg)`

Extension receives response:

- Same as Flow 1 - `registerDomResponseHandler` → `webviewMessageHandler` → `resolveDomRequest`

### Bug: getConsoleLogs timeout (FIXED)

Root cause: `getConsoleLogs` was NOT in the `actionHandlers` map in `dom/index.ts:42-62`
Fix added:

1. `packages/devtool/src/webview/console.ts`: Added in-memory log buffer (`logBuffer: LogEntry[]`, max 5000), `getWebviewConsoleLogs()` and `clearWebviewConsoleLogs()` exported functions
2. `packages/devtool/src/dom/index.ts`: Added `getConsoleLogs` handler that calls `getWebviewConsoleLogs(level, limit, offset)` and sends result as `domResponse`

### Bug: Store query timeout (FIXED)

`getRootSnapshot` and `getActionBuffer` time out. Root cause: `registerDomResponseHandler` was not called, so `domResponse` messages from webview were silently dropped — no handler in `messageHandlers` map. Fixed by:

- Adding `registerDomResponseHandler` call in `src/extension.ts:447`
- The handler wires `onWebviewMessage("domResponse", handler)` and `windowManager.resolveDomRequest(requestId, result)`

### Missing: clearConsoleLogs MCP tool

No clearConsoleLogs MCP command is registered. The `clearWebviewConsoleLogs()` function exists but isn't callable via MCP.

### Key files:

- `packages/devtool/src/dom/index.ts` - actionHandlers map + createDomMessageHandler
- `packages/devtool/src/dom/webview-store-bridge.ts` - createWebviewStoreBridge (DELETED — consolidated into createDomMessageHandler)
- `packages/devtool/src/dom/create-frontend-bridge.ts` - createFrontendBridge
- `packages/devtool/src/dom/register-dom-response-handler.ts` - registerDomResponseHandler
- `packages/devtool/src/webview/console.ts` - console log buffer
- `packages/devtool/src/api/factory.ts` - ExtensionBridge implementation with sendDomQuery
- `src/features/foundation/webview/events/handlers/on-webview-message.ts` - webviewMessageHandler routing
- `src/features/foundation/window-manager/store.ts` - setDomRequestCallback, resolveDomRequest, postMessageToWebview

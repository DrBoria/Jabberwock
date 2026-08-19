# DevTool Architecture (Final — After All Phases)

## Core Principle

`@jabberwock/devtool` is a self-contained npm package (like Google Tag Manager) providing ALL business logic. The extension and webview only provide adapters/providers. No hardcoded Jabberwock-specific strings in devtool itself.

## Files Changed

### Deleted

- `packages/devtool/src/dom/webview-store-bridge.ts` — consolidated into `createDomMessageHandler`

### Modified: `packages/devtool/src/api/factory.ts`

- **`DevtoolBridgeProvider` interface**: Added optional `onWebviewMessage` and `resolveDomRequest` — when both are provided, `createDevtoolBridge` auto-wires `registerDomResponseHandler` internally.
- **Internal FrontendBridge creation**: If `frontendBridge` is not passed and provider has `setDomRequestCallback`, `createDevtoolBridge` creates a `FrontendBridge` internally from `postMessageToWebview` + `setDomRequestCallback`. Extension no longer needs to import `createFrontendBridge`.
- **`getStoreState(params)`**: Dispatches by env. `env="backend"` → `getBackendStoreHelper`. `env="frontend"` → `frontendBridge.getRootSnapshot()` (via `getFrontendStoreHelper`).
- **`searchState(params)`**: `env="frontend"` → `searchFrontendState(params, frontendBridge)`. `env="backend"` → `searchBackendState(params, backendStore)`.
- **`getConsole({env,...})`**: `env="frontend"` → `frontendBridge.getConsoleLogs({level,limit,cursor})`. All other → `diagnosticsManager.getAllLogs()`.
- **`searchConsole({env,...})`**: `env="frontend"` → `frontendBridge.searchConsole({query,level,limit,cursor})`. `env="backend"` → `diagnosticsManager` with filter. No env → merge both streams sorted by timestamp.
- All `resolveEnvTag` workaround removed from console operations — frontend env now reads directly via bridge.

### Modified: `packages/devtool/src/api/mst/snapshot.ts`

- **`getStoreState()`**: Properly dispatches by env. `env="frontend"` → `getFrontendStoreHelper(frontendBridge)`. `env="backend"` → `getBackendStoreHelper(backendStore)`. No more workaround treating both as backend.

### Modified: `src/extension.ts`

- **`toDevtoolBridgeProvider()`**: Now accepts optional `onWebviewMessage` (typed as `handler: (provider, message: unknown)` for WebviewMessage compatibility) and adds `onWebviewMessage` + `resolveDomRequest` to the returned provider.
- **Devtool wiring section**: Simplified — no manual `registerDomResponseHandler`, no `createFrontendBridge` import. Just `toDevtoolBridgeProvider(provider, { onWebviewMessage })` → `createDevtoolBridge(provider, backendStore, undefined, { resolveEnvTag })`.

### Modified: `webview-ui/src/App.tsx`

- Removed store query skip logic from `onMessage` callback. All devtool queries (DOM + Store + Console) are handled by `createDomMessageHandler`. `onMessage` now only handles UI actions (switchTab, dialogs).

### Modified: `webview-ui/src/index.tsx`

- Replaced `createWebviewStoreBridge` with `createDomMessageHandler` in the boot function.

### Plan files

- `plans/devtool-refactor.md` — Contains full history of ALL 14 failed attempts (hypothesis + why each failed).
- `plans/frontend-store-bridge-fix.md` — Superseded, references `devtool-refactor.md`.

## Data Flow

### Frontend Store Read (env="frontend")

```
extension.ts → createDevtoolBridge(provider, backendStore, undefined, { resolveEnvTag })
  → createDevtoolBridge creates frontendBridge internally from provider.postMessageToWebview + provider.setDomRequestCallback
  → getStoreState({env:"frontend", store:"root", cursor:0, limit:10})
    → getFrontendStoreHelper(frontendBridge, store, cursor, limit)
      → frontendBridge.getRootSnapshot()
        → sendQuery("getRootSnapshot", ...)
          → provider.postMessageToWebview("action", {action:"getRootSnapshot", requestId})
          → webview: createDomMessageHandler receives "getRootSnapshot"
            → rootStore.getSnapshot()
            → provider.setDomRequestCallback(requestId, result)
              → resolve(result)
```

### Backend Store Read (env="backend")

```
getStoreState({env:"backend", store:"root", cursor:0, limit:10})
  → getBackendStoreHelper(backendStore, store, cursor, limit)
    → backendStore.getMstStore()
    → read snapshot from MST store directly
```

### Console Read (env="frontend")

```
getConsole({env:"frontend", level:"info", limit:10, cursor:0})
  → frontendBridge.getConsoleLogs({level, limit, cursor})
    → sendQuery("getConsoleLogs", ...)
      → webview: createDomMessageHandler reads from console store
```

### Console Read (env="backend")

```
getConsole({env:"backend", level:"info", limit:10, cursor:0})
  → diagnosticsManager.getAllLogs()
  → filter by level
  → paginate newest-first
```

## 14 Failed Attempts Root Cause

ALL attempts #1-#13 targeted JavaScript code logic changes. The real root cause was **VS Code webview caching** (`retainContextWhenHidden: true`). VS Code preserves the Chromium renderer process across F5 reloads, serving stale JavaScript. `webview.asWebviewUri()` ignores query parameters for cache-busting. Dynamic `import()` is also cached.

**Attempt #14 (THE FIX)**: Build hash mismatch detection in `getHtmlContent()`. An inline `<script>` compares `acquireVsCodeApi().getState()._buildId` vs current build hash, and calls `location.reload()` on mismatch.

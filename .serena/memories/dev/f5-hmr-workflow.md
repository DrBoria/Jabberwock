# F5 HMR Dev Workflow

## Two Launch Configurations

### 1. "Run Extension (HMR)" — DEFAULT (order: 1)

- **preLaunchTask**: `"dev"` → starts 3 parallel background tasks:
    - `dev:webview` — Vite HMR dev server (`webview-ui`, port persisted to `webview-ui/.vite-port`)
    - `watch:bundle` — esbuild --watch (extension bundle to `src/dist/`)
    - `watch:tsc` — tsc --noEmit --watch (type-checking)
- **env**: `NODE_ENV=development`, `VSCODE_DEBUG_MODE=true`, `VSCODE_DEV_MODE=true`
- **HTML**: `getHMRHtmlContent()` — reads `.vite-port` from `extUri/../webview-ui/.vite-port`, verifies Vite is running via `lsof`, serves permissive CSP HTML loading `http://localhost:{port}/src/index.tsx`
- **Fallback**: If Vite not running, falls back to `getHtmlContent()` (production build with nonce CSP)

### 2. "Run Extension (Production)" — HIDDEN (order: 2)

- **preLaunchTask**: `"build"` → sequential: `build:extension` (esbuild bundle) → `build:webview` (tsc -b && vite build production)
- **HTML**: `getHtmlContent()` — loads production build from `webview-ui/build/assets/`

## Key Files

- `.vscode/launch.json` — Launch configs
- `.vscode/tasks.json` — Task definitions
- `src/features/foundation/window-manager/store.ts` — `resolveWebviewView()` (line 224 dispatches HMR vs production), `getHMRHtmlContent()` (line 380), `getHtmlContent()` (line 340)
- `webview-ui/vite.config.ts` — `persistPortPlugin` writes `.vite-port` to `webview-ui/` directory (fix: was writing to project root, now writes to `__dirname` = webview-ui/)

## getHMRHtmlContent Restored (2026-06-02)

`getHMRHtmlContent()` in `store.ts` was degraded to just `return getHtmlContent(provider, webview)`, losing all HMR functionality. Now properly:

1. Reads `.vite-port` from `webview-ui/.vite-port` via `path.dirname(extUri.fsPath) + "/webview-ui/.vite-port"`
2. Verifies Vite is running via `lsof -i :{port}`
3. If running: serves permissive CSP HTML loading `http://localhost:{port}/src/index.tsx` + Vite HMR client
4. Falls back to `getHtmlContent()` (production build) if Vite not detected

## Path Resolution Fix (2026-06-02)

`localResourceRoots` and `getHtmlContent()` used `extensionUri` (= `.../Jabberwock/src`) as base, but build output is at `.../Jabberwock/webview-ui/build/`. Fixed by using `path.resolve(extensionUri.fsPath, "..")` to get workspace root.

## .vite-port Path Fix

The `persistPortPlugin` in `vite.config.ts` writes `.vite-port` to `resolve(__dirname, ".vite-port")` which resolves to `webview-ui/.vite-port`. The extension reads from `path.join(extUri.fsPath, "..", "webview-ui", ".vite-port")`. These must match.

## Debug Logging Policy

High-frequency message types (`webviewLog`, `webviewDataSnapshot`) are suppressed in `webviewMessageHandler` via `QUIET_TYPES` Set. Snapshot push (every 3s) and console bridge logging no longer trigger extension host console output. All unnecessary `console.warn` debug logging removed from:

- `packages/devtool/src/webview/vscode.ts` — VSCodeAPIWrapper.postMessage
- `packages/devtool/src/webview/push-snapshot.ts` — pushSnapshot
- `packages/devtool/src/api/mst/cache.ts` — registerSnapshotHandler
- `packages/devtool/src/api/factory.ts` — getStoreState
- `packages/devtool/src/api/mst/snapshot.ts` — getFrontendStoreHelper
- `webview-ui/src/index.tsx` — boot()

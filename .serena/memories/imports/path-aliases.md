# Path Aliases in Jabberwock

## Configuration

- Defined in `src/tsconfig.json` under `compilerOptions.paths`
- `@features/*` → `./features/*`
- `@utils/*` → `./utils/*`

## EventBridge / ProviderHandle Imports

- All imports of `EventBridge`, `ProviderHandle`, `postStateToWebview`, `postMessageToWebview` must use `@features/foundation/webview/EventBridge`
- Files that need `EventBridge` CLASS (for static props like `EventBridge.outputChannel`, `EventBridge.activeInstances`, or constructor calls): import `EventBridge` from `@features/foundation/webview/EventBridge`
- Files that only need `ProviderHandle` interface: import `ProviderHandle` from `@features/foundation/webview/EventBridge`

## Window Manager Store Imports

- All imports of `handleModeSwitch`, `postStateToWebview`, `postMessageToWebview`, `getWorkspaceTracker`, `resolveWebviewView`, `scheduleStatePush`, `resolveActivePageRequest` must use `@features/foundation/window-manager/store`

## Key Files

- `src/features/foundation/webview/EventBridge.ts` — exports `ProviderHandle` interface and `EventBridge` class
- `src/features/foundation/window-manager/store.ts` — exports window management functions

## Inline Dynamic Imports

- For files that use `import("...")` dynamic imports (e.g., `intents/context.ts`, `intents/bus.ts`, `importSettings.ts`): use `import("@features/foundation/webview/EventBridge")`

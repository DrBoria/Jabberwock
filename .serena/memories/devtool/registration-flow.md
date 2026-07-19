# Devtool Frontend Store — Registration Flow

## How `registerDomResponseHandler` wires up (extension side)

File: [`src/extension.ts`](src/extension.ts:447)

```ts
registerDomResponseHandler(
	// 1st param: onWebviewMessage wrapper
	(type, handler) => {
		;(
			onWebviewMessage as unknown as (
				type: string,
				handler: (provider: unknown, message: Record<string, unknown>) => void,
			) => void
		)(type, handler)
	},
	// 2nd param: resolveDomRequest bridge
	(requestId, result) => {
		backendStore.foundation.windowManager.resolveDomRequest(requestId, result)
	},
)
```

**Step-by-step**:

1. `registerDomResponseHandler` is called inside the dynamic `import("@jabberwock/devtool").then(...)` block (line 447).
2. The first argument is a callback `(type, handler) => ...` that wraps `onWebviewMessage`. This maps the generic `registerDomResponseHandler` API to the concrete [`onWebviewMessage`](src/features/foundation/webview/events/handlers/on-webview-message.ts:26) function from the webview events system.
3. Inside that wrapper, `onWebviewMessage("domResponse", handler)` is called — this stores the handler in the `messageHandlers` Map.
4. The second argument is a callback `(requestId, result) => ...` that bridges to [`windowManager.resolveDomRequest`](src/features/foundation/window-manager/store.ts:72). This resolves the pending promise created by `sendDomQuery`.

When a `domResponse` message arrives from the webview:

- [`webviewMessageHandler`](src/features/foundation/webview/events/handlers/on-webview-message.ts:43) (line 47) finds the handler via `messageHandlers.get("domResponse")`
- Calls `handler(provider, typedMessage)` which is the registered callback
- The registered callback extracts `requestId` and `text` from the message
- Calls `backendStore.foundation.windowManager.resolveDomRequest(requestId, text)` which resolves the pending `sendDomQuery` promise

## How frontend message handling works (current — after refactor)

**REFACTORED**: `createWebviewStoreBridge` was DELETED and consolidated into `createDomMessageHandler`.

File: [`webview-ui/src/index.tsx`](webview-ui/src/index.tsx)

```tsx
// The boot function replaces createWebviewStoreBridge with createDomMessageHandler
createDomMessageHandler(rootStore, (msg) => vscode.postMessage(msg as WebviewMessage))
```

**How it works (current)**:

1. `createDomMessageHandler` (`packages/devtool/src/dom/index.ts`) registers `window.addEventListener("message", handler)`
2. Handler routes by `message.action` to `actionHandlers` map — ALL message types (DOM + store queries) go through the same handler
3. Store actions (getRootSnapshot, getActionBuffer, applySnapshot, getConsoleLogs) have dedicated handlers in `actionHandlers`
4. Response sent as `{ type: "domResponse", requestId, text }` via `vscode.postMessage(msg)`
5. Returns cleanup function: removes the message listener

## The "break" that was fixed

Before this fix, the webview sent `{ type: "domResponse", requestId, text }` via `vscode.postMessage`, and the extension host received it via `webview.onDidReceiveMessage`. This triggered `webviewMessageHandler`, which looked up `messageHandlers.get("domResponse")` — but **no handler was registered**. The message was silently dropped, the `sendDomQuery` promise timed out after 10 seconds.

The fix adds the missing handler registration via `registerDomResponseHandler`, creating the complete round-trip:

```
MCP → sendDomQuery → postMessageToWebview → webview (createDomMessageHandler) → postMessage("domResponse") → webviewMessageHandler → messageHandlers.get("domResponse") → resolveDomRequest → Promise resolves → MCP response
```

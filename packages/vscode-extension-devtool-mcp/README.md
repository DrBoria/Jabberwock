# vscode-extension-devtool-mcp

A framework-agnostic devtool package that connects an AI agent (via MCP) to a
running webview/extension, giving it live visibility into the DOM, console,
state stores, and performance — plus a React `<Devtool>` component and
Express/Nest middleware for embedding it in any host application.

## Install

```sh
pnpm add vscode-extension-devtool-mcp
```

> **Source-first package.** The published `exports` point at TypeScript source
> (`./src/…`). Your consumer must compile TypeScript with `module: NodeNext`
> (or use a bundler that does) and import relative files with explicit
> `.js`/`.jsx` extensions — the same convention the package itself uses.
> `sideEffects: false` enables full tree-shaking.

## Entry points

| Subpath                                  | Runtime               | What you get                                                                                                          |
| ---------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `vscode-extension-devtool-mcp`           | Node / extension host | `DevtoolServer`, diagnostics, transports, store tools — **no React, no CSS**                                          |
| `vscode-extension-devtool-mcp/webview`   | Browser (webview)     | `<Devtool>`, `<DevtoolProvider>`, `LocatorBridge`, diagnostic dashboard, vscode webview wrapper, frontend interceptor |
| `vscode-extension-devtool-mcp/mcp-entry` | Node (stdio)          | The stdio MCP client entry (connects to the running extension's WS server and re-exports its tools over stdio)        |
| `vscode-extension-devtool-mcp/express`   | Node (Express)        | `createDevtool(options)`, `devtoolMiddleware(devtool)` — standalone Express host                                      |
| `vscode-extension-devtool-mcp/nest`      | Node (Nest)           | `createDevtool(options)`, `DevtoolNestMiddleware` — standalone Nest host                                              |
| `vscode-extension-devtool-mcp/backend`   | Node                  | Low-level backend surface (devtool server, diagnostics, interceptor, profiler)                                        |

## Quick start — React webview

```tsx
import { Devtool } from "vscode-extension-devtool-mcp/webview"

function App() {
	return (
		<Devtool
			postMessage={vsCodeApi.postMessage}
			config={{
				// the frontend store adapter (mobx / redux / zustand / apollo);
				// declaring it activates the matching store tools on the backend
				frontend: { store: myFrontendStoreAdapter },
			}}>
			<YourApp />
		</Devtool>
	)
}
```

## Quick start — Express host

```ts
import express from "express"
import { createDevtool, devtoolMiddleware } from "vscode-extension-devtool-mcp/express"

const app = express()
const devtool = createDevtool({ port: 60060, httpPort: 60061, store: createMobxAdapter(root) })
app.use(devtoolMiddleware(devtool))
```

## Quick start — Nest host

```ts
import { createDevtool, DevtoolNestMiddleware } from "vscode-extension-devtool-mcp/nest"

const devtool = createDevtool({ port: 60060, httpPort: 60061 })
// register DevtoolNestMiddleware as a global middleware in your Nest module
```

## Config-driven MCP tool activation

The MCP tool surface is **derived from the config** passed at connection
time — nothing is hard-wired:

- **No store passed** → state-store MCP tools (snapshots, history, change
  events, actions) are simply not registered.
- **MobX store passed** (`createMobxAdapter`) → MobX tools active.
- **Redux / Zustand / Apollo** → the matching adapter activates its tool set.
- **No backend connection** → backend-side tools are invisible to the agent;
  only frontend tools are exposed, and vice versa.

All framework integration lives under `src/framework/<name>` (mobx, redux,
zustand, apollo, plain) behind a single `IStoreAdapter` interface; `config.ts`
at the package root decides what is wired up.

## Diagnostics & metrics

- `DiagnosticsManager` (+ `diagnosticsManager` singleton) collects logs,
  performance metrics, resource snapshots, and MST patches.
- `MetricsCollector` (frontend) profiles every devtool request — performance,
  CPU, and memory — for maximum per-request visibility.
- `MessageInterceptor` traces message traffic with filtering.

## Testing

```sh
pnpm test          # 50 tests: config gating, adapters, history, hosts, state tools, metrics, <Devtool>
pnpm check-types
pnpm lint
```

## License

Apache-2.0 (see [LICENSE](./LICENSE)).

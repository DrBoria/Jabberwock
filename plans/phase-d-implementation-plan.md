# Phase D Implementation Plan — Browser Frontend Wiring via Event Bus + Cross-Compat + Server-Mode Task-Handler + ICG-D1 Display

> **Status:** PLANNING ONLY — no source code written or modified.
> **HEAD:** `cb6fa63e5` "phase C" (branch `mega-refactoring`)
> **Authoritative specs:** [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md) §11 Phase D table (lines 928-936), §4.5 (lines 441-498), §4.4 (lines 418-439), §6.2-6.4 (lines 586-621), §8.3/8.4 (lines 687-704); [`plans/architecture-infinite-context-graph-storage.md`](architecture-infinite-context-graph-storage.md) ICG-D1 (lines 386-393).
> **Verified this session:** Serena LSP + RPG Encoder + esbuild metafile probe (read-only).

---

## 1. Phase D Scope Summary

The v4 plan §11 Phase D table (lines 928-936) defines three rows:

| Row                 | Action (abridged)                                                                                                                                                                                                                                                                                                                                             | Gate                                                                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B→D1** (line 932) | `frontend/src/bootstrap.tsx`: select `IFrontendConnector` by env (§7.3) + inject `IConnectorEventBus` into singleton/React context; **all ~90 class A call sites** (§2.4) switch to `bus.publish` / `bus.subscribe`; App.tsx two window-listeners replaced by bus subscriptions (§4.5 before/after). Class B DOM-local untouched (allowlist frozen BEFORE D). | `pnpm check-all` + `build --force`: extension webview works identically (regression via devtool 3 layers); **audit:platform frontend — criterion C-3** (violations only in allowlisted class B) |
| **D2** (line 933)   | `BrowserWsFrontendConnector` in `connectors/web/frontend`; vite proxy `/ws` for standalone dev. Devtool bridge over WS (§7.4, off by default). **Streaming through bus:** verify `streamChunk` renders in both webview and browser with zero `postMessage` calls (criterion C-4).                                                                             | Open `http://localhost:PORT` in browser: hydration state OK, UI renders from same MST snapshot as webview; streaming visible live                                                               |
| **D3** (line 934)   | **Cross-compat verification (G2):** unified smoke script sends event constants through both transports, compares created intents in backend IntentStore + frontend store snapshots; ask broadcast → first-response-wins (§6.4) verified with two WS clients simultaneously.                                                                                   | Script in `tests/` (not UI); results are phase artifact                                                                                                                                         |

**Success criterion (line 936):** browser client and webview client are interchangeable at the protocol level; smartwatch scenario = any second WS client with the same body format; frontend app-level code is platform-neutral (C-3/C-4).

### Additional Phase D scope (from this task):

- **Server-mode task-handler deferral:** clear the backend root-store-graph vscode coupling so `startBackend()` can host the MST root store + intent bus (full §7.1 sketch) and register task intent handlers in server mode. Currently deferred in [`backend/startup/bootstrap.ts`](../backend/startup/bootstrap.ts:35) (purity note, lines 35-43) and [`connectors/web/backend/main.ts`](../connectors/web/backend/main.ts:87) (`buildServerState` comment, lines 87-91).
- **ICG-D1 display layer:** browser/watch virtualized timeline + deep-linking + bounded progressive hydration, wired to the ICG-C2 read path (`ContextSearchService`/`ContextRecallService`) and `context.history.range` frames. Spec: [`plans/architecture-infinite-context-graph-storage.md`](architecture-infinite-context-graph-storage.md:386) lines 386-393.

### Current state (verified this session):

- **Frontend class A coupling:** 22 files in `frontend/src/**` import from `@jabberwock/devtool/webview`. Of these, 19 are class A host-transport (use the `vscode` wrapper for `postMessage`/host communication) and 3 import devtool-specific utilities only (`LocatorBridge`/`initializeSourceMaps` in `app-content.tsx`, `DiagnosticDashboard` in `message-area.tsx`, `enhanceErrorWithSourceMaps` in `ErrorBoundary.tsx`) — the 3 devtool-specific files are NOT class A host transport and stay as-is.
- **Backend root-store graph vscode coupling:** **20 files** (re-verified via esbuild metafile probe this session; plan said 21 — see §3.1) in the `backend/features/backendroot/store.ts` import graph import `vscode`. These block `startBackend()` from hosting the root store + intent bus in server mode.
- **Frontend connectors:** `connectors/web/frontend/` and `connectors/vscode/frontend/` are both **empty** — no frontend connector implementations exist yet.
- **`IConnectorEventBus` contract:** already defined in [`packages/types/src/protocol/frontend-connector.ts`](../packages/types/src/protocol/frontend-connector.ts:85) (lines 85-99).
- **`IFrontendConnector` contract:** already defined in [`packages/types/src/protocol/frontend-connector.ts`](../packages/types/src/protocol/frontend-connector.ts:62) (lines 62-76).
- **`BackendCapabilities` contract:** already defined in [`packages/types/src/protocol/backend-connector.ts`](../packages/types/src/protocol/backend-connector.ts:183) (lines 183-193).
- **Server capabilities:** already implemented in [`connectors/web/backend/capabilities.ts`](../connectors/web/backend/capabilities.ts:40) (`createServerCapabilities`).
- **`setupIntentBus`:** in [`backend/extension-activation/modules/core/intents.ts`](../backend/extension-activation/modules/core/intents.ts:19) (lines 19-65). Imports `vscode` (line 1) but only uses `vscode.version` and `vscode.env.language` in the telemetry service (lines 54, 58).
- **Extension activation:** [`connectors/vscode/backend/activation/extension.ts`](../connectors/vscode/backend/activation/extension.ts:62) calls `startBackend()` (line 98), then `createBackendRootStore()` (line 105), then `setupIntentBus()` (line 110) — the root store + intent bus are currently extension-only.
- **Server entry:** [`connectors/web/backend/main.ts`](../connectors/web/backend/main.ts:20) calls `startBackend()` (line 74) but does NOT create the root store or register intent handlers. `buildServerState()` (line 93) returns capability-derived state, not the full MST snapshot.

### Drift + untracked files (exclude from staging):

**Drift ×3** (modified, not part of Phase D):

- `.rpg/graph.json`
- `.serena/memories/debug/debug-workflow-protocol.md`
- `md-todo-mcp`

**Untracked ×6** (not part of Phase D):

- `.jabberwock-data/`
- `.roo/skills/run-extension/`
- `.serena/memories/phase-a-staging-state.md`
- `DebugMCP/`
- `loseless-context/`
- `packages/devtool/src/api/debug-mcp-bridge.mjs`

---

## 2. Chunk Breakdown

Seven sequential chunks. Each is a separate Code-mode dispatch with its own gates. Execution order is strict: each chunk depends on the previous.

```
D0 → D1a → D1b → D1c → D2 → D4 → D3 → D5 → D6
```

> **Decision (2026-09-03, architect): D3↔D4 reorder.** The original order (D3 before D4) was a plan-level dependency inversion: D3's core assertions (first-response-wins §6.4, broadcast convergence §6.3, task-command identity, IntentStore comparison) require server-mode components that only D4 builds (MST root store, intent bus, task/message handlers, AskClaimTracker production wiring). Verified: `AskClaimTracker` (`backend/features/foundation/webview/ask-claims.ts:19-45`) is referenced only in `eventBridge.test.ts` (lines 143, 180) — no production code calls `tracker.claim()`; the askResponse handler (`register-on-messages-intents.ts:24`) calls `getBackendRootStore()` and returns early in server mode; `startBackend()` (bootstrap.ts purity note, lines 35-43) does not create the root store or register feature handlers. **Resolution:** D4 now runs before D3. D4 gains a new sub-chunk D4h (Ask first-response-wins wiring, pure Node, no new capability slots). D3 verifies all four categories against the real standalone bundle (`node backend/dist/server.js`, `.mjs` artifact, same pattern as `connectors/web/backend/acceptance/context-two-client.mjs`). No assertions are weakened or deferred.

### D0 — Class B Allowlist Freeze (prerequisite, no code)

**Goal:** Freeze the class B (DOM-local) allowlist BEFORE any Phase D code changes, per §2.4 line 116: "класс B зафиксирован allowlist'ом ДО начала Phase D (критерий C-3 §8.3)."

**Files to create:**

- `plans/phase-d-class-b-allowlist.md` — documents the ~20 DOM-local files that stay as-is, with justification per file. Source: §2.4 line 114 (class B list).

**Files to modify:** None.

**Citations:**

- [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md:107) §2.4 class B row (line 107)
- [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md:114) §2.4 class B file list (line 114)
- [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md:116) §2.4 critical bug class note (line 116)
- [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md:687) §8.3 criterion C-3 (lines 687-695)

**Acceptance gates:**

- G1: `pnpm check-all` (no code changes, should pass)
- G2: N/A (no build)
- G3: Allowlist file exists and covers all class B files from §2.4 line 114
- G4: Stage `plans/phase-d-class-b-allowlist.md` by literal path

**Dependencies:** None (first chunk).

---

### D1a — Frontend Connector Scaffolding + Event Bus Singleton

**Goal:** Create `VscodeWebviewFrontendConnector` in `connectors/vscode/frontend/` and the `connector-bus` singleton module in `frontend/src/`. Wire `bootstrap.tsx` to select the connector by env and inject the bus. This is the foundation for all subsequent class A migrations.

**Files to create:**

1. `connectors/vscode/frontend/connector.ts` — `VscodeWebviewFrontendConnector` implementing `IFrontendConnector`:
    - `id = "vscode"`
    - `connect()`: sets up the event bus
    - `eventBus`: `IConnectorEventBus` implementation that holds **exactly one** `window.addEventListener("message", ...)` and routes events to subscribers by `MessageFilter` (§4.5 line 462). The host-vs-DOM-local classification (existing early-return logic from `handleExtensionMessage`) moves into the bus router.
    - `publish(msg)`: delegates to `vscode.postMessage(msg)` (the existing `@jabberwock/devtool/webview` wrapper)
    - `subscribe(filter, handler)`: registers a handler; the single window listener dispatches to matching handlers
2. `frontend/src/connector-bus/index.ts` — singleton module:
    - `createFrontendConnector(env: "vscode" | "web"): Promise<IFrontendConnector>` — selects connector by env (§7.3 lines 652-657). For `"vscode"`, imports `VscodeWebviewFrontendConnector`. For `"web"`, imports `BrowserWsFrontendConnector` (added in D2).
    - `initConnectorBus(): Promise<IConnectorEventBus>` — calls `createFrontendConnector(env)`, `connector.connect()`, stores the bus in a module-level singleton
    - `getConnectorBus(): IConnectorEventBus` — returns the singleton (throws if not initialized)
    - `ConnectorBusContext` — React context
    - `useConnectorBus(): IConnectorEventBus` — React hook consuming the context

**Files to modify:**

1. `frontend/src/bootstrap.tsx` (lines 1-89):
    - Replace `import { vscode } from "@jabberwock/devtool/webview"` (line 4) with `import { initConnectorBus, getConnectorBus } from "./connector-bus"`
    - In `boot()`: call `await initConnectorBus()` before creating the root store
    - Replace `createWebviewStoreBridge(root, (msg) => { vscode.postMessage(msg) })` (lines 34-36) with `createWebviewStoreBridge(root, (msg) => { getConnectorBus().publish(msg) })`
    - Replace `window.addEventListener("message", (event) => { ... mst-snapshot-batch ... })` (lines 60-65) with `getConnectorBus().subscribe({ types: ["mst-snapshot-batch"] }, (msg) => { mstBridge.handleSnapshotBatch(msg.payload) })`
    - Keep `initWebviewConsoleBridge()` (line 7) — it's a devtool utility, not class A host transport
    - Keep `devToolsStore` import (line 13) — it's a devtool store, not class A

**Citations:**

- [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md:441) §4.5 IConnectorEventBus contract (lines 441-498)
- [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md:462) §4.5 single window listener requirement (line 462)
- [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md:464) §4.5 zero window.addEventListener outside connectors (line 464)
- [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md:498) §4.5 bootstrap wiring (line 498)
- [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md:652) §7.3 frontend bootstrap env selection (lines 652-657)
- [`packages/types/src/protocol/frontend-connector.ts`](../packages/types/src/protocol/frontend-connector.ts:62) IFrontendConnector (lines 62-76)
- [`packages/types/src/protocol/frontend-connector.ts`](../packages/types/src/protocol/frontend-connector.ts:85) IConnectorEventBus (lines 85-99)
- [`frontend/src/bootstrap.tsx`](../frontend/src/bootstrap.tsx:1) current bootstrap (lines 1-89)

**Acceptance gates:**

- G1: `pnpm check-all` — 0 errors
- G2: `pnpm build --force` — extension webview works identically (regression via devtool 3 layers: backend vars → store state → DOM)
- G3: Runtime proof: open extension in VS Code, verify chat works, state hydrates, mst-snapshot-batch applies
- G4: Stage all new + modified files by literal path

**Dependencies:** D0 (class B allowlist frozen).

---

### D1b — Migrate App.tsx + Root Store to Bus

**Goal:** Replace the two `window.addEventListener("message")` listeners in `App.tsx` and the `postMsg` helper + `initMessageListener` in `root-store/store.ts` with bus subscriptions. This is the §4.5 before/after transition (lines 466-496).

**Files to modify:**

1. `frontend/src/app-shell/App.tsx` (lines 1-55):
    - Remove `import { vscode, createDomMessageHandler } from "@jabberwock/devtool/webview"` (line 3)
    - Add `import { useConnectorBus } from "../connector-bus"`
    - Replace `const postMessage = useCallback((msg) => vscode.postMessage(msg), [])` (line 17) with `const bus = useConnectorBus()` and `const postMessage = useCallback((msg) => bus.publish(msg), [bus])`
    - Replace `useEffect(() => { store.initMessageListener(); return () => window.removeEventListener("message", store.handleExtensionMessage) }, [store])` (lines 19-24) with `useEffect(() => { const d = bus.subscribe({}, (msg) => store.handleExtensionMessage(msg)); return () => d.dispose() }, [bus, store])`
    - Replace `useEffect(() => { const h = createDomMessageHandler(postMessage, store, {...}); window.addEventListener("message", h); return () => window.removeEventListener("message", h) }, [postMessage, store])` (lines 25-29) with `useEffect(() => { const h = createDomMessageHandler(postMessage, store, {...}); const d = bus.subscribe({ types: DOM_ACTION_TYPES }, (msg) => h(msg)); return () => d.dispose() }, [bus, store, postMessage])`
    - Replace `vscode.postMessage({ type: "requestState" })` (line 34) with `bus.publish({ type: "requestState" })`
    - Note: `createDomMessageHandler` is imported from `@jabberwock/devtool/webview` — it's a DOM-local utility (class B), NOT class A host transport. Keep the import but it will receive `bus.publish` as the `postMessage` callback.
2. `frontend/src/features/root-store/store.ts` (lines 1-232):
    - Remove `import { vscode } from "@jabberwock/devtool/webview"` (line 2)
    - Add `import { getConnectorBus } from "../../../connector-bus"`
    - Replace `const postMsg = (msg: WebviewMessage) => vscode.postMessage(msg)` (line 27) with `const postMsg = (msg: WebviewMessage) => getConnectorBus().publish(msg)`
    - Replace `initMessageListener()` action (lines 216-218): `window.addEventListener("message", (event) => this.handleExtensionMessage(event))` → this action is now called from App.tsx via `bus.subscribe`. Change the action to accept an `IConnectorEventBus` parameter: `initMessageListener(bus: IConnectorEventBus) { const d = bus.subscribe({}, (msg) => this.handleExtensionMessage(msg)); return d }`
    - `handleExtensionMessage(event: MessageEvent)` (line 203): change signature to accept `InboundAppMessage` instead of `MessageEvent`: `handleExtensionMessage(message: InboundAppMessage)`. The body stays the same (handleDomAction early-return, handleStreamChunk early-return, dispatch map).
    - Note: `handleExtensionMessage` is also referenced in App.tsx line 22 (`window.removeEventListener("message", store.handleExtensionMessage)`) — this reference is removed in the App.tsx migration above.

**Citations:**

- [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md:466) §4.5 before/after (lines 466-496)
- [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md:483) §4.5 AFTER code (lines 483-492)
- [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md:494) §4.5 streaming exception (lines 494-495)
- [`frontend/src/app-shell/App.tsx`](../frontend/src/app-shell/App.tsx:1) current App.tsx (lines 1-55)
- [`frontend/src/features/root-store/store.ts`](../frontend/src/features/root-store/store.ts:27) postMsg helper (line 27)
- [`frontend/src/features/root-store/store.ts`](../frontend/src/features/root-store/store.ts:203) handleExtensionMessage (lines 203-215)
- [`frontend/src/features/root-store/store.ts`](../frontend/src/features/root-store/store.ts:216) initMessageListener (lines 216-218)

**Acceptance gates:**

- G1: `pnpm check-all` — 0 errors
- G2: `pnpm build --force` — extension webview works identically (regression via devtool 3 layers)
- G3: Runtime proof: open extension, verify chat works, state hydrates, DOM actions work (pushWindow, settingsButtonClicked), streaming renders
- G4: Stage modified files by literal path

**Dependencies:** D1a (connector-bus singleton exists).

---

### D1c — Migrate Remaining Class A Stores/Action Creators to Bus

**Goal:** Migrate the 16 remaining class A files from `vscode.postMessage` to `bus.publish`. After this chunk, **zero** `vscode.postMessage` calls remain in `frontend/src/**` (criterion C-3).

**Files to modify (16 files):**

Each file: remove `import { vscode } from "@jabberwock/devtool/webview"`, add `import { getConnectorBus } from "<relative path to connector-bus>"`, replace all `vscode.postMessage(...)` calls with `getConnectorBus().publish(...)`.

1. `frontend/src/sections/dndTextArea/store.ts` — 5 postMessage sites
2. `frontend/src/features/chat/notifications/store.ts` — 10 postMessage sites
3. `frontend/src/features/chat/topic/store.ts` — postMessage sites
4. `frontend/src/features/chat/tree/store.tsx` — postMessage sites
5. `frontend/src/features/chat/task/store.ts` — task store + task-header goals (~12 sites)
6. `frontend/src/features/chat/task/actions/condenseContext.ts` — postMessage sites
7. `frontend/src/features/chat/task/actions/summarizeConversation.ts` — postMessage sites
8. `frontend/src/features/chat/task/components/task-header/header.tsx` — postMessage sites
9. `frontend/src/features/chat/task/messages/events/actions/register.ts` — 11 postMessage sites
10. `frontend/src/features/chat/task/events/actions/register.ts` — postMessage sites
11. `frontend/src/features/cloud/store.ts` — 9 postMessage sites
12. `frontend/src/features/history/store.ts` — 8 postMessage sites
13. `frontend/src/features/settings/settings-store/actions.ts` — pm helper
14. `frontend/src/features/marketplace/store.ts` — 11 postMessage sites
15. `frontend/src/features/foundation/window-manager/store.tsx` — 7 postMessage sites
16. `frontend/src/features/foundation/events/handlers/foundation-received.ts` — postMessage sites

**Note:** 16 files listed (the 19 class A files minus `bootstrap.tsx` and `App.tsx` which were done in D1a/D1b). The plan's §2.4 inventory says "~35 files / ~90 call sites" — the current codebase has 19 class A files (3 of the 22 `@jabberwock/devtool/webview` importers are devtool-specific, not class A). The call-site count within these 16 files totals ~90.

**Citations:**

- [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md:109) §2.4 class A full list (lines 109-112)
- [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md:116) §2.4 critical bug class note (line 116)
- [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md:687) §8.3 criterion C-3 (lines 687-695)

**Acceptance gates:**

- G1: `pnpm check-all` — 0 errors
- G2: `pnpm build --force` — extension webview works identically (regression via devtool 3 layers)
- G3: **audit:platform frontend — criterion C-3:** `pnpm audit:platform` shows zero class A violations in `frontend/src/**`; only allowlisted class B files remain
- G4: Stage modified files by literal path

**Dependencies:** D1b (App.tsx + root-store migrated, so the bus is the sole publish path).

---

### D2 — BrowserWsFrontendConnector + Vite Proxy + Streaming Through Bus

**Goal:** Create `BrowserWsFrontendConnector` in `connectors/web/frontend/`. Add vite proxy for `/ws` in standalone dev. Verify streaming renders in both webview and browser with zero `postMessage` calls (criterion C-4).

**Files to create:**

1. `connectors/web/frontend/connector.ts` — `BrowserWsFrontendConnector` implementing `IFrontendConnector`:
    - `id = "web"`
    - `connect(opts)`: opens WebSocket to `ws://host:port/ws` (URL from `opts.wsUrl` or `window.location`); performs hello → state handshake (§6.2 lines 586-596); on state receipt, dispatches to bus subscribers
    - `eventBus`: `IConnectorEventBus` implementation:
        - `publish(msg)`: wraps in `ConnectorEnvelope { protocolVersion: 1, clientId, sentAt, body: msg }` and sends as WS frame
        - `subscribe(filter, handler)`: registers a handler; WS `onmessage` dispatches to matching handlers. **DOM-local messages** (`{type:"action"}`, `{type:"pushWindow"}`, etc.) are handled by **in-process loopback** inside the bus implementation — they do NOT go over the wire (§4.5 line 463)
    - Reconnect with exponential backoff (§4.4 lines 418-439)
    - On reconnect: re-request state (`requestState`)
2. `connectors/web/frontend/index.ts` — barrel export

**Files to modify:**

1. `frontend/vite.config.ts` (lines 1-240):
    - Add `server.proxy` for `/ws` → `ws://localhost:PORT` (the server port from `connectors/web/backend/config.ts`) for standalone dev mode
    - The proxy is only active in dev mode (`mode === "development"`)
2. `frontend/src/connector-bus/index.ts`:
    - Update `createFrontendConnector(env)`: for `"web"`, import `BrowserWsFrontendConnector` from `connectors/web/frontend`
    - Env detection: `const env = import.meta.env.VITE_CONNECTOR_MODE ?? (window.vscode ? "vscode" : "web")` — or a simpler heuristic: if `window.acquireVsCodeApi` exists, it's vscode; otherwise web

**Citations:**

- [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md:418) §4.4 IFrontendConnector + BrowserWsFrontendConnector (lines 418-439)
- [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md:463) §4.5 DOM-local in-process loopback (line 463)
- [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md:586) §6.2 WS frames + handshake (lines 586-596)
- [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md:652) §7.3 frontend bootstrap + static serving (lines 652-657)
- [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md:658) §7.4 devtool per mode (lines 658-663)
- [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md:687) §8.3 criterion C-4 (lines 687-695)

**Acceptance gates:**

- G1: `pnpm check-all` — 0 errors
- G2: `pnpm build --force` — both extension webview AND browser work
- G3: **Browser runtime proof:** open `http://localhost:PORT` in browser: hydration state OK, UI renders from same MST snapshot as webview; streaming visible live (send a task, watch streamChunk render); **zero `postMessage` calls** in browser mode (criterion C-4)
- G4: Stage all new + modified files by literal path

**Dependencies:** D1c (all class A migrated to bus, so the bus is the sole transport abstraction).

---

### D4 — Server-Mode Task-Handler Deferral (Backend Purity Debt)

**Goal:** Clear the 20-file vscode coupling in the backend root-store import graph so `startBackend()` can host the MST root store + intent bus (full §7.1 sketch) and register task intent handlers in server mode. This is the deferred work from Phase C2 (bootstrap.ts purity note, lines 35-43; main.ts buildServerState comment, lines 87-91). Additionally, wire the Ask first-response-wins logic (D4h) so the standalone server can perform §6.4 ask semantics. **D4 now runs before D3** (see decision note above): D3 verifies cross-compat against the now-capable standalone server.

**See §3 for the full 20-file decoupling detail.**

**Files to modify (20 backend files + 2 wiring files + 2 D4h files):**

The 20 files are listed in §3.1. The decoupling strategy per file is in §3.2. Additionally:

1. `backend/startup/bootstrap.ts` (lines 1-79):
    - Remove the purity note (lines 35-43)
    - Add `createBackendRootStore({ globalStoragePath: capabilities.hostContext.storageDir })` after `connector.start()`
    - Add `setupIntentBus(bridge, telemetryService)` after `createBackendRootStore()`
    - The `setupIntentBus` call needs a `telemetryService` — in server mode, create a no-op or file-backed telemetry service (the current `setupIntentBus` in `intents.ts` uses `vscode.version` and `vscode.env.language` — these need to be replaced with capability-derived values, see §3.2 file 19)
2. `connectors/web/backend/main.ts` (lines 1-119):
    - Update `buildServerState()` to return the full MST root-store snapshot (via `getBackendRootStore().getSnapshot()`) instead of the capability-derived state
    - Remove the NOTE comment (lines 87-91)

**D4h — Ask first-response-wins wiring (pure Node, no new capability slots):**

The askResponse handler (`register-on-messages-intents.ts:24`) currently calls `getBackendRootStore()` and returns early in server mode. It does NOT use `AskClaimTracker`. The `AskClaimTracker` (`backend/features/foundation/webview/ask-claims.ts:19-45`) is pure, transport-level, and is referenced only in `eventBridge.test.ts` (lines 143, 180) — no production code calls `tracker.claim()`. D4h wires it into the askResponse handler so the standalone server performs §6.4 first-response-wins.

3. `backend/features/foundation/webview/ask-claims.ts`:
    - Add a module-level `AskClaimTracker` instance (exported as `askClaimTracker`) for use by the askResponse handler.
4. `backend/features/chat/task/messages/events/handlers/register-on-messages-intents.ts`:
    - Modify the askResponse handler (line 24) to use the module-level `askClaimTracker` instance:
        - On `askResponse` receipt: call `askClaimTracker.claim(requestId, decision)`.
        - If `status === "claimed"`: create the `ask.response.received` intent (as before) + broadcast the converged result to all clients via `provider.postMessageToWebview(frame)` (no target = broadcast).
        - If `status === "already-answered"`: send `askResponseAck` with `status: "already-answered"` to the late responder (targeted to `senderClientId`).
    - The handler still calls `getBackendRootStore()` for the intent creation (works in both modes after D4). The `AskClaimTracker` claim + broadcast is pure Node (no root store needed for the claim itself).

**Citations:**

- [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md:627) §7.1 startBackend sketch (lines 627-643)
- [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md:687) §8.3 criterion C-2 (lines 687-695)
- [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md:610) §6.4 first-response-wins (lines 610-621)
- [`backend/startup/bootstrap.ts`](../backend/startup/bootstrap.ts:35) purity note (lines 35-43)
- [`connectors/web/backend/main.ts`](../connectors/web/backend/main.ts:87) buildServerState NOTE (lines 87-91)
- [`backend/extension-activation/modules/core/intents.ts`](../backend/extension-activation/modules/core/intents.ts:19) setupIntentBus (lines 19-65)
- [`backend/features/foundation/webview/ask-claims.ts`](../backend/features/foundation/webview/ask-claims.ts:19) AskClaimTracker (lines 19-45)
- [`backend/features/chat/task/messages/events/handlers/register-on-messages-intents.ts`](../backend/features/chat/task/messages/events/handlers/register-on-messages-intents.ts:24) askResponse handler (line 24)

**Acceptance gates:**

- G1: `pnpm check-all` — 0 errors
- G2: `pnpm build --force` — **server bundle builds WITHOUT vscode external** (criterion C-2 automatic proof); extension bundle still builds with vscode external
- G3: **Server runtime proof:** `pnpm start:server` → `curl /healthz` OK → WS hello→state returns full MST root-store snapshot → send newTask via WS → streamChunk frames received → task completes. Extension mode regression: `pnpm build --force` → extension activates, chat works
- G4: **D4h ask proof:** two WS clients both respond to the same ask; the server claims the FIRST response, sends `askResponseAck` with `status: "already-answered"` to the late responder, and broadcasts the converged result to both clients.
- G5: Stage all modified files by literal path

**Dependencies:** D2 (BrowserWsFrontendConnector exists, so both transports are available).

---

### D3 — Cross-Compat Verification (G2)

**Goal:** Create a unified smoke script that sends event constants through both transports (vscode webview + web WS) and compares created intents in backend IntentStore + frontend store snapshots. Verify ask broadcast → first-response-wins (§6.4) with two WS clients simultaneously. **D3 now runs after D4** (see decision note above): the standalone server now hosts the MST root store + intent bus + all handlers + AskClaimTracker wiring (D4h), so all four categories are provable against the real standalone bundle.

**Files to create:**

1. `tests/cross-compat-smoke.mjs` — Node.js script (not UI), same pattern as `connectors/web/backend/acceptance/context-two-client.mjs` (self-contained spawner of `node backend/dist/server.js`, polls `/healthz`, kills child by explicit PID):
    - Spawns `node backend/dist/server.js --port <PORT> --data-dir <tmp> --workspace <tmp>` (loopback, §7.2)
    - Connects two WS clients (A + B) to `ws://127.0.0.1:<PORT>/ws`; both complete hello→state
    - **Category 1 — Context-command identity:** both clients send `context.search.requested`, `context.recall.requested`, `context.describe.requested`; compare response shapes (byte-equal for the same query, per ICG-C2 C3 parity)
    - **Category 2 — Task-command identity:** both clients send `newTask`, `cancel`, `resume`, `sendMessage`; prove identity via **wire-frame parity** — for the same inbound intent, both clients receive byte-identical outbound frames (streamChunk, task events, acks). The backend IntentStore is not directly inspectable from the standalone bundle (no devtool MCP, no store endpoint), so wire-frame parity IS the deterministic protocol-level interchangeability proof (success criterion line 936). Frontend store snapshots are compared via the hello→state payload both clients receive
    - **Category 3 — First-response-wins (§6.4):** client A sends an ask (notification.ask broadcast to both); both A and B respond to the same ask; the server claims the FIRST response, sends `askResponseAck` with `status: "already-answered"` to the late responder, and broadcasts the converged result to both clients (all UIs converge)
    - **Category 4 — Broadcast convergence (§6.3):** a notification broadcasts to BOTH clients; both reach the same converged state
    - Outputs results as a phase artifact (JSON or markdown)

**Files to modify:** None.

**Citations:**

- [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md:934) Phase D D3 row (line 934)
- [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md:598) §6.3 multi-client ask semantics (lines 598-609)
- [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md:610) §6.4 first-response-wins (lines 610-621)
- [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md:936) Phase D success criterion (line 936)
- [`connectors/web/backend/acceptance/context-two-client.mjs`](../connectors/web/backend/acceptance/context-two-client.mjs) existing two-client `.mjs` pattern (self-contained spawner)

**Acceptance gates:**

- G1: `pnpm check-all` — 0 errors
- G2: `pnpm build --force` — server starts
- G3: **Smoke script passes:** run `node tests/cross-compat-smoke.mjs`; all four categories pass: context-command identity (byte-equal responses), task-command identity (byte-identical outbound frames in both transports = wire-frame parity), first-response-wins (first response claimed, late response gets `ack already-answered`, converged result broadcast to both), broadcast convergence (notification reaches both clients, both converge)
- G4: Stage `tests/cross-compat-smoke.mjs` by literal path; results are phase artifact

**Dependencies:** D4 (server hosts root store + intent bus + all handlers + AskClaimTracker wiring, so all four categories are provable against the real standalone bundle).

---

### D5 — ICG-D1 Display Layer (Virtualized Timeline + Deep-Linking + Progressive Hydration)

**Goal:** Implement the ICG-D1 display layer: viewport buffer store, range-request action creators via `IConnectorEventBus`, virtualized timeline rows with rollup chips + thinking sub-panels, jump controls, deep-link fragment resolution, and `buildEnrichedState` additive `contextWindowMeta`.

**See §4 for the full ICG-D1 detail.**

**Files to create:**

1. `frontend/src/features/context/store.ts` — viewport buffer store (MST model):
    - `expandedRanges: Array<{ taskId: string; seqStart: number; seqEnd: number }>` — which ranges are hydrated
    - `viewport: { seqStart: number; seqEnd: number }` — current viewport
    - `expandedNodes: Set<string>` — which nodes are expanded (thinking blocks, etc.)
    - Actions: `requestRange(taskId, seqStart, seqEnd)`, `expandNode(nodeId)`, `collapseNode(nodeId)`, `jumpTo(position: "beginning" | "middle" | "end")`
2. `frontend/src/features/context/actions.ts` — range-request action creators:
    - `requestHistoryRange(taskId, seqStart, seqEnd)` — publishes `context.history.range` via `getConnectorBus().publish(...)` (G2/G3: via bus only, zero postMessage)
    - `expandThinkingBlock(nodeId)` — publishes a range request for the thinking block's seq range
3. `frontend/src/features/context/components/Timeline.tsx` — virtualized timeline component:
    - Renders rows for the current viewport
    - Each row: message content + rollup metadata chips (token count, compression status) + thinking sub-panels (collapsible)
    - Jump controls: beginning / middle / end buttons
    - Deep-link: on mount, parse `window.location.hash` for `#task=<id>&seq=N[&node=...]` and scroll to that position
4. `frontend/src/features/context/components/TimelineRow.tsx` — single timeline row
5. `frontend/src/features/context/components/ThinkingPanel.tsx` — collapsible thinking block sub-panel
6. `frontend/src/features/context/components/JumpControls.tsx` — beginning/middle/end jump buttons

**Files to modify:**

1. `backend/features/foundation/window-manager/store/state-utils.ts` (line 21):
    - Add `contextWindowMeta` field group to `buildEnrichedState` (additive, one enrichment branch)
    - The field group contains: per-task archive metadata (task count, total tokens, compression status, seq range)
2. `frontend/src/bootstrap.tsx`:
    - Wire the context feature store into the MST bridge (register `ContextViewportStore`)
3. `frontend/src/app-shell/App.tsx` or `app-content.tsx`:
    - Add the Timeline component to the app shell (conditionally rendered when in "watch" mode or when context history is available)

**Citations:**

- [`plans/architecture-infinite-context-graph-storage.md`](architecture-infinite-context-graph-storage.md:386) ICG-D1 spec (lines 386-393)
- [`plans/architecture-infinite-context-graph-storage.md`](architecture-infinite-context-graph-storage.md:265) §7.1 virtualized timeline architecture (lines 265-291)
- [`plans/architecture-infinite-context-graph-storage.md`](architecture-infinite-context-graph-storage.md:292) §7.2 display-layer protocol messages (lines 292-299)
- [`plans/architecture-infinite-context-graph-storage.md`](architecture-infinite-context-graph-storage.md:300) §7.3 progressive hydration (lines 300-313)
- [`plans/architecture-infinite-context-graph-storage.md`](architecture-infinite-context-graph-storage.md:314) §7.4 deep-linking (lines 314-320)
- [`plans/architecture-infinite-context-graph-storage.md`](architecture-infinite-context-graph-storage.md:321) §7.5 UX sketch (lines 321-332)
- [`packages/types/src/protocol/context.ts`](../packages/types/src/protocol/context.ts:125) HistoryRangeRequest (lines 125-135)
- [`packages/types/src/protocol/context.ts`](../packages/types/src/protocol/context.ts:138) HistoryChunk (lines 138-154)

**Acceptance gates:**

- G1: `pnpm check-all` — 0 errors
- G2: `pnpm build --force` — both connectors build
- G3: **Full 3-layer on BOTH connectors:**
    - DebugMCP: check backend variables in range handler
    - Devtool `get_store_state`: viewport buffer + expanded set
    - Devtool `find_element`: DOM rows at beginning/middle/end anchors
    - Deep link `#task=<id>&seq=N` lands on correct row after hydration AND after reconnect (re-fetch idempotent)
    - Expanding a 45k-token thinking block renders chunked WITHOUT blocking input (timestamp check: new user message rendered during expansion with no head-of-line delay)
    - `clientKind:"watch"` hello path works end-to-end per v4 §6.2
    - Perf-check on 10k-node fixture timeline render
- G4: Stage all new + modified files by literal path

**Dependencies:** D4 (server hosts root store, so `contextWindowMeta` is available in the hello→state handshake).

---

### D6 — Phase D Finalization

**Goal:** Commit "phase D" + push, with ABSORB/staging discipline.

**Steps:**

1. `pnpm check-all` — 0 errors (lint + check-types + test)
2. `pnpm build --force` — full rebuild
3. Stage ALL Phase D files by **literal path** (no `git add .`):
    - All files from D0-D5 (listed in each chunk's "Files to create/modify")
    - `reports/audit-platform.json` (updated baseline)
    - `plans/phase-d-implementation-plan.md` (this file)
    - `plans/phase-d-class-b-allowlist.md` (D0)
4. **Exclude drift ×3:** `.rpg/graph.json`, `.serena/memories/debug/debug-workflow-protocol.md`, `md-todo-mcp`
5. **Exclude untracked ×6:** `.jabberwock-data/`, `.roo/skills/run-extension/`, `.serena/memories/phase-a-staging-state.md`, `DebugMCP/`, `loseless-context/`, `packages/devtool/src/api/debug-mcp-bridge.mjs`
6. `git commit -m "phase D"` — husky hooks run natively (NO `--no-verify`)
7. `git push`

**Citations:**

- [`AGENTS.md`](../AGENTS.md) verification rules (check-all before completion)
- [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md:936) Phase D success criterion (line 936)

**Acceptance gates:**

- G1: `pnpm check-all` — 0 errors
- G2: `pnpm build --force` — success
- G3: `git status` shows only Phase D files staged; drift ×3 + untracked ×6 excluded
- G4: Commit "phase D" pushed; husky hooks passed

**Dependencies:** D5 (all Phase D work complete).

---

## 3. Server-Mode Task-Handler Deferral (D4 Detail)

### 3.1 The 20 Files (re-verified this session via esbuild metafile probe)

The plan said "21 files" (bootstrap.ts line 38). This session's esbuild metafile probe from `backend/features/backendroot/store.ts` (vscode marked external, `write: false`) found **20 files** in the root-store import graph that import `vscode`. The discrepancy is likely due to code changes between the plan's writing and HEAD `cb6fa63e5`.

| #   | File                                                                | vscode usage (line refs)                                                                                                                                                                                                                                                                 | Category             |
| --- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 1   | `backend/api/providers/utils/timeout-config.ts`                     | `vscode.workspace.getConfiguration(Package.name).get<number>("apiRequestTimeout", 600)` (line 12)                                                                                                                                                                                        | Config access        |
| 2   | `backend/features/foundation/window-manager/store/html-utils.ts`    | `vscode.Webview` (line 15), `vscode.Uri.file` (line 18), `vscode.ExtensionMode.Development` (line 25)                                                                                                                                                                                    | Webview-specific     |
| 3   | `backend/features/foundation/window-manager/store/messaging.ts`     | `vscode.commands.executeCommand("workbench.action.reloadWindow")` (line 122)                                                                                                                                                                                                             | Host command         |
| 4   | `backend/features/foundation/window-manager/store/webview-setup.ts` | `vscode.WebviewView`/`WebviewPanel` (lines 20,43,98,161), `vscode.Webview` (lines 61,72,112), `vscode.Uri.file` (line 65), `vscode.ExtensionMode.Development` (line 113), `vscode.window.onDidChangeActiveTextEditor` (line 167), `vscode.workspace.onDidChangeConfiguration` (line 190) | Webview-specific     |
| 5   | `backend/features/settings/actions/importSettings.ts`               | `vscode.window.showOpenDialog` (line 93)                                                                                                                                                                                                                                                 | UI dialog            |
| 6   | `backend/integrations/openai-codex/oauth.ts`                        | `import type { ExtensionContext } from "vscode"` (line 2)                                                                                                                                                                                                                                | Type-only            |
| 7   | `backend/integrations/openai-codex/oauthTokenManager.ts`            | `import type { ExtensionContext } from "vscode"` (line 1)                                                                                                                                                                                                                                | Type-only            |
| 8   | `backend/integrations/theme/getTheme.ts`                            | `vscode.extensions.all` (lines 36-37), `vscode.ColorThemeKind` (lines 78,80,82), `vscode.workspace.getConfiguration` (line 86), `vscode.Uri` (lines 160-161)                                                                                                                             | Config + extensions  |
| 9   | `backend/integrations/workspace/WorkspaceTracker.ts`                | `vscode.Disposable` (line 15), `vscode.workspace.createFileSystemWatcher` (line 45), `vscode.window.tabGroups` (lines 67,80), `vscode.TabInputText` (lines 83,87), `vscode.workspace.fs.stat` (line 161), `vscode.FileType` (line 162)                                                   | Workspace/file       |
| 10  | `backend/services/glob/list-files-ripgrep.ts`                       | `vscode.env.appRoot` (line 11)                                                                                                                                                                                                                                                           | App root             |
| 11  | `backend/services/ripgrep/ripgrep/ripgrep.ts`                       | `vscode.env.appRoot` (line 95)                                                                                                                                                                                                                                                           | App root             |
| 12  | `backend/services/search/file-search.ts`                            | `vscode.env.appRoot` (line 21), `vscode.workspace.getConfiguration` (lines 93,120)                                                                                                                                                                                                       | App root + config    |
| 13  | `backend/shared/vsCodeSelectorUtils.ts`                             | `import { LanguageModelChatSelector } from "vscode"` (line 1)                                                                                                                                                                                                                            | Type-only            |
| 14  | `backend/utils/io/export.ts`                                        | `vscode.Uri` (lines 34,41,46,51,55), `vscode.workspace.workspaceFolders` (line 44)                                                                                                                                                                                                       | URI + workspace      |
| 15  | `backend/utils/io/storage.ts`                                       | `vscode.workspace.getConfiguration` (lines 20,97,132), `vscode.window` (lines 48,90,104,145,155), `vscode.ConfigurationTarget` (line 133)                                                                                                                                                | Config + UI          |
| 16  | `backend/utils/logger/outputChannelLogger.ts`                       | `vscode.OutputChannel` (line 9)                                                                                                                                                                                                                                                          | Logger               |
| 17  | `backend/utils/settings/autoImportSettings.ts`                      | `vscode.OutputChannel` (line 18), `vscode.workspace.getConfiguration` (line 23), `vscode.window.showInformationMessage` (line 50), `vscode.window.showWarningMessage` (line 57)                                                                                                          | Logger + config + UI |
| 18  | `backend/utils/settings/migrateSettings.ts`                         | `vscode.ExtensionContext` (lines 17,125), `vscode.OutputChannel` (lines 18,72,126)                                                                                                                                                                                                       | Context + logger     |
| 19  | `backend/utils/ui/focusPanel.ts`                                    | `vscode.WebviewPanel` (line 12), `vscode.WebviewView` (line 13), `vscode.commands.executeCommand` (lines 19,25), `vscode.ViewColumn` (line 22)                                                                                                                                           | UI + host command    |
| 20  | `backend/utils/ui/getUri.ts`                                        | `import { Uri, Webview } from "vscode"` (line 1)                                                                                                                                                                                                                                         | Type-only            |

> **Amendment (D4g, 2026-09-04, [`plans/d4g-decision-c2-purity.md`](d4g-decision-c2-purity.md) §3.3):** the original 20-file list was incomplete. An esbuild metafile probe of the root-store graph (entry `backend/features/backendroot/store.ts`, vscode external) on the D4a–D4f-staged tree found **7 additional** vscode-importing files that were never in this list. The list is now **27 files** (rows 21–27 below). These are the actual residual blocker for wiring `createBackendRootStore()` into `startBackend()` (sub-chunk D4g-pre).

| #   | File                                                                      | vscode usage                                                                                                                                                                   | Category                                                                                                                                                      |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 21  | `packages/telemetry/src/PostHogTelemetryClient.ts`                        | `import * as vscode from "vscode"` (line 2) — `vscode.env.machineId` (line 27, distinctId) + `vscode.workspace.getConfiguration("telemetry").get("telemetryLevel")` (line 157) | Host-context injection: new `IHostContext.machineId` + `IHostContext.getTelemetryLevel` slots (see [`plans/d4g-pre-chunk-spec.md`](d4g-pre-chunk-spec.md) §3) |
| 22  | `connectors/vscode/backend/model-providers/vscode-lm/vscode-lm-format.ts` | vscode-lm message transform                                                                                                                                                    | **Provider-registry seam** (§3.6)                                                                                                                             |
| 23  | `connectors/vscode/backend/model-providers/vscode-lm/tools.ts`            | `getVsCodeLmModels`                                                                                                                                                            | **Provider-registry seam** (§3.6)                                                                                                                             |
| 24  | `connectors/vscode/backend/model-providers/vscode-lm/stream.ts`           | vscode-lm streaming                                                                                                                                                            | **Provider-registry seam** (§3.6)                                                                                                                             |
| 25  | `connectors/vscode/backend/model-providers/vscode-lm/token-count.ts`      | vscode-lm token counting                                                                                                                                                       | **Provider-registry seam** (§3.6)                                                                                                                             |
| 26  | `connectors/vscode/backend/model-providers/vscode-lm/handler.ts`          | `VsCodeLmHandler`                                                                                                                                                              | **Provider-registry seam** (§3.6)                                                                                                                             |
| 27  | `packages/cloud/src/importVscode.ts`                                      | `require("vscode")` + `await import("vscode")` (both esbuild-resolved)                                                                                                         | Module-holder pattern: `setVscodeModule` at activation (see [`plans/d4g-pre-chunk-spec.md`](d4g-pre-chunk-spec.md) §4)                                        |

### 3.2 Decoupling Strategy Per File

**Strategy A — Type-only import replacement (4 files: #6, #7, #13, #20):**

- Replace `import type { ExtensionContext } from "vscode"` with a local structural type: `interface IExtensionContextLike { globalState: IMementoLike; secrets: ISecretStore; globalStorageUri: { fsPath: string } }` (or reuse `IHostContext` from `backend-connector.ts`)
- Replace `import { LanguageModelChatSelector } from "vscode"` with a local type definition
- Replace `import { Uri, Webview } from "vscode"` with local type definitions or `string`/`unknown`
- **No capability slot needed** — these are compile-time only

**Strategy B — Configuration access via capability slot (5 files: #1, #8, #12, #15, #17):**

- Introduce an `IConfiguration` capability slot in `BackendCapabilities` (or use the existing `hashmapMemory` + `hostContext.env`):
    ```typescript
    interface IConfiguration {
    	get<T>(section: string, key: string, defaultValue?: T): T
    	update(section: string, key: string, value: unknown): Promise<void>
    }
    ```
- In vscode mode: `vscode.workspace.getConfiguration(section).get(key, default)`
- In server mode: read from `hashmapMemory` (file-backed JSON under `--data-dir`) or `hostContext.env`
- Files #1, #12, #15, #17: replace `vscode.workspace.getConfiguration(...)` with `capabilities.config.get(...)`
- File #8 (`getTheme.ts`): also uses `vscode.extensions.all` — this is vscode-specific. In server mode, theme detection is a no-op (return default dark theme). Gate behind a capability: `hostContext.themeKind?: "light" | "dark" | "highContrast"`

**Strategy C — UI dialog via capability slot (3 files: #5, #15, #17):**

- Introduce an `IUiDialogs` capability slot:
    ```typescript
    interface IUiDialogs {
    	showOpenDialog(options?: Record<string, unknown>): Promise<string[] | undefined>
    	showInputBox(options?: Record<string, unknown>): Promise<string | undefined>
    	showInformationMessage(message: string): void
    	showWarningMessage(message: string): void
    }
    ```
- In vscode mode: delegate to `vscode.window.*`
- In server mode: no-op (log a warning) or file-based fallback
- Files #5, #15, #17: replace `vscode.window.show*` with `capabilities.uiDialogs.show*`

**Strategy D — Webview-specific code move to vscode connector (4 files: #2, #3, #4, #19):**

- These files are inherently vscode-webview-specific. They should NOT be in the shared `backend/` code.
- **Option 1 (preferred):** Move them to `connectors/vscode/backend/` and import from the vscode connector only. The shared backend code references them via the `IBackendConnector` interface or a capability slot.
- **Option 2:** Keep them in `backend/` but gate all vscode imports behind a runtime check: `if (typeof vscode !== "undefined") { ... }`. This is fragile and not recommended.
- File #2 (`html-utils.ts`): move to `connectors/vscode/backend/html-utils.ts`
- File #3 (`messaging.ts`): the `vscode.commands.executeCommand("workbench.action.reloadWindow")` call → use `hostContext.hostCommands.reloadWindow()` (already exists in `IHostContext`, line 146 of `backend-connector.ts`)
- File #4 (`webview-setup.ts`): move to `connectors/vscode/backend/webview-setup.ts`
- File #19 (`focusPanel.ts`): move to `connectors/vscode/backend/focusPanel.ts`; the `vscode.commands.executeCommand` calls → use `hostContext.hostCommands` or a new `hostContext.focusPanel?()` slot

**Strategy E — Workspace/file access via capability slots (5 files: #9, #10, #11, #12, #14):**

- File #9 (`WorkspaceTracker.ts`): replace `vscode.workspace.createFileSystemWatcher` with `capabilities.fileWatchers.watch(...)` (already exists in `BackendCapabilities`, line 187 of `backend-connector.ts`). Replace `vscode.window.tabGroups` with a no-op in server mode (tab groups are a vscode UI concept). Replace `vscode.workspace.fs.stat` with `node:fs` `stat`.
- Files #10, #11 (`list-files-ripgrep.ts`, `ripgrep.ts`): replace `vscode.env.appRoot` with a new capability slot `hostContext.appRoot?: string` (in server mode, this is the `node_modules` path or a bundled ripgrep binary path)
- File #12 (`file-search.ts`): replace `vscode.env.appRoot` with `hostContext.appRoot`; replace `vscode.workspace.getConfiguration` with `capabilities.config.get`
- File #14 (`export.ts`): replace `vscode.Uri.file(...)` with plain `string` paths; replace `vscode.workspace.workspaceFolders` with `hostContext.workspaceFolders` (already exists, line 161 of `backend-connector.ts`)

**Strategy F — Logger via capability slot (3 files: #16, #17, #18):**

- File #16 (`outputChannelLogger.ts`): replace `vscode.OutputChannel` parameter with `BackendCapabilities["logger"]` (already exists, lines 189-192 of `backend-connector.ts`). The function `createOutputChannelLogger(outputChannel: vscode.OutputChannel)` → `createCapabilityLogger(logger: BackendCapabilities["logger"])`
- File #17 (`autoImportSettings.ts`): replace `vscode.OutputChannel` with `BackendCapabilities["logger"]`; replace `vscode.window.show*` with `capabilities.uiDialogs.show*`
- File #18 (`migrateSettings.ts`): replace `vscode.ExtensionContext` with `IHostContext`; replace `vscode.OutputChannel` with `BackendCapabilities["logger"]`

**Strategy G — setupIntentBus vscode usage (1 file: `backend/extension-activation/modules/core/intents.ts`):**

- Line 1: `import * as vscode from "vscode"` — used only for `vscode.version` (line 54) and `vscode.env.language` (line 58) in the telemetry service
- Replace with: `hostContext.extensionVersion` (already exists, line 151 of `backend-connector.ts`) and `hostContext.env?.LANG` or a new `hostContext.language?: string` slot
- The `setupIntentBus` function signature needs to accept `BackendCapabilities` (or `IHostContext`) so it can read these values without importing `vscode`

### 3.3 Capability Slots to Introduce

Add to `BackendCapabilities` in [`packages/types/src/protocol/backend-connector.ts`](../packages/types/src/protocol/backend-connector.ts:183):

```typescript
export interface BackendCapabilities {
	// ... existing slots ...
	config?: IConfiguration // NEW: configuration access
	uiDialogs?: IUiDialogs // NEW: UI dialog access
	appRoot?: string // NEW: application root path (for ripgrep binary)
}
```

Add to `IHostContext` in [`packages/types/src/protocol/backend-connector.ts`](../packages/types/src/protocol/backend-connector.ts:140):

```typescript
export interface IHostContext {
	// ... existing fields ...
	language?: string // NEW: host language (replaces vscode.env.language)
	themeKind?: "light" | "dark" | "highContrast" // NEW: theme kind (replaces vscode.workspace.getConfiguration("workbench").get("colorTheme"))
}
```

### 3.4 Final Wiring

After all 20 files are decoupled:

1. `backend/startup/bootstrap.ts`: add `createBackendRootStore()` + `setupIntentBus()` calls (full §7.1 sketch)
2. `connectors/web/backend/main.ts`: update `buildServerState()` to return full MST snapshot
3. `connectors/vscode/backend/activation/extension.ts`: remove the now-redundant `createBackendRootStore()` + `setupIntentBus()` calls (they're now in `startBackend()`)
4. Verify: `pnpm build --force` → server bundle builds WITHOUT vscode external (C-2); extension bundle still builds with vscode external

### 3.5 The 85-File Handler-Registration Graph (D4g-2, added 2026-09-04)

**Amendment (D4g, 2026-09-04, [`plans/d4g-decision-c2-purity.md`](d4g-decision-c2-purity.md) §3.4):** `setupIntentBus` (intents.ts) statically imports all 9 `register*Intents` groups. An esbuild metafile probe (entry = each group's `events/handlers/index.ts`, vscode external) on the D4a–D4f-staged tree found that **every group transitively imports vscode**:

| Group          | register function                    | vscode-importing files (Probe C) |
| -------------- | ------------------------------------ | -------------------------------- |
| task           | `registerOnTaskIntents`              | 58                               |
| messages       | `registerOnMessagesIntents`          | 62                               |
| notifications  | `registerOnNotificationsIntents`     | 22                               |
| settings       | `registerOnSettingsIntents`          | 47                               |
| window-manager | `registerOnWindowManagerIntents`     | 58                               |
| context        | `registerOnContextManagementIntents` | 3                                |
| cloud          | `registerOnCloudIntents`             | 9                                |
| history        | `registerOnHistoryIntents`           | 10                               |
| marketplace    | `registerOnMarketplaceIntents`       | 8                                |

Union (entry = `intents.ts`, Probe D): **85 files** (pre-PART 1). **Re-verified post-PART 1 (2026-09-04):** the union is now **83 files** (the 2-file delta = `intents.ts` entry + `migrateSettings.ts`, both cleared by PART 1). The vscode coupling is in the deep handler _implementation_ files (e.g. `on-history.ts`, `on-cloud.ts`, `on-settings-*.ts`), not the thin `register*Intents` functions. There is likely overlap with the 27 root-store files (e.g. settings/window-manager handlers appear in both) — D4g-2's step 0 is a probe to compute the exact _new-work_ set = (83 handler-graph files) − (already-cleared root-store files), so the true D4g-2 scope is ≤ 83. Sub-batched by group (see [`plans/d4g-decision-c2-purity.md`](d4g-decision-c2-purity.md) §4.3).

### 3.6 vscode-lm Provider-Registry Seam (D4g-pre, added 2026-09-04)

**Amendment (D4g, 2026-09-04, [`plans/d4g-decision-c2-purity.md`](d4g-decision-c2-purity.md) §2.4/§4.2):** the vscode-lm ×5 coupling (rows 22–27) is a **layering violation**, not a simple import: shared `backend/` code statically imports the vscode connector — `backend/api/providers/index.ts:21` (`export { VsCodeLmHandler }`), `backend/api/handler.ts:134` (`"vscode-lm": VsCodeLmHandler` in the static `providerHandlerMap`), `backend/api/transform/format/index.ts:6` (`vscodeLmTransform` re-export — **dead code**, no consumer), `backend/features/settings/handlers/settings/on-settings-models.ts:6` (`getVsCodeLmModels`). Because `providerHandlerMap` is a static `Record`, esbuild bundles the entire vscode-lm module into the server graph regardless of any runtime gate.

**The fix:** the shared backend owns a _mutable_ provider registry (`registerProvider(name, ctor)` + `getProvider(name)`); `buildApiHandler` looks up the registry first, then falls back to the static map (which no longer contains `vscode-lm`). The vscode connector registers `vscode-lm` at activation; the server registers nothing (vscode-lm is simply unavailable in server mode — correct, it is a host-specific provider). The `vscodeLmTransform` re-export is **dead code** (no consumer — the actual `convertToVsCodeLmMessages` is consumed only inside the vscode connector's `handler.ts:142` via a relative import) and is simply **deleted**. `getVsCodeLmModels` is NOT automatically decoupled by the registry (it is a function, not a handler ctor) — it needs a separate capability slot in D4g-2. See [`plans/d4g-pre-chunk-spec.md`](d4g-pre-chunk-spec.md) §2 for the full seam design.

---

## 4. ICG-D1 Display Layer (D5 Detail)

### 4.1 Viewport Buffer Store

New MST model in `frontend/src/features/context/store.ts`:

```typescript
const ContextViewportModel = types
	.model("ContextViewport", {
		taskId: types.optional(types.string, ""),
		viewport: types.model({
			seqStart: types.number,
			seqEnd: types.number,
		}),
		expandedRanges: types.array(
			types.model("ExpandedRange", {
				taskId: types.string,
				seqStart: types.number,
				seqEnd: types.number,
			}),
		),
		expandedNodes: types.optional(types.map(types.string), {}), // nodeId -> true
		boundaryMeta: types.optional(
			types.model({
				totalSeq: types.number,
				compressedRanges: types.array(
					types.model({ seqStart: types.number, seqEnd: types.number, rollupTokenCount: types.number }),
				),
			}),
			() => ({ totalSeq: 0, compressedRanges: [] }),
		),
	})
	.actions((self) => ({
		requestRange(seqStart: number, seqEnd: number) {
			// Publish context.history.range via getConnectorBus().publish(...)
			// On response, add to expandedRanges
		},
		expandNode(nodeId: string) {
			self.expandedNodes.set(nodeId, true)
			// Publish range request for the node's seq range
		},
		collapseNode(nodeId: string) {
			self.expandedNodes.delete(nodeId)
		},
		jumpTo(position: "beginning" | "middle" | "end") {
			// Compute seqStart/seqEnd from boundaryMeta
			// Set viewport, request range
		},
	}))
```

### 4.2 Range-Request Action Creators

In `frontend/src/features/context/actions.ts`:

```typescript
export function requestHistoryRange(taskId: string, seqStart: number, seqEnd: number): void {
	getConnectorBus().publish({
		type: "context.history.range",
		taskId,
		seqStart,
		seqEnd,
	} satisfies WebviewMessage)
}
```

The backend handler (already implemented in ICG-C2) responds with `context.history.chunk` frames (streaming exception path — bypasses IntentBus/MST, delivered via injected bus per §8.3 C-4).

### 4.3 Virtualized Timeline

`Timeline.tsx` uses a virtualization library (e.g., `react-window` or `@tanstack/react-virtual`) to render only the visible rows. Each row:

- Message content (text, tool calls, etc.)
- Rollup metadata chips: token count, compression status (compressed/expanded), seq range
- Thinking sub-panels: collapsible, rendered via `ThinkingPanel.tsx`

Jump controls (`JumpControls.tsx`): three buttons (beginning / middle / end) that call `store.jumpTo(position)`.

### 4.4 Deep-Linking

On mount, `Timeline.tsx` parses `window.location.hash`:

- Format: `#task=<id>&seq=N[&node=...]`
- If `task` matches the current task: scroll to `seq=N`, expand `node` if present
- If `task` differs: switch to that task, then scroll
- After hydration (reconnect): re-resolve the deep link (re-fetch is idempotent)

### 4.5 Progressive Hydration

`buildEnrichedState` in `backend/features/foundation/window-manager/store/state-utils.ts` adds a `contextWindowMeta` field group:

```typescript
contextWindowMeta: {
	tasks: Array<{
		taskId: string
		totalSeq: number
		totalTokens: number
		compressedRanges: Array<{ seqStart: number; seqEnd: number; rollupTokenCount: number }>
	}>
}
```

This is **bounded by design** (§7.3 lines 300-313): only metadata, no content. Heavy pages arrive via explicit `context.history.range` fetches.

### 4.6 Chunk Subscription

The `context.history.chunk` frames arrive via the bus streaming-exception path (same as `streamChunk`). The viewport store subscribes:

```typescript
getConnectorBus().subscribe(
	{ types: ["context.history.chunk", "context.history.completed", "context.history.cancelled"] },
	(msg) => {
		// Update expandedRanges, append chunks to the timeline
	},
)
```

---

## 5. Cross-Compat / Event Bus (G7) — D1-D3 Detail

### 5.1 Frontend Event Bus Injection

The `IConnectorEventBus` contract (already in `packages/types/src/protocol/frontend-connector.ts` lines 85-99) is the single abstraction. The app-level frontend code NEVER sees the raw transport — it only calls `bus.publish(msg)` and `bus.subscribe(filter, handler)`.

**Key property (§4.5 line 460):** one physical channel, one subscription point. In vscode webview, both host messages and DOM-local messages arrive as DOM `MessageEvent` on `window`. The `VscodeWebviewFrontendConnector` holds exactly ONE `window.addEventListener("message", ...)` and routes to subscribers by filter.

In `BrowserWsFrontendConnector`, WS frames carry ONLY host protocol. DOM-local messages are handled by in-process loopback inside the bus implementation — they do NOT go over the wire (§4.5 line 463).

### 5.2 VscodeWebviewFrontendConnector

`connectors/vscode/frontend/connector.ts`:

- Wraps the existing `vscode` wrapper from `@jabberwock/devtool/webview`
- `publish(msg)` → `vscode.postMessage(msg)`
- `subscribe(filter, handler)` → registers in an internal subscriber list; the single `window.addEventListener("message", ...)` dispatches to matching subscribers
- The host-vs-DOM-local classification (existing early-return logic from `handleExtensionMessage`) moves into the bus router

### 5.3 BrowserWsFrontendConnector

`connectors/web/frontend/connector.ts`:

- Opens WebSocket to `ws://host:port/ws`
- Hello → state handshake (§6.2)
- `publish(msg)` → wraps in `ConnectorEnvelope` and sends as WS frame
- `subscribe(filter, handler)` → registers; WS `onmessage` dispatches to matching subscribers
- DOM-local messages: in-process loopback (not over the wire)
- Reconnect with exponential backoff
- On reconnect: re-request state

### 5.4 Cross-Compat Smoke Script

`tests/cross-compat-smoke.mjs` (runs AFTER D4, per the 2026-09-03 reorder decision; same self-contained-spawner pattern as `connectors/web/backend/acceptance/context-two-client.mjs`):

- Spawns `node backend/dist/server.js` (loopback, `--data-dir /tmp`), polls `/healthz`, kills child by PID
- Connects two WS clients (A + B); both complete hello→state
- Category 1 — context-command identity: search/recall/describe from both clients, byte-equal response shapes
- Category 2 — task-command identity: newTask/cancel/resume/sendMessage from both clients, byte-identical outbound frames (wire-frame parity) + identical hello→state payloads
- Category 3 — first-response-wins (§6.4): both clients respond to the same ask; first response claimed, late response gets `askResponseAck` with `status: "already-answered"`, converged result broadcast to both
- Category 4 — broadcast convergence (§6.3): a notification broadcasts to BOTH clients; both reach the same converged state
- Outputs results as phase artifact

---

## 6. Phase D Finalization (D6 Detail)

### 6.1 Staging Discipline

**Stage by literal path only** (no `git add .`):

```bash
git add plans/phase-d-implementation-plan.md
git add plans/phase-d-class-b-allowlist.md
git add connectors/vscode/frontend/connector.ts
git add connectors/vscode/frontend/index.ts
git add connectors/web/frontend/connector.ts
git add connectors/web/frontend/index.ts
git add frontend/src/connector-bus/index.ts
git add frontend/src/bootstrap.tsx
git add frontend/src/app-shell/App.tsx
git add frontend/src/features/root-store/store.ts
# ... all 15 class A files from D1c ...
git add frontend/vite.config.ts
git add tests/cross-compat-smoke.mjs
# ... all 20 backend files from D4 ...
git add backend/startup/bootstrap.ts
git add connectors/web/backend/main.ts
git add backend/extension-activation/modules/core/intents.ts
# D4h ask first-response-wins wiring (2 files)
git add backend/features/foundation/webview/ask-claims.ts
git add backend/features/chat/task/messages/events/handlers/register-on-messages-intents.ts
# ... all ICG-D1 files from D5 ...
git add frontend/src/features/context/store.ts
git add frontend/src/features/context/actions.ts
git add frontend/src/features/context/components/Timeline.tsx
git add frontend/src/features/context/components/TimelineRow.tsx
git add frontend/src/features/context/components/ThinkingPanel.tsx
git add frontend/src/features/context/components/JumpControls.tsx
git add backend/features/foundation/window-manager/store/state-utils.ts
git add packages/types/src/protocol/backend-connector.ts
git add reports/audit-platform.json
```

**Exclude drift ×3:**

```bash
# Do NOT stage:
# .rpg/graph.json
# .serena/memories/debug/debug-workflow-protocol.md
# md-todo-mcp
```

**Exclude untracked ×6:**

```bash
# Do NOT stage:
# .jabberwock-data/
# .roo/skills/run-extension/
# .serena/memories/phase-a-staging-state.md
# DebugMCP/
# loseless-context/
# packages/devtool/src/api/debug-mcp-bridge.mjs
```

### 6.2 Commit + Push

```bash
pnpm check-all          # 0 errors
pnpm build --force      # full rebuild
git commit -m "phase D" # husky hooks run natively (NO --no-verify)
git push
```

---

## 7. Risk Register

| #   | Chunk  | Risk                                                                                                                                                                                                                            | Likelihood | Impact   | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | D1c    | Missing a class A call site → C-3 violation in audit:platform                                                                                                                                                                   | Medium     | High     | Run `pnpm audit:platform` after each file migration; the audit script is the source of truth, not the file list                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| R2  | D1c    | `createDomMessageHandler` (class B utility) accidentally migrated to bus → DOM-local traffic goes over WS in browser mode                                                                                                       | Low        | High     | `createDomMessageHandler` is imported from `@jabberwock/devtool/webview` — it's a DOM-local utility. Keep it as-is; only the `postMessage` callback it receives changes from `vscode.postMessage` to `bus.publish`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| R3  | D2     | WS reconnect loop in browser mode → state desync                                                                                                                                                                                | Medium     | Medium   | Exponential backoff with max retry; on reconnect, re-request state (`requestState`); idempotent state merge in `mergeExtensionState`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| R4  | D2     | DOM-local messages leak over WS in browser mode → protocol pollution                                                                                                                                                            | Low        | High     | In-process loopback in `BrowserWsFrontendConnector` bus implementation; DOM-local messages NEVER call `ws.send()`. Unit test: publish a DOM-local message, assert `ws.send` was NOT called                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| R5  | D3     | Two WS clients race on ask → non-deterministic winner                                                                                                                                                                           | Low        | Medium   | First-response-wins is server-side (§6.4): the server records the first response and broadcasts the decision. **Corrected (2026-09-03):** the claim "server logic is already implemented in Phase C" was true ONLY at the `AskClaimTracker` primitive + unit-test level (`eventBridge.test.ts:143,180`); NO production code called `tracker.claim()` on `askResponse`. The production wiring now lands in **D4h** (before D3, per the reorder). D3's smoke script verifies the wired behavior against the real standalone bundle                                                                                                                                                                                                                                                                                                                                                                                                            |
| R6  | D4     | Decoupling a file introduces a behavioral change in extension mode → regression                                                                                                                                                 | Medium     | High     | Each file migration is followed by `pnpm check-all` + `pnpm build --force` + extension regression smoke (devtool 3 layers). The 20 files are migrated in small batches (4-5 files per sub-dispatch) to isolate regressions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| R7  | D4     | `setupIntentBus` in server mode registers handlers that depend on vscode-specific services (cloud, devtool, agents) → crash                                                                                                     | Medium     | High     | **Corrected (D4g, 2026-09-04, [`plans/d4g-decision-c2-purity.md`](d4g-decision-c2-purity.md) §3.1):** Probe C disproves the original assumption — **all 9** `register*Intents` groups transitively import `vscode` (task 58, messages 62, notifications 22, settings 47, window-manager 58, context 3, cloud 9, history 10, marketplace 8; union = 85 files). The vscode coupling is in the deep handler _implementation_ files (e.g. `on-history.ts`, `on-cloud.ts`, `on-settings-*.ts`), not the thin `register*Intents` functions. A runtime capability gate is INSUFFICIENT for C-2 — the static imports are bundled regardless. The mitigation is BUILD-TIME decoupling (move vscode-importing handler code to the vscode connector, or replace vscode imports with capability slots / the provider-registry seam), applied per the §3.2 strategies A–G. `setupIntentBus` can only run in server mode after D4g-2 clears all 85 files. |
| R8  | D4     | Moving webview-specific files (#2, #4, #19) to `connectors/vscode/backend/` breaks the extension build (import paths)                                                                                                           | Medium     | Medium   | Update all import paths in the vscode connector. The extension build (`backend/esbuild.mjs`) uses `tsconfig: backend/tsconfig.json` which has `@connectors/*` → `../connectors/*` path alias (line 43 of `backend/tsconfig.json`), so imports from `connectors/vscode/backend/` resolve correctly                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| R9  | D5     | Virtualized timeline with 10k nodes → render performance degradation                                                                                                                                                            | Medium     | Medium   | Use `@tanstack/react-virtual` (or `react-window`) with `overscan` tuning. The ICG-D1 acceptance criteria include a perf-check on 10k-node fixture (line 392). If perf is insufficient, add a `maxVisibleRows` cap                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| R10 | D5     | Deep-link resolution after reconnect → stale seq range                                                                                                                                                                          | Low        | Medium   | Re-fetch is idempotent: on reconnect, re-resolve the deep link by re-requesting the range. The `context.history.range` handler is idempotent (returns the same data for the same seq range)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| R11 | D5     | `contextWindowMeta` in hello→state exceeds bounded size → handshake timeout                                                                                                                                                     | Low        | Medium   | §7.3 (lines 300-313) explicitly bounds the metadata: per-task archive metadata only (task count, total tokens, compression status, seq range). No content. The `getContextWindowMeta()` function (already in `@features/context`) returns this bounded metadata                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| R12 | D4     | C-2 regression: server bundle accidentally includes vscode after decoupling                                                                                                                                                     | Low        | Critical | The esbuild server bundle (`backend/esbuild.mjs` lines 116-162) has NO external "vscode" — if any transitive import reaches "vscode", esbuild fails with an unresolved-module error. This is the automatic C-2 proof. Run `pnpm build --force` after each sub-batch of file migrations                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| R13 | D6     | Staging drift ×3 or untracked ×6 → commit contains unrelated changes                                                                                                                                                            | Low        | Medium   | Stage by literal path only (no `git add .`). Verify with `git status` before commit. The drift ×3 and untracked ×6 are listed in §6.1 for explicit exclusion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| R14 | D1a    | `VscodeWebviewFrontendConnector` single window listener conflicts with existing listeners in `@jabberwock/devtool/webview`                                                                                                      | Low        | Medium   | The `@jabberwock/devtool/webview` package's `vscode` wrapper does NOT add a window listener — it only wraps `acquireVsCodeApi().postMessage`. The window listeners are in `App.tsx` and `bootstrap.tsx` (migrated in D1a/D1b). After migration, the ONLY window listener is inside `VscodeWebviewFrontendConnector`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| R15 | D4     | `WorkspaceTracker.ts` uses `vscode.window.tabGroups` which has no server-mode equivalent                                                                                                                                        | Medium     | Low      | Tab groups are a vscode UI concept. In server mode, the tab-group tracking is a no-op (the workspace tracker still tracks file changes via `fileWatchers`, but tab-group state is not available). Gate the tab-group code behind a capability check                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| R16 | D4h/D3 | D4h ask wiring (module-level `AskClaimTracker` + broadcast in the `askResponse` handler) conflicts with D4's full handler registration, or the D3 smoke script asserts behavior the standalone bundle does not actually perform | Low        | High     | D4h is the ONLY place the `askResponse` handler is modified; D4's `setupIntentBus` registration reuses the same handler (no second askResponse registration — `onWebviewMessage` warns on overwrite, so a duplicate would be visible in logs). D4h gate G4 proves the wired behavior at runtime BEFORE D3 runs; D3's smoke script re-proves it against the real bundle. If D4h G4 fails, D3 is not dispatched (dependency gate)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

---

## 8. Open Questions

1. **D4 sub-batching:** Should the 20 backend files be migrated in one Code-mode dispatch or split into 4-5 sub-dispatches (by strategy: A/B/C/D/E/F/G)? Recommendation: split into 4 sub-dispatches (type-only + config + UI + webview/workspace) to isolate regressions. Each sub-dispatch has its own `pnpm check-all` + `pnpm build --force` gate.

2. **D5 virtualization library:** Which library to use for the virtualized timeline? Options: `@tanstack/react-virtual` (already a dependency via `@tanstack/react-query`), `react-window`, or a custom implementation. Recommendation: `@tanstack/react-virtual` (consistent with existing TanStack usage).

3. **D5 deep-link format:** The ICG-D1 spec says `#task=<id>&seq=N[&node=...]`. Should the deep link also support `#task=<id>&range=<start>-<end>` for range-based deep links? Recommendation: keep the spec's format; range-based deep links can be added in a follow-up.

4. **D4 `setupIntentBus` in server mode:** Which of the 9 intent handler groups should be registered in server mode? **Corrected (D4g, 2026-09-04, [`plans/d4g-decision-c2-purity.md`](d4g-decision-c2-purity.md) §3.2):** register all 9 in BOTH modes (per §7.1 sketch + §4.1 one-code-path principle), but ONLY after D4g-2 build-time-decouples all 85 handler-graph files. The groups are NOT pure today (Probe C: all 9 import vscode, 3–62 files each). Do not rely on runtime capability gating for C-2 — static imports are bundled regardless of the gate.

5. **D2 devtool bridge over WS:** The plan says "Devtool bridge over WS (§7.4, off by default)." Should the devtool bridge be implemented in D2 or deferred to a follow-up? Recommendation: implement a minimal devtool bridge in D2 (store state + console logs over WS) so that the 3-layer verification (backend vars → store state → DOM) works in browser mode. The full devtool bridge (DOM inspection, element finding) can be a follow-up.

---

## Appendix: Execution Order Summary

```
D0  Class B allowlist freeze (no code)
 │
D1a Frontend connector scaffolding + event bus singleton
 │
D1b Migrate App.tsx + root store to bus
 │
D1c Migrate 15 remaining class A files to bus
 │
D2  BrowserWsFrontendConnector + vite proxy + streaming
 │
D4  Server-mode task-handler deferral (20 backend files)  [REORDERED: now before D3]
 │   ├── D4a Type-only import replacements (4 files)
 │   ├── D4b Config access capability slot (5 files)
 │   ├── D4c UI dialog capability slot (3 files)
 │   ├── D4d Webview-specific code move (4 files)
 │   ├── D4e Workspace/file access capability slots (5 files)
 │   ├── D4f Logger capability slot (3 files)
 │   └── D4g Wire startBackend() + setupIntentBus() (2 files)
  │   └── D4h Ask first-response-wins wiring (2 files: ask-claims.ts + register-on-messages-intents.ts)
  │
D3  Cross-compat verification (G2)  [REORDERED: now after D4; verifies all 4 categories against the real standalone bundle]
 │
D5  ICG-D1 display layer
 │   ├── D5a Viewport buffer store + range-request actions
 │   ├── D5b Virtualized timeline + jump controls
 │   ├── D5c Deep-link fragment resolution
 │   └── D5d buildEnrichedState additive contextWindowMeta
 │
D6  Phase D finalization (commit + push)
```

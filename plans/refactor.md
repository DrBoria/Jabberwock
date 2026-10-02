# Refactor Findings Log — Phase D (running)

> Running log of all findings during the Phase D vscode-debt decoupling (D4a–D4g-2).
> Categories: **[A]** Duplication · **[B]** Architecture glitch · **[C]** Deviation from v2/v3 plan (v4 correction noted) · **[D]** Item for later analysis.
> Reference plans: `plans/architectural-restructure-v2.md` (4-entity model, fiber IntentBus, naming conventions), `plans/architecture-restructure-v3-plan.md` (ESLint rules, code reorganization), `plans/architecture-v4-connector-abstraction.md` (connector/host-adapter abstraction — the governing architecture).
> Appended per chunk. Newest at the bottom.

## D4a–D4f (type-only, capability slots, webview move, workspace/file, logger)

- **[B]** `backend/api/handler.ts:134` — static `providerHandlerMap` names `VsCodeLmHandler` (a vscode-connector provider). The shared backend statically imports a vscode-connector provider = layering violation. esbuild bundles it regardless of any runtime gate. → Fixed in D4g-pre with the provider-registry seam.
- **[A]** `vscodeLmTransform` — dead code; only 2 barrel re-exports reference it (`transform/format/index.ts:6`, `transform/index.ts:9`). The real `convertToVsCodeLmMessages` is consumed only inside the vscode connector's `handler.ts:142` via a relative import. → Deleted in D4g-pre.
- **[D]** `backend/extension-activation/modules/core/core.ts` — in the shared `backend/` tree but vscode-connector-only (not in the root-store or server graph — verified by probe). It imports vscode. Latent layering smell. → Follow-up cleanup (move to the vscode connector, or accept as a vscode-activation-only file).
- **[C]** v2 rule #4 "zero module-level mutable state" — the provider registry (D4g-pre, `backend/api/providers/registry.ts`) is module-level mutable state (a `Map`). Necessary for the provider-registry seam. v4 correction: the registry is the composition root's provider table, not feature state — acceptable.
- **[B]** `messaging.ts` (window-manager) — the plan (D4d) said to move it to the vscode connector, but it has real shared-backend consumers (`syncer.ts`, `mode-utils.ts`). Moving it whole would create a backwards dependency (shared backend → vscode connector). → In-place seam instead (`hostContext.hostCommands.reloadWindow()`).
- **[D]** `connector.ts` (vscode connector) — stale comment claims backend aliases don't resolve from the connector, but they do (`esbuild.mjs` passes `tsconfig: backend/tsconfig.json` for the whole bundle). Misleading comment, no build impact.
- **[D]** `refreshWorkspace` (messaging.ts) — zero production callers (only barrel re-exports). Candidate for deletion.
- **[C]** v2 "all files PascalCase except handlers" — the codebase has many kebab-case files (`start-new-task.ts`, `register-on-task-intents.ts`, etc.). v4 correction: kebab-case is the de-facto convention for handler/registration files.
- **[B]** CRLF hazard — Serena `replace_content` normalizes CRLF files to LF. Hit 6+ times across D4. → Use byte-exact Python for CRLF files.

## D4g PART 1 + D4g-pre (final decoupling + provider registry)

- **[B]** The plan's 20-file vscode-debt list was INCOMPLETE. The root-store graph had 8 vscode-importing files, 7 of them never in the list: `PostHogTelemetryClient.ts`, `vscode-lm/{handler,stream,token-count,tools,vscode-lm-format}.ts` (5), `importVscode.ts`. → Discovered via esbuild metafile probe. Fixed in D4g-pre.
- **[B]** All 9 handler groups are vscode-coupled (the plan's R7 "pure groups" assumption is disproven). The handler graph has 85 files (83 post-PART 1). → D4g-2 sub-batches.
- **[C]** v3 "no dynamic imports" — `importVscode.ts` used `require("vscode")` + `await import("vscode")`. → Replaced with a module-holder (`setVscodeModule`/`importVscode`) in D4g-pre.
- **[D]** `PostHogTelemetryClient.ts` — uses `vscode.env.machineId` (line 27) + `vscode.workspace.getConfiguration("telemetry").get("telemetryLevel")` (line 157). → Host-context injection (`IHostContext.machineId` + `IHostContext.getTelemetryLevel`) in D4g-pre.

## D4g-2 batch 1 (context + cloud + history + marketplace)

- **[B]** The context group was NOT pre-clean (the plan assumed pure Node per ICG-C2). It carried 2 devtool-bridge factory files (`factory.ts`, `factory-state.ts`). → Decoupled via the provider-adapter pattern (`executeCommand`/`getExtensionVersion` on `DevtoolBridgeProvider`).
- **[D]** The plan's file-count estimates were upper bounds. Actual probe counts were lower (context 2, cloud 1, history 2, marketplace 0 = 5 total, not ~30).

## D4g-2 batch 2 (notifications)

- **[B]** The notifications group scope was 12, not the estimated 22. The 12 = 6 backend files + 6 editor-group files. The 6 editor-group files dropped out of the graph when the `DiffViewProvider` import was removed from `checkpoints.helpers.ts` (the diff view is now opened via the `hostCommands.showCheckpointDiff` slot).
- **[B]** `IUiDialogs.showWarningMessage` needed a `buttons?` parameter (the original D4c slot lacked it). → Extended in batch 2.
- **[D]** `hostCommands.showCheckpointDiff` — a new host-specific command slot (the `vscode.changes` multi-file diff command + `Uri.file`/`Uri.parse` + base64 query encoding). Cannot be expressed via IUiDialogs/IFileWatcherFactory.
- **[D]** `toHostPattern()` — the vscode file-watcher factory needed a `RelativePattern` conversion (the pre-batch-2 `watchers.ts` used `RelativePattern` directly).

## D4g-2 batch 3 (settings)

- **[B]** The settings group had 2 registration entry points (`registerAllSettingsHandlers` + `registerOnSettingsIntents`), not 1. → Both probed + decoupled.
- **[B]** `on-settings-models.ts` `getVsCodeLmModels` is a function, not a handler ctor. The provider-registry (D4g-pre) does NOT auto-decouple it. → The `getModels(provider)` capability slot (batch 3).
- **[B]** esbuild rejects overload signatures in object literals. The `IConfiguration.get` overload attempt was reverted. → Fixed the affected call site with `?? false`.
- **[B]** CRLF hazard — Serena `replace_content` normalized 16 CRLF files to LF. Restored via byte-exact Python.
- **[D]** `IHostDiagnostic` — a new structural type (batch 3).

## D4g-2 batch 4 (task) — COMPLETE

- **[B]** The task group's single `openClineInNewTab` import in `start-new-task.ts` pulled **11 vscode-connector files** into the shared backend task graph (the connector's webview-connector + its transitive deps) — the largest single-import layering violation in the task group. → Fixed with the `openInNewTab` capability slot (`BackendCapabilities.openInNewTab?: () => PromiseLike<INewTabProvider>`), backed by the real `openClineInNewTab` in the vscode connector and absent in server mode. Dropping this import removed all 11 connector files from the task graph.
- **[B]** The 10 editor/terminal/theme files were vscode-coupled and lived in the shared `backend/integrations/` tree. → Moved to `connectors/vscode/backend/integrations/{editor,theme,terminal}/` (git mv) + 3 narrow service seams so the shared task graph reaches them through capability slots instead of direct imports.
- **[D]** The 3 service seams (exact surface, `packages/types/src/protocol/backend-connector.ts`):
    - `IHostThemeService` — `getTheme(): Promise<Record<string, unknown> | undefined>` (vscode: `getTheme` reads `vscode.extensions.all`; server: absent → no theme).
    - `IHostEditorService` — `createDiffViewProvider(cwd): IDiffViewProvider` (vscode: `DiffViewProvider` factory; server: no-op, see below).
    - `IHostTerminalService` — `getOrCreateTerminal` / `getTerminals` / `getBackgroundTerminals` / `getUnretrievedOutput` / `releaseTerminalsForTask` / `compressTerminalOutput` / `showTerminal` (vscode: `TerminalRegistry` + static `Terminal.compressTerminalOutput`; server: absent → execa fallback + empty condense section).
    - Registered as optional slots (`hostThemeService?` / `hostEditorService?` / `hostTerminalService?`) + registry accessors (`getHostThemeService()` / `getHostEditorService()` / `getHostTerminalService()`).
- **[B]** The dead instance left batch 4 **partially done**: 6 files already moved + staged (editor 5 + theme 1), 4 clean files + importers modified (unstaged), but the 4 terminal files NOT moved, no service seams, no `openInNewTab` slot, no `plans/refactor.md`, no gates. → Completed: moved the 4 terminal files, created the 3 seams + `openInNewTab` slot + accessors, wired the vscode backing, rewired the call sites, created `plans/refactor.md`, ran the gates.
- **[B]** esbuild could not resolve the moved files' npm deps (`diff`, `strip-bom`, `p-wait-for`, `monaco-vscode-textmate-theme-converter`) from the connector's new location — they were declared in `backend/package.json`, not `connectors/vscode/package.json`, and `backend/node_modules` is not on the connector's ancestor path. → Added the 4 deps to `connectors/vscode/package.json` (the connector now owns these files) + `pnpm install`.
- **[B]** `Terminal.ts` (moved to the connector) imports `p-wait-for`, a `backend` dependency. The backend's `tsc` pulled the connector's `Terminal.ts` into its graph via `core.ts` → `TerminalRegistry` → `Terminal.ts` and could not resolve `p-wait-for` from the connector's location. → Moved `TerminalRegistry.initialize()` from `core.ts` (shared backend) to `extension.ts` (vscode connector) — a vscode-connector concern — removing the backend→connector import that dragged `Terminal.ts` into the backend tsc graph.
- **[B]** CRLF hazard — Serena `replace_content` normalized `mergePromise.ts` + `ExecaTerminal.ts` (CRLF) to LF. Restored via byte-exact Python.
- **[D]** The web backing's `hostEditorService` is a **no-op** (present), not absent as the spec assumed. The spec assumed the task graph uses optional chaining, but the file-edit tools call `getDiffViewProvider()` directly (which throws when `diffViewProvider` is undefined). Without the no-op, server-mode file edits would crash. The other 3 slots (`hostThemeService` / `hostTerminalService` / `openInNewTab`) are correctly absent in server mode.
- **[D]** The G3 esbuild metafile probe's naive regex (`from "vscode"`) false-positives on `import type { ... } from "vscode"` (type-only, erased) and comments. The authoritative check is the metafile import graph (real value imports only) + the C-2 grep on the built `dist/server.js`.
- **Final probe counts (G3):** `register-on-task-intents.ts` 0 (was 23), `register-on-messages-intents.ts` 0 (was 25), `register-all-message-handlers.ts` 0 (was 25). C-2 on fresh `dist/server.js`: 0 platform imports, 13 plain "vscode" substrings (all `packages/types` data).

## D4g-2 batch 6 (window-manager) — COMPLETE (LAST D4g-2 sub-batch)

- **[B]** Final residual-cleanup probe (esbuild metafile, entry = `backend/extension-activation/modules/core/intents.ts`, `vscode` external, `write: false`, `metafile: true`, `loader: { ".css": "empty" }`): **4082 files in the server/handler-registration graph, exactly 2 vscode-importing** — `on-focus-panel-requested.ts` + `export-markdown.ts`. The other 8 of the 10 residual candidates are **OUT-OF-GRAPH** (vscode-connector-only, no C-1 impact): `EditorUtils.ts`, `networkProxy.state.ts`, `networkProxy.config.ts`, `networkProxy.ts`, `code-index/interfaces/manager.ts`, `code-index/interfaces/file-processor.ts`, `marketplace/installation-operations.ts`, `settings/actions/runMigrations.ts`. Cross-check: entry = `connectors/web/backend/main.ts` (the actual server bundle) → 209 files, 0 vscode-importing (`setupIntentBus` not wired yet — that is deferred PART 2).
- **[B]** `on-focus-panel-requested.ts` (window-manager, batch 6 core) called `vscode.commands.executeCommand(getCommand("focusPanel"))` directly. → Rewired to the existing `hostCommands.executeCommand` slot (batch 3): `getHostContext()?.hostCommands?.executeCommand?.(getCommand("focusPanel"))`. The vscode connector already backs this slot (`vscode.commands.executeCommand`), so focusPanel still works in vscode mode; in server mode the slot is absent → no-op.
- **[B]** `export-markdown.ts` (residual) used `vscode.window.showSaveDialog` + `vscode.workspace.fs.writeFile` + `vscode.window.showTextDocument`. → Rewired to the existing `uiDialogs.showSaveDialog` slot (batch 1) + node `fs/promises` + the existing `hostCommands.openFileInEditor` slot (batch 3): `getUiDialogs().showSaveDialog({ filters, defaultUri })` → `await fs.writeFile(saveUri.fsPath, markdownContent, "utf-8")` → `getHostContext()?.hostCommands?.openFileInEditor?.(saveUri.fsPath, { preview: true })`. Return type `vscode.Uri | undefined` → `IUri | undefined` (callers `on-task-export.ts` / `on-task-export-current.ts` already pass the result to `saveLastExportPath`, which takes `IUri` — no caller change).
- **[D]** **No new capability slots were declared.** All required slots already existed from earlier batches and were already backed by the vscode connector (`connectors/vscode/backend/activation/extension.ts`): `hostCommands.executeCommand` (batch 3), `hostCommands.openFileInEditor` (batch 3), `uiDialogs.showSaveDialog` (batch 1), `IUri`. The web connector (`connectors/web/backend/capabilities.ts`) already provides a no-op `showSaveDialog` (returns `undefined` headless) and omits `hostCommands` (absent → no-op). This batch was pure call-site rewiring following the established patterns.
- **[B]** CRLF hazard — both target files are CRLF. Edited via byte-exact Python (Serena `replace_content` would normalize CRLF→LF). CRLF counts preserved (13 / 124).
- **Final probe counts (G3):** `intents.ts` graph → **0** vscode-importing files (was 2). `connectors/web/backend/main.ts` → 0. C-2 on fresh `dist/server.js`: 0 platform imports.

## v2/v3 Architecture Compliance Violations (recorded 2026-09-07 — to be fixed later)

> Recorded for LATER remediation. These findings are intentionally NOT part of the current v4 Phase D work — they are logged here so they can be addressed in a dedicated pass.

### v2 structural violations (4-entity model / naming / whitelist rule)

1. `backend/features/events.ts` — v2 rule #15 violation: "no `events.ts` files anywhere; events always in `events/actions/` + `events/handlers/`". This is a top-level `features/` barrel re-exporting per-feature event constants + `registerOn*Intents`.
2. `backend/features/hist/` — naming deviation: v2 target structure names this feature `history/`; `hist` is an unapproved abbreviation.
3. `backend/features/chat/chatStore.types.ts` — split-types file at feature root; v2 convention is a single `types.ts`. (`.types` is not in v3's forbidden-suffix list, so ESLint-clean, but a v2 naming deviation.)

### v3 code-reorg (B1–B10) — OPEN items

- **B6 (NOT DONE)** — Remove Zod from `@jabberwock/types`: ~30 files in `packages/types/src/**` still `import ... from "zod"` (e.g. `payload-schemas.ts`, `settings/provider/schemas.ts`, `models/model.ts`, `messages/types.ts`, `events/types.ts`, `mcp/mcp.ts`, `vscode/types.ts`). Target: MST `types.refinement()`/`types.custom()`/type guards; drop `zod` from `packages/types/package.json`.
- **B7 (NOT DONE)** — `backend/extension-activation/modules/core/api.ts:2` imports `EventEmitter` from `"events"`; line 106 `new EventEmitter<JabberwockAPIEvents>()` — module-level non-MST emitter, violates v2 rules #2/#11/#15. Target: migrate into an MST store (`features/api/store.ts` + `events/actions/`), then delete the emitter.
- **B3 (PARTIAL)** — `backend/features/chat/actions/chatStore.actions.ts` + `chatStore.views.ts` exist in `actions/` (lint-clean per v3 ESLint rule 3 `allowedPaths`), but B3's intent (DELETE + merge into `store.ts`) is not met.
- **B9 (PARTIAL)** — providers subfolders created, but the open decision "remove dynamic-provider hardcoded models, keep only static" is unresolved.
- **B10 (UNVERIFIED)** — duplicate type declarations not exhaustively traced; flagged as a follow-up.

### v3 code-reorg — DONE (for the record, no action)

- B1 (reorganize `packages/types/src`) — mostly done (19 subdirs + 3 root files; `providers/` split into subfolders).
- B2 (move `app-*` files) — done (replaced by `frontend/src/app-shell/`).
- B4 (move `messages-model.ts`) — done (no `messages-model.ts` in `backend/`).
- B5 (remove `deprecated-types.ts`) — done.
- B8 (fix dynamic imports) — done (no runtime `import()` in `backend/**`; `extension-activation` restructured into `modules/core/` + `modules/services/`).

## Phase D State Audit (orchestrator re-check, 2026-09-08)

> The prior chat was dropped mid-Phase-D. This section records the ACTUAL on-disk state re-verified against the code (not just prior chat memory), so the next session can continue from verified ground truth. **Everything below is UNCOMMITTED** (working tree on `mega-refactoring`, HEAD `cb6fa63e5` "phase C"; ~171 staged + unstaged files + 4 in-scope untracked).

### Verified complete (present on disk)

- **D0** — `plans/phase-d-class-b-allowlist.md` FROZEN, 34 class B entries, gate checked. ✅
- **D1a** — `connectors/vscode/frontend/connector.ts` (`VscodeWebviewFrontendConnector`, single `window.addEventListener("message")` listener) + `frontend/src/connector-bus/{index.ts,connector-bus.ts}` (`initConnectorBus`/`getConnectorBus` singleton, `FrontendEnv`). ✅
- **D1b** — `frontend/src/app-shell/App.tsx` (`getConnectorBus`) + `frontend/src/features/root-store/store.ts` (`postMsg = (msg) => getConnectorBus().publish(msg)`). ✅
- **D1c** — class A migration is WIDE: `getConnectorBus().publish` present in 21 files (chat/task, chat/notifications, cloud, history, marketplace, settings, foundation/window-manager, dndTextArea, topic, tree, `register.ts` action creators, etc.). Only residual `@jabberwock/devtool/webview` importers left in `frontend/src/**`: `app-content.tsx` (LocatorBridge/source-maps), `App.tsx` (createDomMessageHandler — class B), `bootstrap.tsx` (createWebviewStoreBridge/console — class B), `connector-bus.ts` (vscode wrapper — allowed seam), `message-area.tsx` (DiagnosticDashboard — class B), `ErrorBoundary.tsx` (enhanceErrorWithSourceMaps — class B). All residuals map to class B or the bootstrap/connector-bus seam → C-3 looks satisfied, but NOT yet proven by `pnpm audit:platform`. ⚠️ pending verification.
- **D2** — `connectors/web/frontend/{connector.ts,event-bus.ts,socket.ts,index.ts,connector.test.ts}` present + vite `/ws` proxy at `frontend/vite.config.ts:230-236`. ✅
- **D4g PART 2** — `backend/startup/bootstrap.ts` `startBackend()` now calls `createBackendRootStore({globalStoragePath})` + `await setupIntentBus(bridge, telemetryService)` (the "deferred PART 2" note is resolved). `setupIntentBus` lives in NEW untracked `backend/startup/intents.ts`. `connectors/web/backend/main.ts` hands `getBackendRootSnapshot` (from `@features/storeSingleton`) to `WebWsServer` for the hello→state handshake; the capability-derived `buildServerState()` NOTE is gone. New untracked `connectors/web/backend/store-singleton.d.ts` declares the narrow `getBackendRootStore(): { getSnapshot(): unknown }`. ✅

### Verified NOT done (the actual remaining work)

- **D4h — Ask first-response-wins wiring: NOT DONE.** `register-on-messages-intents.ts` `askResponse` handler (line ~24) still just calls `getBackendRootStore()` + `store.intentStore.createIntent({type:"ask.response.received"})`. It does NOT import/call a module-level `askClaimTracker`, and there is NO `askResponseAck {status:"already-answered"}` + broadcast-to-all-clients logic anywhere in the handler graph (grep `askClaimTracker|already-answered` in `backend/features/chat/task/messages/events/handlers/**` = 0). `AskClaimTracker` (`backend/features/foundation/webview/ask-claims.ts:20`) is still referenced ONLY in `eventBridge.test.ts`. **This is the first slice to implement.**
- **D3 — `tests/cross-compat-smoke.mjs`: NOT CREATED** (file absent).
- **D5 — `frontend/src/features/context/`: NOT CREATED** (whole ICG-D1 display layer absent).
- **D6 — finalization/commit: NOT DONE.**

### Note on "D4g-2 batch 5"

The plan (`d4g-decision-c2-purity.md:126`) sub-batches D4g-2 as (a) small groups, (b) notifications, (c) settings, (d) task, (e) messages, (f) window-manager. `refactor.md` logs batches 1,2,3,4,6 as complete and marks batch 6 (window-manager) as "LAST D4g-2 sub-batch". **Batch 5 (messages group, 62 files) has no explicit completion entry** — but the batch-6 final probe (`intents.ts` graph → 0 vscode-importing files) covers the whole union including the messages group, so messages was cleared as part of the residual sweep. Treated as complete; the D4g-2 work is fully closed per the batch-6 G3 probe.

### Remaining slices (execution order)

1. **D4h** — module-level `askClaimTracker` in `ask-claims.ts` + wire claim/ack/broadcast into the `askResponse` handler in `register-on-messages-intents.ts`. (coder → then debugger gate G4: two clients, first-wins + late ack + broadcast.)
2. **D3** — `tests/cross-compat-smoke.mjs` (4 categories).
3. **D5** — ICG-D1 display layer (viewport store, actions, Timeline/Row/ThinkingPanel/JumpControls, `contextWindowMeta` in `buildEnrichedState`, bootstrap + app-shell wiring).
4. **D6** — `pnpm check-all` → `pnpm build --force` → stage by literal path (exclude drift ×3 + untracked ×6) → commit "phase D" (husky native) → push.
5. **(later, separate pass)** v2/v3 remediation per the section above.

### Immediate next action

Delegated verification of D1a–D2 + D4g-P2 to `@debugger` (check-all → build --force + C-2 grep → server hello→state runtime → extension 3-layer → browser best-effort). Verification must PASS before D4h is implemented. Two subagent dispatch attempts from this orchestrator session returned no result — run the brief in a dedicated `@debugger` session.

---

## D4h + D3 execution record (2026-09-08, in-context — delegation proven impossible, orchestrator gated itself)

### Gates (verification performed before D4h implementation)

- **G1 `pnpm check-all`** — PASS (lint 17/17, check-types 19/19, test 3/3).
- **G2 `pnpm build --force` + C-2** — PASS. Server bundle builds with **0 real `vscode` imports** (only benign data substrings: `"vscode-lm"`, `settings.models.vscode.lm.request`, `node_modules/@vscode/ripgrep/…`, `.vscode/…`). Extension bundle unaffected.
- **G3 server runtime hello→state** — PASS (after the bug below). `/healthz` ok; WS `hello {clientKind}` → single `state` frame (`_hydration:true`) carrying the assigned `clientId`; full MST root-store snapshot present.
- **G4 extension 3-layer (devtool + DebugMCP + UI)** — **SKIPPED** (user cancelled `start_debugging`; user directive "работай, переключай сам"). Server-side interchangeability is fully proven instead by the D3 two-client artifact (C2/C3/C4), which exercises the exact WS path the extension shares.

### [B] Real server-mode crash found + fixed (installBackendState)

**Root cause:** production `connectors/web/backend/main.ts` never called `installBackendState()`. Only extension activation and the C3 hermetic gate test install the backend-state slots. In server mode, any path that calls `postStateToWebview`/`buildEnrichedState` (i.e. the hello→state handshake that reads host paths) threw **"Backend state not initialized"**.

**Fix:** `connectors/web/backend/main.ts` now calls `installBackendState({ hashmapMemory, extensionRootPath: config.dataDir, globalStoragePath: config.dataDir, isDevelopmentMode: true })` right after `setBackendCapabilities(...)`. Both host paths are the `--data-dir` (the server has no separate globalStorage/extensionRoot); `isDevelopmentMode:true` is a deliberate server-mode default (no packaged extension). This is a genuine bug, not a test-only shim.

### [C] tsconfig isolation — new declaration + folder-structure lint fix

- `@features/foundation/host-context/context` was imported by the new `installBackendState` call, which broke the connector's isolated `tsc --noEmit` (TS2307). Resolved with the **established local-declaration pattern**: new `connectors/web/backend/declarations/host-context-context.d.ts` (`BackendStateSlots` + `installBackendState`) + a `connectors/web/tsconfig.json` `paths` entry. Runtime/server bundle still resolves the specifier to the real impl via `backend/tsconfig.json` — one code path at runtime.
- **Lint regression** `local/no-complex-folder-structure` ("Folder 'backend' has 8 files (max 7)") — the new `.d.ts` pushed `backend/` to 8 files. **Fix:** moved all four isolation declarations (`capabilities-registry.d.ts`, `features-context.d.ts`, `host-context-context.d.ts`, `store-singleton.d.ts`) into `connectors/web/backend/declarations/` and repointed the four `tsconfig.json` `paths` entries. `backend/` is now 4 files; check-all green.

### D4h — Ask first-response-wins (§6.4) — DONE + proven

- `backend/features/foundation/webview/ask-claims.ts`: module-level `export const askClaimTracker = new AskClaimTracker<AskResponseValue>()` + `AskResponseValue` type import.
- `register-on-messages-intents.ts` `askResponse` handler now takes `senderClientId`. When the answer carries `requestId` **and** a concrete `decision`: `claim(requestId, decision)` → if `"already-answered"` send **targeted** `askResponseAck {status:"already-answered"}` to the late `senderClientId` and return; on `"claimed"` **broadcast** `notification.ask.resolved {requestId, askResponse: decision, text}` to all clients. The existing `ask.response.received` intent creation runs **only** for the first response (late duplicates return before it). The claim path is gated on `requestId && decision !== undefined`, so the legacy single-client ask (no requestId) is byte-for-byte unchanged.

**G4 runtime proof** (two WS clients, `requestId`-keyed) — see D3 C3/C4 below.

### D3 — `tests/cross-compat-smoke.mjs` — DONE, 6/6 PASS

Self-contained spawner of `node backend/dist/server.js` (fixed loopback port, `/healthz` poll, explicit-PID kill). Seeds `<data-dir>/tasks/task-smoke/api_conversation_history.json` (5 messages, unique marker `SMOKEQ9`) so C1 is a non-trivial, non-empty parity check. Node 20 has no global WebSocket → `ws` loaded via `createRequire` from `backend/node_modules/ws`.

| Cat | Check                                                                                                                                                                                           | Result                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| C1  | `context.search/recall/describe` — **body** byte-equal for the same query (targeted responses differ by per-send `sentAt`, so compare the body, not the envelope)                               | PASS (search results=2, recall items=1, describe nodeId set) |
| C2  | task-command **wire-frame parity** — one `askResponse` (single responder) → the broadcast `notification.ask.resolved` is byte-equal on A and B (envelope serialized once, fanned out)           | PASS                                                         |
| C3  | **first-response-wins** — A(yes) first → claimed + broadcast; B(no) late → targeted `askResponseAck {status:"already-answered"}`; exactly one `resolved` per client; ack does **not** leak to A | PASS                                                         |
| C4  | **broadcast convergence** — both clients hold the identical converged `notification.ask.resolved` for the winning requestId                                                                     | PASS                                                         |

> **Note:** C2 uses the ask-resolved broadcast as the "task command" vehicle because it is the only deterministic, client-agnostic broadcast in the standalone bundle that does **not** invoke the model — a real `newTask`/`sendMessage` would call an LLM provider, which is non-deterministic in a hermetic smoke. The interchangeability point (client-agnostic backend → identical fan-out) is exactly what C2 asserts. `onAskResponseReceived` logs `Task  not found` for the empty `taskId` and returns safely — expected, non-fatal.

### D5 — ICG-D1 display layer (frontend `features/context/`) — DONE, types+lint green

Backend (ICG-C1/C2) was already in place; D5 is frontend-only:

- `frontend/src/features/context/` — MST viewport store (`store.ts`), singleton bus wiring (`store-singleton.ts`), actions (`actions.ts`), components: `Timeline.tsx` (windowed list + deep-links + prefetch), `TimelineRow.tsx`, `ThinkingPanel.tsx`, `JumpControls.tsx`; barrel `index.ts`.
- Mount wiring: `bootstrap.tsx` (`subscribeContextStore`), `app-shell/App.tsx` + `app-content.tsx` (Timeline mount), `connector-bus` (`isWebMode()` guard).

**Deviations / decisions:**

1. **No `@tanstack/react-virtual`** (not installed) — windowing implemented dependency-free in `Timeline.tsx` (computed visible range + overscan).
2. **Request frames registered in `WebviewMessageType`** (`packages/types/src/webview/message-types.ts`), NOT in the events registry: the barrel re-exports the legacy `WebviewMessage`/`ExtensionMessage` **interfaces** (`webview/message.ts` / `extension/message.ts`) whose `type` is a closed string union — the registry's `FlattenNested` unions are shadowed for the frontend. Adding the two request literals (`context.history.range.requested`, `context.recall.requested`) legalizes the single `request as WebviewMessage` cast at the bus boundary.
3. **Inbound frames** (`context.history.chunk` / `context.history.completed` / `context.recall.response`) are handled via **type-narrowing** on `msg.type` (early return) followed by per-property `unknown → Concrete` casts — no `as unknown`, no intermediate structural interfaces (which failed TS2352 with the catch-all union member).
4. **Bus meta-seeding frame type is `"state"`** (not `task.state.received`) — the standalone webview bus re-emits state frames under `type: "state"` with `state.context.tasks` as a Record.

### Remaining

- **D6** — check-all → build --force → stage by literal path → commit "phase D" → push.
- **(later, separate pass)** v2/v3 remediation per the section above.

## D50 ESLint audit (2026-09-08 — 4 local rules, full backend triage)

**Rules (all `error` in `packages/config-eslint/base.js`):** `local/no-complex-folder-structure` (maxFilesPerFolder 7; folder≠file both directions; domain clusters), `local/no-empty-files`, `local/no-store-outside-store` (storeWordInFilename + externalVolatileFactory + duplicateModelName + original 4), `local/feature-naming` (handlers `on-<kebab>.ts`; no `*Handler.ts`; actions = camelCase verbs; folders = domains).

**Result:** backend `pnpm lint` = **284 errors, all genuine** after 4 calibration fixes: (1) `feature-naming` imperative-verb default was unwired (ESLint does not apply schema `default`) → actNoVerb 33→6; (2) `no-complex-folder-structure` domainCluster reported non-member files → 119→82; (3) `no-store-outside-store` storeWordInFilename unscoped → 20→16, and connectors/web 2 FPs eliminated → **`connectors/web` lint EXIT=0**; (4) folder-token bare substring match false-positived "eventlog" → suffix/dash-part match, 74→73. Note: root `pnpm lint` (turbo) aborts at the first failing package without `--continue` — enumerate with `cd backend && pnpm lint`.

### [A] Duplication — un-split domain clusters (domainCluster, 82 files / ~25 folders)

Sibling filenames sharing a kebab prefix = the prefix is a domain that never became a subfolder (user example: `on-context-condense-api/history/types/utils/.ts` = ONE event split into 4 role-fragments → single `on-<event>.ts` or a `condense/` subfolder). Genuine clusters: `chat/task/condense/handlers/on-context-condense-*` ×5; `task-store/task-model/actions/task-model-actions-*` ×3; `presentAssistantMessage/toolExecution/tool-execution-*` ×3; `tools/ApplyDiffTool/apply-diff-*` ×4 (+index); `write/writeToFileHelpers/write-to-file-*` ×3; `time-machine/actions/strategies/multi-search-replace*` ×5; `services/checkpoints/shadow-checkpoint-*` ×3; `services/glob/list-files*` ×5; `code-index/manager/manager.*` ×7; `code-index/orchestrator/orchestrator.*` ×3; `code-index/embedders/openrouter/openrouter.*` ×4; `code-index/processors/file-watcher/file-watcher.*` ×2; `handlers/agents/on-settings-agents*` ×3; `handlers/code-index/on-settings-code-index*` ×4.

### [B] Architecture glitches

- **folder=filename (folderEq, 64):** name doubled in dir+file — `shared/` singletons (api/api.ts, array/array.ts, experiments/experiments.ts, language/language.ts, modes/modes.ts, package/package.ts, skills/skills.ts, support-prompt/support-prompt.ts, tools/tools*.ts ×3); `services/` singletons (constants/constants.ts, ripgrep/ripgrep.ts, tree-sitter/tree-sitter.ts, mcp-hub/init/init.ts, built-in-commands/built-in-commands.ts, service-factory/service-factory.ts, text-chunker/text-chunker.ts, file-watcher.process.ts, git.ts/git.helpers.ts); `i18n/i18n.ts`, `diagnostics/diagnostics.ts`, `extract-text/extract-text.ts`, `indentation-reader/indentation-reader.ts`, `core/core.ts`, `handler/handler.ts`, `stream/stream.ts`, `image-generation/image-generation.ts`, `ai-sdk/ai-sdk.ts`, `multi-point-strategy/multi-point-strategy.ts`, `streamExecutor/streamExecutor.ts`, `presentAssistantMessage/presentAssistantMessage.ts`, `ask/ask.ts`, `apply/apply.ts`, `capabilities/capabilities.ts`, `native-tools/native-tools.ts`, `on-settings-api-config/on-settings-api-config.ts`, `on-webview-launched/on-webview-launched.ts`; `resumeTask/resumeTask.*`×3;`saveMessages/saveMessages.\*` ×3. Fix pattern: the directory is the domain container — rename the file to its role (`index.ts`, `impl.ts`) or collapse single-file dirs.
- **Store fragments (storeWordInFilename, 16):** one logical store split across files — `chat/task/volatile-state.ts` + `chat/init-chat-state.ts` (+ `chat/task/store.ts` imports the volatile factory = externalVolatileFactory, and `types.model("Task")` ×2 in store.ts = duplicateModelName — two stores in one file); `cloud/init-cloud-state.ts`; `chat/task/handlers/on-webview-launched/webview-state.ts`; `task-model-actions-state.ts`; `editFileSaveHelpers/read-state.ts`; `window-manager/store/state-utils.ts`; `settings/agents/store/agent-state-model.ts` + `agent-store.ts` (store inside a `store/` folder); `settings/models/api-config-store.profiles.ts` + `api-config-store.ts`; `settings/store.auto-approval.ts` + `store.commands.ts` + `store.handler.ts` + `store.types.ts`; `store/store.snapshot.ts`. → merge into each feature's single `store.ts`.
- **file=folder collision (fileSameAsSubfolder, 2):** `strategies/multi-search-replace.ts` vs subfolder `multi-search-replace-validation/`; `embedders/openai.ts` vs subfolder `openai-compatible/`.

### [C] v2/v3 naming deviations

- **`on-*` FOLDERS (folderOn, 22):** event name must be a FILE, a folder is a domain — `chat/task/handlers/on-webview-launched/` (5 files), `settings/handlers/on-settings-api-config/` (5), `on-settings-core/` (8), `on-settings-worktree/` (4) → rename to domains (`webview-launched/` → `webview/`, `on-settings-api-config/` → `api-config/`, etc.).
- **Mechanism tokens in folders (folderTok, 73):** `helpers/` trees — `api/handlers/helpers/**` (12), `chat/tools/helpers/**` (~48), `chat/task/messages/handlers/helpers/**` (6); plus `settings/autoapprovalhandler/store.ts` (`handler` token → `auto-approval/`). → split helper files into the domains they serve; no `helpers` container in v3.
- **Kebab actions (actKebab, 8):** `api/events/actions/task-command-intents.ts`, `task-model-actions-goals/lifecycle/state.ts` ×3, `context-actions.ts`, `history-delivery.ts`, `param-extraction.ts`, `history-actions.ts` → camelCase verb naming.
- **Noun actions (actNoVerb, 6):** `taskRegistry.ts`, `messageManager.ts`, `condense/actions/types.ts`, `messages/actions/types.ts`, `time-machine/actions/checkpoints.ts`, `stats.ts` → name after the verb (`collectTimeMachineStats.ts`) or move `types.ts` to the domain `types` folder.
- **`*Handler.ts` (handlerSuf, 3):** `streamErrorHandler.ts`, `textBlockHandler.ts`, `checkpointRestoreHandler.ts` → `on-<event>.ts` one-file-per-event.
- **Non-`on-` handler file (handlerFileNaming, 1):** `chat/task/handlers/messageEnhancer.ts` → `on-<event>.ts`.
- **Empty/comment-only garbage (empty, 2):** `chat/task/task-store/task-state/properties.ts`, `settings/store.handler.ts` → delete.

### [D] Items for later analysis

- **complexity (2):** `ProviderSettingsManager-crud.ts` (async arrow 12 > 10), `ProviderSettingsManager-initialize.ts` `initializeCore` (18 > 10) → split into sub-operations.
- **max-len (1):** `on-message-broadcast.ts:59` (135 chars).
- **domainCluster on legitimate distinct events:** `on-goal-*` ×4, `on-task-lifecycle/on-task-*` ×3, `on-tts-*` ×4, `on-notification-*` ×3, `on-settings-*` groups, `on-textarea-*` ×4, `on-message-*` ×4 are the v2 "one file per event" layout, not fragments. The rule cannot yet distinguish "domain-prefix + event" from "event + role-suffix" — needs a role-suffix whitelist (`api`, `history`, `types`, `utils`, `errors`, `io`, `metadata`, …) to suppress the former. Rule refinement → #19.
- **Rule candidates from this audit (#19):** duplicate basenames across the feature tree; compound names with 4+ kebab segments; one-file-per-event (role-suffix whitelist above).

## D51 v2/v3 compliance audit per area (2026-09-08, 6 Explore agents — principles 1–28 of architectural-restructure-v2.md)

Scope: `backend/features/{chat,api,cloud,hist,settings,foundation,context,store}` + `frontend/src/features/**`. File-naming debt is in D50 — this section is behavior: P1/P2 IPC via action creators, P4 all state in MST, P18 import from barrel, P6 model=folder, P7 one model per store.

### Systemic findings (cross-area)

- **[C] P18 barrels are PARTIAL:** `@features/foundation`, `@features/settings`, `@features/intents`, `@features/chat`, `@features/api`, `@features/hist` barrels re-export only a slice of the public API, so deep `@features/<x>/deep/path` imports cannot be 1-line swaps — ~250 deep imports across backend (116 in chat/tools alone, ~55 foundation deep-imports from settings, 17 `intents/bus`, ~30 more in chat/task). Fix order: complete each barrel's re-exports FIRST, then a mechanical sweep. The two symbol-exact swaps (chat/tools `store.ts` → `@features/api` `StreamingStoreModel`; `attemptCompletionHelpers.ts` → `@features/hist` `getTaskWithId`) are trivial.
- **[C] P1 direct IPC outside action creators:** the dominant real deviation — ~25 backend files call `provider.postMessageToWebview(...)` directly (settings 21, chat/task ~15, foundation on-task-show, cloud on-cloud ×4, hist on-history ×2, chat/tools mcp ×1) instead of `send<EventName>()` action creators; frontend components fire `window.postMessage` inline (pushWindow, settingsButtonClicked ×3, marketplaceButtonClicked, TelemetryBanner, `type:"action"` ×3). `providerRegistry.ts` itself documents the rule.
- **[B] P4 module-level mutable state outside MST:** `chat/task` `presentAssistantMessage.ts` (`export let presentAssistantMessageRecursionDepth`), `saveMessages.metadata.ts` (`taskSizeCache` NodeCache), `chat/tools/helpers/lifecycle/updateTodoListHelpers.ts` (`let approvedTodoList`), `settings/ProviderSettingsManager.ts` (`let _providerSettingsManager`), `foundation` singletons (`capabilities/registry.ts` `_capabilities`, `backend-logger.ts` `current`, `providerRegistry.ts` `_provider`/`_connector`, `host-context/context.ts` `_slots`/`_hostContext`/`_asyncReadCache`/`_secretsCache`, `on-webview-message.ts` `messageHandlers` Map, `time-machine/VirtualWorkspace.ts` module-level instance, `getTimeMachine.ts` `_state`), `context/actions/context-actions.ts` (`inFlightHistories`, `let registered`), `ContextArchiveService.ts` (3 module states), frontend `useSettingsSearch.ts` (`let currentRegisterSetting`).
- **[B] P6/P7 model-name & one-model-per-store:** backend — `settings/agents/store.ts` (5 models, none matches folder `agents`), `settings/models/store.ts` (`ApiConfig` ×2 names), `api/store.ts` (`Api` + re-exported `Streaming`), `time-machine/store.ts` (3 models, no folder match), `context/store.ts` (`ContextTaskMeta` no match); frontend — `chat/tree/store.tsx` + `chat/store.tsx` define TWO DIFFERENT models both named `"ChatStore"` (name collision), `settings/agents/store.ts` (5), `chat/tree/store.tsx` (4), `context/store.ts` (3), `chat/store.tsx` (3), `window-manager/store.tsx` (2), `intents/store.ts` (2).

### [A] Duplication

- `chat/task`: goal handlers registered TWICE (`events/handlers/register-on-task-intents.ts` delegates to `register-all-task-handlers.ts` then registers on-goal-\* again).
- `chat/tools`: `EditTool.ts` + `SearchReplaceTool.ts` + `EditFileTool/edit-file-tool.ts` — three tools re-implement the same validate→access→read→apply→reset skeleton and near-identical `handlePartial()` ask-flow over three parallel helper families.
- frontend: `features/storeSingleton.ts` (201 lines, **0 importers — dead**) vs `root-store/bootstrap/singleton.ts` (live) — two parallel RootStore singletons, identical `let _rootStore` + `_actionBuffer`.
- frontend: `chat/ask/{store,handlers,orchestrators,utils}.ts` (OLD, wired to `chat/store.tsx` `ask:` slot) vs `chat/task/notifications/ask/*` (NEW, live) — near-identical twins, BOTH trees live.

### [B] Architecture glitches (area-specific)

- `chat/task`: `register-on-messages-intents.ts` mixes onWebviewMessage registration with business logic (`askClaimTracker.claim`, `handleWebviewAskResponse`) + direct IPC; `checkpointRestoreHandler.ts` directly mutates `getBackendRootStore().foundation.agentState.pendingEditOp`.
- `cloud`: `store.ts` exports non-model functions (`initCloudState`/`getCloudState`) = split-off store fragments; `on-cloud.ts` monolithically registers ~10 `bus.register` handlers (P10).
- frontend: `foundation` (4 files: `useRouterModels`/`useOllamaModels`/`useLmStudioModels`/`MermaidBlock`) imports `@src/features/settings/...` while settings→foundation (33 files) = **circular foundation↔settings dependency**.

### [C] Deviation hot-spots

- `settings`: 21 direct-IPC files (full list in audit: on-settings-\* handlers, agents/code-index handlers, importSettings); `agents/modes-file-service/mock.ts` `let _extensionContext`.
- `foundation/window-manager`: `register-on-window-manager-intents.ts` — 8 inline `onWebviewMessage(...)` registrations in one function (P10 monolith); `on-task-show.ts` ×2 direct IPC.

### [D] Items for later analysis

- `chat/task/actions/taskRegistry.ts` — module-level `Map<string, ITaskModel>`: documented exception (task registry) or migrate to MST?
- `chat/tools` — 27 tool singletons (`export const X = new X()`): stateless strategy objects (only mutable fields are streaming/partial → exempt) or per-task instances for full P4?
- `chat/tools/mcp/processToolContent.ts` — `sendExecutionStatus(task, status)` takes `task` but never uses it (dead param after migration to root store).
- `settings` — empty `store.handler.ts` (see D50); does `ModesModel` ("Modes", state path `settings.modes`) belong in the agents feature?
- frontend — `iframe.contentWindow.postMessage` (`chat-received.ts` mcp-force-accept, `McpIframeRenderer.tsx` mcp-context): documented second IPC channel or must it route through action creators?
- frontend `intents/store.ts` — export names `IntentModel`/`IntentStoreModel` vs model strings `"Intent"`/`"IntentStore"`: confirm canonical naming.

## D52 Shadow stores deep research (P4) + three ESLint rule changes (2026-09-12)

**Question:** what are the 1399 `no-deep-feature-import` findings actually about? Are they "complete the barrel" debt, or something else?

**Conclusion: the deep imports are a SYMPTOM, not the disease.** The root cause is v2 rule #4
("ALL state in MST — zero module-level mutable state"): the codebase carries state in
**module-level shadow stores** — `let`/`var` at module scope + accessor closures
(`getX`/`setX`) + `new EventEmitter` / pub-sub bypassing the MST store. Other features
then deep-import _those specific files_ because the state lives in them and no barrel can
expose it. Fixing the barrel (re-exporting `getX`) would propagate the anti-pattern, not
remove it. The correct fix for shadow-store targets is **migrating the state into the
feature's single `store.ts`** (an MST model on the root store).

### Inventory (2026-09-12, full backend)

- **29 top-level `let`/`var`** module states. Primary migration targets:
    - `foundation/capabilities/registry.ts` — `let _capabilities` (+ `getBackendCapabilities`/`setBackendCapabilities`)
    - `foundation/host-context/context.ts` — `let _slots`, `let _hostContext`
    - `storeSingleton.ts` — `let _rootStore` (backend twin of the frontend one)
    - `foundation/webview/providerRegistry.ts` — `let _provider`, `let _connector`
    - `foundation/time-machine/getTimeMachine.ts` — `let _state`
    - `foundation/capabilities/backend-logger.ts` — `let current`
- **53 module-level `const X = new …`** singletons referenced by exported accessors
  (`_taskRegistry`, `messageHandlers` Map, `memoryCache`, `metaCache`, `modelsWithLoadedDetails`, …)
- **6 `new EventEmitter`** instances (hidden event state)
- **92 `.publish` call sites** — the sanctioned channels are ONLY the IntentBus
  (`bus.publish`/`bus.register`, v2 principle #1) and the connector bus
  (`getConnectorBus().publish`). Everything else (`capabilities().pubsub.publish`,
  `task.emit`, `emitter.emit`, …) is a bypass of the MST store.

### Decision (implemented as ESLint debt markers)

1. **NEW `local/no-shadow-store`** (5 checks, `error`):
    - `moduleMutableState` — top-level `let`/`var`
    - `moduleSingletonRegistry` — top-level `const X = new …` referenced by an exported fn
    - `shadowStoreAccessor` — exported fn closing over a state-like module binding
    - `eventEmitterState` — `new EventEmitter`
    - `pubsubBypass` — non-sanctioned `x.publish`/`x.emit`; explicit `.pubsub.` receivers
      are always flagged. Sanctioned bus names (exempt): `bus`, `getConnectorBus`,
      `connectorBus`, `ConnectorBus`, `intentBus`, `IntentBus` (configurable).
    - Includes: `backend/`, `frontend/src/`, `apps/cli/`. Excludes: tests, `__mocks__`,
      `dist/`, `connectors/` (connectors own the IPC seam).
2. **`local/no-deep-feature-import` — target-aware correction.** The resolved import
   target is checked for module-level `let`/`var` (cached, heuristic). Shadow-store
   targets get a new `shadowStoreTarget` message: _"completing the barrel is the WRONG
   fix here (v2 rule #4) — migrate the state into the feature's single store.ts"_.
   Also fixed: import sources that resolve to a real `index.ts` barrel (any nesting
   depth, e.g. `@features/foundation/capabilities`) are now recognized as barrels, not
   deep imports.
3. **`local/no-complex-folder-structure` — NO `store/` FOLDERS (new `storeFolder`
   check, `noStoreFolder` option, default on).** One `store.ts` per feature. A top-level
   feature literally named `store` (directly under `features/`) is a feature and is
   exempt. `dottedBasename` message no longer suggests `store/snapshot.ts`.

### New counts (after rule changes, 2026-09-12)

| rule                                   | before | after    | notes                                                                                                                                                                                                                                          |
| -------------------------------------- | ------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| no-deep-feature-import (backend)       | 1399   | **1132** | 267 real-barrel imports were false positives (single-segment barrel check); split: **713 `deepImport`** + **419 `shadowStoreTarget`** (intents/bus 122, host-context 101, capabilities 79, time-machine 40, webview 15, settings/models 11, …) |
| no-shadow-store (backend)              | —      | **152**  | 29 `moduleMutableState` + 90 `shadowStoreAccessor` + 20 `moduleSingletonRegistry` + 6 `eventEmitterState` + 7 `pubsubBypass`                                                                                                                   |
| no-shadow-store (frontend)             | —      | **23**   | `storeSingleton.ts` (`_rootStore` + accessors), `currentRegisterSetting`, `activeConnector`, `activeBus`, …                                                                                                                                    |
| no-complex-folder-structure (backend)  | 175    | **183**  | +8 `storeFolder`: `foundation/window-manager/store/` ×4, `settings/agents/store/` ×4                                                                                                                                                           |
| no-complex-folder-structure (frontend) | 63     | 63       | 0 store folders                                                                                                                                                                                                                                |
| **backend total**                      | 1884   | **2029** | +145 new debt markers (no-shadow-store 152 + storeFolder 8 − 267 deep-import false-positive removal)                                                                                                                                           |
| **frontend total**                     | 95     | 118      | +23 no-shadow-store                                                                                                                                                                                                                            |

Sanity: 0 findings in `connectors/`, tests, `__mocks__`, `dist/`. Sanctioned
`bus.publish` / `getConnectorBus().publish` are NOT flagged (harness-verified).

### Migration order (when executing the P4 fix)

1. `capabilities/registry.ts` → `capabilities/store.ts` MST model (56 importers)
2. `host-context/context.ts` → `host-context/store.ts` (101 shadow-target imports)
3. `storeSingleton.ts` + frontend `storeSingleton.ts` → the existing `root-store/` singletons
4. `webview/providerRegistry.ts`, `time-machine/getTimeMachine.ts`, `backend-logger.ts`
5. collapse the 2 `store/` folders into `store.ts` files (window-manager, settings/agents)
6. swap the 713 remaining `deepImport` findings to barrels as each barrel is completed

## D53 `no-deep-feature-import` rework: the wrong ACTION, not the length (2026-09-12)

**Question (user):** the rule must not be about path _length_/barrel — it is about
the **action**. Importing another feature's **store functionality** as a static
module is simply the wrong thing to do. The correct action is to navigate the
**live MST tree**: `getRoot<RootStore>(self).<feature>.<child>.action(...)` for a
sibling, `getParent(self)` (or `getParent(self, 2)`) for a parent — from inside an
MST action so the whole flow stays in actions. A child store is part of the _same_
tree; it must not be statically imported. (v2 rule #4.)

**Rework of `local/no-deep-feature-import`:** the rule now classifies each **VALUE**
deep import by the **nature of the resolved target file** (read once, cached per
source; resolution covers both alias shapes, backend `@features/*` → `backend/features/*`
and frontend `@src/*` → `frontend/src/*`):

| target kind | detection                                                              | messageId           | required action                                                                                     |
| ----------- | ---------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------- |
| **store**   | file is `store.ts(x)`, or defines `types.model/compose(` + `.actions(` | `storeImport`       | navigate the live tree: `getRoot`/`getParent` inside an MST action — do not import the store module |
| **shadow**  | a column-0 module-level `let`/`var`                                    | `shadowStoreTarget` | migrate the state into the feature's single `store.ts`, read via the root store                     |
| **other**   | a plain internal module (or unresolvable)                              | `deepImport`        | use the feature's **barrel** (complete it if the symbol is not re-exported yet)                     |

**Exemptions:**

- **Type-only imports are exempt** (`import type …`, or every specifier `type`-prefixed)
  — they are erased at compile time, so there is no runtime _action_ to fix. This is
  also the normal way to type `getRoot<RootStore>(self)` results across features.
- A **top-level** (no-slash) import is a feature entrypoint, not a deep import.
- An import that **resolves to a real barrel** (`index.ts(x)` exists at any depth) is allowed.
- `allowedPaths` (documented exceptions), registered in `base.js` as
  `allowedPaths: ["@features/intents/bus"]` — the sanctioned IntentBus channel
  (v2 principle #1; `IntentBus` is also re-exported by the `@features/intents` barrel).

**Bug found + fixed while calibrating:** the repo indents with **tabs**, and the old
shadow heuristic `\s{0,3}` matched a class-method-local `let` (e.g. `\t\tlet burstCount`
in `intents/bus.ts`) as "module-level". The shadow check now requires the declaration
at **column 0** (`(^|\n)(export\s+)?(let|var)`), mirroring `no-shadow-store`'s AST
`program.body` check.

**Verification:** 17/17 harness cases (type-only exempt; value→store/shadow/other;
`@src` resolution; barrel-at-depth; explicit `index`; top-level; `allowedPaths`);
`node --check` + module load OK; 0 IDE errors; real lints re-run (below);
invariants held — `intents/bus` = 0 findings, 0 findings in tests/`__mocks__`/`dist/`/
`connectors/`, 0 findings in the rule files themselves.

### New counts (after rework, apples-to-apples vs the D52 logs)

| package                               | total (D52 → D53)      | no-deep-feature-import (D52 → D53) | D53 no-deep breakdown                                                     |
| ------------------------------------- | ---------------------- | ---------------------------------- | ------------------------------------------------------------------------- |
| **backend** (`jabberwock`)            | **1777 → 1411** (−366) | **1132 → 766**                     | **464 `deepImport`** + **213 `shadowStoreTarget`** + **89 `storeImport`** |
| **frontend** (`@jabberwock/frontend`) | **118 → 294** (+176)   | **0 → 176**                        | **151 `deepImport`** + **25 `storeImport`** (+0 `shadowStoreTarget`)      |

Reconciliation: the backend −366 is **entirely** `no-deep` — every other rule is
identical. It is (a) type-only deep imports now exempt (~244) and (b) `@features/intents/bus`
(122) moved to `allowedPaths`. The frontend +176 is **not new debt**: the D52 rule only
matched the backend `@features/` alias, so the frontend's `@src/features/...` deep
imports were simply never linted before; the rework added `@src/*` coverage, marking
176 previously-unseen deep value imports. `no-shadow-store` (152 / 23) and
`no-complex-folder-structure` (183 / 63) are unchanged.

> Note: `grep -oE no-shadow-store` over-counts (the `shadowStoreTarget` **message text**
> names the `no-shadow-store` rule). Counts above are the authoritative per-`rule-id`
> parse of the ESLint stylish output.

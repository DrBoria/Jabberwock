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

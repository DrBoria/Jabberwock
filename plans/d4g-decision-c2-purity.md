# D4g Architectural Decision — C-2 Purity Contradiction

> **Status:** DECISION — architect ruling on the D4g (Phase D, chunk 7/8) C-2 purity contradiction.
> **HEAD:** `cb6fa63e5` (branch `mega-refactoring`). Working tree pristine at D4g start state (STEP 0 passed).
> **Authoritative specs:** [`plans/phase-d-implementation-plan.md`](phase-d-implementation-plan.md) §3 (D4 detail), §7 (risk register R7/R12), §8 (open questions); [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md) §7.1 (startBackend sketch), §8.3 (criterion C-2), §4.1 (one code path after the seam).
> **Verified this session:** Serena LSP (provider-registry layering) + esbuild config read (C-2 automatic proof). The D4g agent's esbuild metafile probes A–E are accepted as the source of truth for the vscode-importing file sets.

---

## 1. DECISION

**Option 2 — implement D4g PART 1 only (safe), defer PART 2 — PLUS a plan amendment and two new sub-chunks (D4g-pre, D4g-2).**

Concretely:

1. **D4g PART 1 (immediate, this dispatch):** remove the `vscode` imports from `intents.ts` (`vscode.version`/`vscode.env.language` → `hostContext.extensionVersion` + new `hostContext.language`) and `migrateSettings.ts` (`vscode.ExtensionContext` → `IHostContext`). Both only REMOVE vscode imports → zero C-2 risk. Stage + verify.
2. **D4g PART 2 (deferred):** the `startBackend()` wiring (`createBackendRootStore` + `setupIntentBus` + 9 handler groups) is BLOCKED and is deferred until D4g-pre + D4g-2 clear the residual vscode coupling.
3. **New sub-chunk D4g-pre:** decouple the **7 unlisted** root-store-graph files (PostHogTelemetryClient, vscode-lm ×5, importVscode). This unblocks `createBackendRootStore()` in `startBackend()`.
4. **New sub-chunk D4g-2:** decouple the **85-file** handler-registration graph (the 9 `register*Intents` groups). This unblocks `setupIntentBus()` in `startBackend()`.
5. **Plan amendment (required):** correct R7 + Open Question 4 (the 9 groups are NOT pure), expand the §3.1 file list from 20 → 27, and add the 85-file handler graph + the vscode-lm provider-registry seam as new §3.5/§3.6.

**Scope ruling (the user's hinge question):** the 85-file handler decoupling **IS in Phase D scope** — it is a hard prerequisite for D3 (cross-compat verification), which is a Phase D chunk and the carrier of the Phase D success criterion. It is a **D4 expansion**, not a separate phase. See §5.

---

## 2. RATIONALE

### 2.1 Why PART 1 is safe to ship now

PART 1 only _removes_ `vscode` imports (replaces them with `hostContext` members). It cannot introduce a new vscode edge into the server-reachable graph, so it cannot regress C-2. It is pure progress and de-risks the later wiring. The `hostContext.language` slot is a one-line additive type change in [`packages/types/src/protocol/backend-connector.ts`](../packages/types/src/protocol/backend-connector.ts) (already anticipated by plan §3.3 line 546).

### 2.2 Why PART 2 is a hard C-2 regression today

The server build config has **no external "vscode"** ([`backend/esbuild.mjs:125-131`](../backend/esbuild.mjs:125)):

```js
const serverConfig = {
	...buildOptions,
	entryPoints: ["../connectors/web/backend/main.ts"],
	outfile: "dist/server.js",
	external: ["esbuild", "global-agent"], // NO "vscode"
}
```

So any transitive `vscode` import in the server-reachable graph fails the build (the automatic C-2 proof, R12). The D4g agent's probes confirm:

- `createBackendRootStore()` alone reaches **7** residual vscode-importing files (Probe B, minus `migrateSettings.ts` which PART 1 fixes) → build fails.
- `setupIntentBus()` reaches **85** vscode-importing files (Probe D) → build fails.

PART 2 therefore cannot land until D4g-pre (7 files) + D4g-2 (85 files) are done. Shipping PART 2 now would break `pnpm build --force` (gate G2) and is non-negotiable per R12.

### 2.3 Why the plan's "20 files" was incomplete

The plan §3.1 listed 20 root-store-graph files; D4a–D4f cleared 19. The probe reveals **7 additional** vscode-importing files in the root-store graph that were never in the 20-file list:

- `packages/telemetry/src/PostHogTelemetryClient.ts` (line 1: `import * as vscode from "vscode"`)
- `connectors/vscode/backend/model-providers/vscode-lm/{vscode-lm-format,tools,stream,token-count,handler}.ts` (5 files)
- `packages/cloud/src/importVscode.ts`

These are the _actual_ blocker for `createBackendRootStore()`. They were either missed by the plan's original probe or added after the plan was written. They are real (the probes ran on the current tree with D4a–D4f already staged, so this is the residual, not stale data). **Option 4 (re-verify on clean HEAD) is unnecessary** — the residual is confirmed by construction.

### 2.4 The vscode-lm coupling is a layering violation (the crux of D4g-pre)

This is the non-obvious part, verified via Serena. The shared `backend/` code **statically imports from the vscode connector** — a direct violation of the v4 layering rule (shared `backend/**` must never depend on a specific connector; the glossary §10.3 says vscode-lm is "physically in connectors/vscode/backend"):

| Shared file                                                                                                                                     | vscode-connector import                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`backend/api/providers/index.ts:21`](../backend/api/providers/index.ts:21)                                                                     | `export { VsCodeLmHandler } from "@connectors/vscode/backend/model-providers/vscode-lm"`                                                                                                                                                                                                             |
| [`backend/api/handler.ts:134`](../backend/api/handler.ts:134)                                                                                   | `"vscode-lm": VsCodeLmHandler` in the static `providerHandlerMap`                                                                                                                                                                                                                                    |
| [`backend/api/transform/format/index.ts:6`](../backend/api/transform/format/index.ts:6)                                                         | `export { convertToVsCodeLmMessages as vscodeLmTransform } from "@connectors/vscode/backend/model-providers/vscode-lm/vscode-lm-format"` (**dead code** — no consumer; the actual `convertToVsCodeLmMessages` is consumed only inside the vscode connector's `handler.ts:142` via a relative import) |
| [`backend/features/settings/handlers/settings/on-settings-models.ts:6`](../backend/features/settings/handlers/settings/on-settings-models.ts:6) | `import { getVsCodeLmModels } from "@connectors/vscode/backend/model-providers/vscode-lm/tools"`                                                                                                                                                                                                     |

Because `providerHandlerMap` is a **static** `Record` that names `VsCodeLmHandler`, esbuild bundles the entire vscode-lm module (and its `vscode` imports) into the server graph. **A runtime capability gate does NOT fix this** — the static import is bundled regardless of whether the branch executes. This is a critical correction to R7's mitigation (see §3.1).

**The fix is a provider-registry seam** (see §4.2): the shared backend owns a _mutable_ provider registry + the `ApiHandler` interface; each connector registers its host-specific providers at startup. The vscode connector registers `vscode-lm`; the server registers nothing. The shared code never statically imports the vscode connector. This is the architecturally correct resolution. **Correction (2026-09-04, architect re-verification):** the registry does NOT automatically de-couple `on-settings-models.ts` (D4g-2) — `getVsCodeLmModels` is a function, not a handler ctor, so it needs a separate capability slot in D4g-2. The `vscodeLmTransform` re-export is dead code and is simply deleted (no `getTransform` registry needed).

### 2.5 Why Option 3 does not work

Option 3 (capability-gated registration, accept build risk) fails for two independent reasons:

1. **Runtime gating ≠ build-time exclusion.** `if (capabilities.cloudService) { registerOnCloudIntents(bus) }` still has the static `import { registerOnCloudIntents }` at the top of `intents.ts`, which esbuild bundles → vscode pulled in → build fails. Capability gating reduces _runtime_ coupling, not _bundle_ coupling.
2. **`createBackendRootStore()` alone** (independent of any handler registration) already pulls 7 vscode files → build fails even with zero handler groups registered.

So Option 3 is not a viable path; it collapses into "do D4g-pre first," which is Option 1/2's prerequisite.

---

## 3. PLAN AMENDMENTS (required before D4g-pre / D4g-2 dispatch)

### 3.1 Correct R7 (risk register, line 785)

**Current (WRONG):** "The task/message/notification/settings/window-manager/context-management/history/marketplace handlers are pure and should work in both modes."

**Corrected:** "Probe C (D4g, 2026-09-04) disproves this: **all 9** `register*Intents` groups transitively import `vscode` (task 58, messages 62, notifications 22, settings 47, window-manager 58, context 3, cloud 9, history 10, marketplace 8; union = 85 files, Probe D). The vscode coupling is in the deep handler _implementation_ files (e.g. `on-history.ts`, `on-cloud.ts`, `on-settings-*.ts`), not the thin `register*Intents` functions. **Mitigation correction:** a runtime capability gate is INSUFFICIENT for C-2 — the static imports are bundled regardless. The mitigation is BUILD-TIME decoupling (move vscode-importing handler code to the vscode connector, or replace vscode imports with capability slots / the provider-registry seam), applied per the §3.2 strategies A–G. `setupIntentBus` can only run in server mode after D4g-2 clears all 85 files."

### 3.2 Correct Open Question 4 (line 806)

**Current (WRONG):** "Recommendation: register all 9 (they're pure and don't depend on vscode)."

**Corrected:** "Register all 9 in BOTH modes (per §7.1 sketch + §4.1 one-code-path principle), but ONLY after D4g-2 build-time-decouples all 85 handler-graph files. The groups are NOT pure today. Do not rely on runtime capability gating for C-2."

### 3.3 Expand §3.1 file list 20 → 27

Add the 7 unlisted root-store-graph files (PostHogTelemetryClient, vscode-lm ×5, importVscode) to the §3.1 table with their decoupling strategy:

- `PostHogTelemetryClient.ts` → host-context injection: the `vscode` import (line 2) is used for `vscode.env.machineId` (line 27, the PostHog `distinctId`) + `vscode.workspace.getConfiguration("telemetry").get("telemetryLevel")` (line 157, in `updateTelemetryState`). **Correction (2026-09-04, architect re-verification):** the original claim of "version/language in telemetry properties" is wrong — there is no `vscode.version` / `vscode.env.language` read in this file (those are in `intents.ts`, cleared by PART 1). Fix: new `IHostContext.machineId` + `IHostContext.getTelemetryLevel` slots; the vscode activation path (`core.ts:35`) passes them at construction. See [`plans/d4g-pre-chunk-spec.md`](d4g-pre-chunk-spec.md) §3.
- `vscode-lm` ×5 → **provider-registry seam** (§4.2). Not a simple import removal.
- `importVscode.ts` → Strategy A/D: this is a vscode-specific import helper in a shared package (`packages/cloud`). Move the vscode-specific path to the vscode connector, or gate behind a capability; the shared cloud package must not import vscode.

### 3.4 New §3.5 — the 85-file handler-registration graph

Document the 9 groups + per-group vscode-importing file counts (Probe C) and the union (85, Probe D). Note the likely **overlap** with the 27 root-store files (e.g. settings/window-manager handlers appear in both) — D4g-2's first step is a probe to compute the exact _new-work_ set = (85 handler-graph files) − (already-cleared root-store files), so the true D4g-2 scope is ≤ 85.

### 3.5 New §3.6 — vscode-lm provider-registry seam

Specify the seam (§4.2 below). This is the architecturally significant change in D4g-pre.

---

## 4. NEW SUB-CHUNK PLAN

### 4.1 D4g PART 1 (immediate — this dispatch)

- **Files:** `backend/extension-activation/modules/core/intents.ts`, `backend/utils/settings/migrateSettings.ts`, `packages/types/src/protocol/backend-connector.ts` (add `language?: string` to `IHostContext`).
- **Change:** `vscode.version` → `hostContext.extensionVersion`; `vscode.env.language` → `hostContext.language`; `vscode.ExtensionContext` → `IHostContext`. Remove the `vscode` import from both files.
- **Gates:** G1 `pnpm check-all`; G2 `pnpm build --force` (server bundle still pure — Probe A baseline must hold); G3 esbuild metafile probe on `intents.ts` + `migrateSettings.ts` shows 0 vscode-importing files; G4 stage by literal path.
- **Deliverable:** PART 1 staged. PART 2 explicitly deferred (PURITY NOTE in `bootstrap.ts` + NOTE in `main.ts` remain in place).

### 4.2 D4g-pre — decouple the 7 unlisted root-store files (unblocks `createBackendRootStore()`)

- **Provider-registry seam (the vscode-lm ×5 fix):**
    1. In shared `backend/api/`, introduce a mutable provider registry: `registerProvider(name: string, ctor: ProviderConstructor)` + `getProvider(name: string)`. `buildApiHandler` (§[`backend/api/handler.ts:151`](../backend/api/handler.ts:151)) looks up the registry **first**, then falls back to the static `providerHandlerMap` (which NO LONGER contains `vscode-lm`).
    2. Remove `export { VsCodeLmHandler }` from [`backend/api/providers/index.ts:22`](../backend/api/providers/index.ts:22) and the `"vscode-lm"` entry from `providerHandlerMap` ([`backend/api/handler.ts:135`](../backend/api/handler.ts:135)).
    3. The vscode connector, at activation, calls `registerProvider("vscode-lm", VsCodeLmHandler)`. The server registers nothing → `vscode-lm` is simply unavailable in server mode (correct: it's a host-specific provider).
    4. [`backend/api/transform/format/index.ts:6`](../backend/api/transform/format/index.ts:6): the `vscodeLmTransform` re-export is **dead code** (no consumer) and is simply **deleted** (along with the `vscodeLmTransform` entry in [`backend/api/transform/index.ts:9`](../backend/api/transform/index.ts:9)). No `getTransform` registry is needed.
- **PostHogTelemetryClient.ts:** replace the `vscode` version/language reads with `hostContext`-derived values (Strategy G).
- **importVscode.ts:** move the vscode-specific import path to the vscode connector or gate behind a capability (Strategy A/D); the shared `packages/cloud` must not import vscode.
- **Gates:** G1 `pnpm check-all`; G2 `pnpm build --force` — **server bundle now builds with `createBackendRootStore()` reachable** (the 7-file residual is cleared); G3 esbuild metafile probe on `backend/features/backendroot/store.ts` shows **0** vscode-importing files; G4 extension regression (vscode-lm provider still works in extension mode — devtool 3 layers); G5 stage by literal path.
- **After D4g-pre:** `createBackendRootStore()` can be wired into `startBackend()` (half of PART 2). `setupIntentBus()` is still blocked (85 files).

### 4.3 D4g-2 — decouple the 85-file handler-registration graph (unblocks `setupIntentBus()`)

- **Step 0 (probe):** compute the exact new-work set = (85 handler-graph files) − (27 cleared root-store files). This is the true D4g-2 file count (≤ 85).
- **Strategy:** apply the existing §3.2 strategies A–G per file (type-only, config slot, UI-dialog slot, webview-move, workspace/file slot, logger slot). The vscode-lm provider-registry seam from D4g-pre also de-couples `on-settings-models.ts` for free.
- **Sub-batching:** split into 4–6 sub-dispatches by functional group to isolate regressions (mirrors R6's 4–5-files-per-batch discipline): e.g. (a) context+cloud+history+marketplace (the small groups: 3+9+10+8), (b) notifications (22), (c) settings (47), (d) task (58), (e) messages (62), (f) window-manager (58). Each sub-dispatch has its own `pnpm check-all` + `pnpm build --force` + extension-regression gate.
- **Gates (final D4g-2):** G1 `pnpm check-all`; G2 `pnpm build --force` — server bundle builds with the full `setupIntentBus` graph reachable; G3 esbuild metafile probe on `intents.ts` shows **0** vscode-importing files; G4 extension regression (all 9 handler groups still work in extension mode — devtool 3 layers); G5 stage by literal path.

### 4.4 D4g PART 2 — wire `startBackend()` (after D4g-pre + D4g-2)

- **Files:** `backend/startup/bootstrap.ts` (remove PURITY NOTE lines 35–43; add `createBackendRootStore({ globalStoragePath: capabilities.hostContext.storageDir })` + `setupIntentBus(bridge, telemetryService, capabilities)`), `connectors/web/backend/main.ts` (`buildServerState` returns `getBackendRootStore().getSnapshot()`; remove NOTE lines 83–88), `connectors/vscode/backend/activation/extension.ts` (drop the now-redundant `createBackendRootStore` + `setupIntentBus` calls).
- **Gates:** G1 `pnpm check-all`; G2 `pnpm build --force` — server bundle builds WITHOUT vscode external (C-2 automatic proof); G3 server runtime proof (`pnpm start:server` → `/healthz` → WS hello→state returns full MST snapshot → newTask via WS → streamChunk → task completes); G4 extension regression; G5 stage by literal path.
- **Then D4h** (Ask first-response-wins wiring) proceeds as planned, followed by D3.

---

## 5. SCOPE DETERMINATION (the hinge question)

**Is the 85-file handler decoupling in Phase D, or a separate phase?**

**Ruling: IN Phase D scope — it is a D4 expansion, not a separate phase.**

Reasoning:

1. **D3 is a Phase D chunk and a hard dependency on it.** D3's categories 2 (task-command identity: newTask/cancel/resume/sendMessage), 3 (first-response-wins: ask + askResponse), and 4 (broadcast convergence: notifications) all require the task/messages/notifications handlers to be **registered in server mode**. Category 1 (context) is already wired (`registerContextIntents()` is in `startBackend()`, [`backend/startup/bootstrap.ts:66`](../backend/startup/bootstrap.ts:66)) — which is why the context group is the smallest (3 files). Without D4g-2, D3's categories 2/3/4 cannot be verified against the standalone bundle.
2. **The Phase D success criterion requires it.** Line 936: "browser client and webview client are interchangeable at the protocol level." Task-command identity (category 2) is the core of that criterion, and it needs the task/message handlers in server mode.
3. **The plan's own D4 goal requires it.** Line 264: "…so `startBackend()` can host the MST root store + intent bus (full §7.1 sketch) and **register task intent handlers in server mode**." The §7.1 sketch uses `setupIntentBus`, which registers all 9 groups → all 85 files must be build-time pure.
4. **§4.1 one-code-path principle.** Creating a separate server-only registration path (registering only task/messages/notifications) would fork the composition root into two paths, violating §4.1. The clean architecture is one `setupIntentBus` that works in both modes, which requires all 9 groups decoupled.

**Consequence:** D4 grows from a 20-file to a ~27 + ~85 (minus overlap) file effort. This is a ~5× expansion over the plan's estimate, but it is _required_ for Phase D to meet its success criterion — it is not optional scope. The plan must be amended (§3) to reflect the true size, and D4g-2 must be sub-batched (§4.3) to keep each dispatch regression-isolated.

**What is NOT in Phase D scope:** nothing new is deferred to a later phase. The 85-file work is Phase D (D4). The only deferral is _ordering_: PART 2 wiring lands after D4g-pre + D4g-2, not before.

---

## 6. AMENDED EXECUTION ORDER

```
D4a–D4f  (done: 19 of 20 root-store files cleared)
   │
D4g PART 1   ← IMMEDIATE (safe): intents.ts + migrateSettings.ts + IHostContext.language
   │            (removes vscode only; C-2-safe; stage + verify)
   │
D4g-pre      ← NEW: 7 unlisted root-store files (PostHog, vscode-lm ×5 via provider-registry seam, importVscode)
   │            (unblocks createBackendRootStore() in startBackend)
   │
D4g-2        ← NEW: 85-file handler-registration graph (sub-batched by group; probe first for true new-work set)
   │            (unblocks setupIntentBus() in startBackend)
   │
D4g PART 2   ← wire startBackend(): createBackendRootStore + setupIntentBus + buildServerState full snapshot
   │            (extension.ts drops redundant calls)
   │
D4h          ← Ask first-response-wins wiring (2 files, as planned)
   │
D3           ← Cross-compat verification (all 4 categories now provable against the standalone bundle)
   │
D5 → D6      ← ICG-D1 display layer → Phase D finalization
```

---

## 7. ANSWERS TO THE D4g AGENT'S SPECIFIC QUESTIONS

| Question                                                                      | Answer                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Which option (1/2/3/4)?                                                       | **Option 2** (PART 1 now, PART 2 deferred) + plan amendment + new D4g-pre/D4g-2 sub-chunks. Option 4 (re-verify on clean HEAD) is unnecessary — the 7-file residual is confirmed by construction (probes ran on the D4a–D4f-staged tree).                  |
| If Option 1, what's the scope of the 85-file decoupling and is it in Phase D? | It is **in Phase D** (D4 expansion, D3 prerequisite). Scope = 85 handler-graph files minus overlap with the 27 root-store files (probe in D4g-2 step 0 for the exact count). Sub-batched by group (§4.3).                                                  |
| If Option 2, confirm PART 1 is the deliverable and PART 2 deferred?           | **Confirmed.** PART 1 (intents.ts + migrateSettings.ts + `IHostContext.language`) is the D4g deliverable. PART 2 is deferred until D4g-pre + D4g-2 complete. The PURITY NOTE (`bootstrap.ts:35-43`) and NOTE (`main.ts:83-88`) stay in place until PART 2. |
| Does the plan's R7 assumption need an amendment?                              | **Yes.** R7 + Open Question 4 are wrong (the 9 groups are NOT pure) and R7's mitigation (runtime capability gating) is insufficient for C-2 (static imports are bundled regardless). Corrected in §3.1/§3.2.                                               |
| Do the 7 unlisted root-store files need a new sub-chunk?                      | **Yes** — D4g-pre (§4.2). The vscode-lm ×5 require the provider-registry seam (§4.2), not a simple import removal.                                                                                                                                         |

# Architecture Audit Report — Jabberwock Plans (2026-08-19)

**Scope:** Cross-plan consistency and currency review of the four architecture plans, the two fiber mechanism specs, and [`providers-restructure.md`](plans/providers-restructure.md). PLANNING-ONLY — no source-code changes were made. Concrete errors found during the audit were **fixed in-place** in the existing plan files (see §7 "Applied fixes"); this report is the consolidated record of findings, coverage, currency, and remaining gaps.

**Method:** All source-code verification was performed with Serena LSP + RPG Encoder only (no grep/`read_file` on source files). Markdown/config files were read directly. Verified against HEAD `36ea32a8` (last commit `2026-07-19`); the plans were written `2026-08-17/19`, and HEAD has not moved since, so the audits in the plans are current by construction.

**Documents audited:**

| Document | Role |
| -------- | ---- |
| [`plans/architectural-restructure-v2.md`](plans/architectural-restructure-v2.md) | EventBridge sole IPC, action creators/handlers, 4 entities, fiber priority dispatch, streaming exception |
| [`plans/architecture-restructure-v3-plan.md`](plans/architecture-restructure-v3-plan.md) | ESLint rules, code reorg, zod removal, providers folder |
| [`plans/architecture-v4-connector-abstraction.md`](plans/architecture-v4-connector-abstraction.md) | THE v4 plan: `backend/`+`frontend/`+`connectors/`, protocol envelope, fiber preservation, NetBird auth, Docker, phases A–F |
| [`plans/architecture-lossless-context-management.md`](plans/architecture-lossless-context-management.md) | Lossless context: SQLite+FTS5, hierarchical collapse, parent/child task_embed, fiber integration, phases LCM-0…6 |
| [`plans/fiber-intentbus-mst-snapshot-analysis.md`](plans/fiber-intentbus-mst-snapshot-analysis.md) | Fiber/MST snapshot compatibility analysis |
| [`plans/intentbus-fiber-migration.md`](plans/intentbus-fiber-migration.md) | Fiber migration mechanics |
| [`plans/providers-restructure.md`](plans/providers-restructure.md) | LLM model providers restructuring |

---

## 1. Findings table

Severity legend: **CRITICAL** = wrong execution order / broken dependency if followed · **MAJOR** = hard-requirement violation or cross-plan contradiction that will produce errors · **MINOR** = wording drift, stale counts, or cosmetic inconsistency.

| # | Severity | Finding | Plan(s) & exact location | Recommended fix |
| - | -------- | ------- | ------------------------ | --------------- |
| C1 | **CRITICAL** | **Phase-ordering + protocol-location error.** LCM §9.1 attributes the `packages/types/src/protocol/` envelope to **v4 Phase A** and orders `LCM-0` immediately after v4-A. But v4 creates the `protocol/` folder and envelope only in **Phase B1**. Consequently `LCM-0` (which writes `packages/types/src/protocol/context.ts` and `backend/src/features/context/db/schema.sql`) would start before the protocol folder/envelope/`ConnectorId`/capability interfaces exist, and `backend/src/features/context/` would be created before v4-B establishes the backend extraction + `hostContext` capabilities that LCM itself declares as prerequisites. | [`architecture-lossless-context-management.md:418`](plans/architecture-lossless-context-management.md:418) (says "v4 Phase A (protocol envelope…)") vs [`architecture-v4-connector-abstraction.md:193`](plans/architecture-v4-connector-abstraction.md:193), [`architecture-v4-connector-abstraction.md:246`](plans/architecture-v4-connector-abstraction.md:246), [`architecture-v4-connector-abstraction.md:879`](plans/architecture-v4-connector-abstraction.md:879) (protocol = Phase B1); LCM final order at [`architecture-lossless-context-management.md:423`](plans/architecture-lossless-context-management.md:423) | Change LCM-0's predecessor to **v4 Phase B1** (not A), and correct "Phase A" → "Phase B1". Alternatively, fold LCM-0's protocol types into v4 B1 as a co-created subfolder. |
| M1 | **MAJOR** | **Folder-naming contradiction.** LCM uses the OLD `webview-ui/` name as a *target* path for the frontend context feature, while simultaneously using the NEW `backend/` name — but v4 Phase A renames `webview-ui/` → `frontend/`. Implementation following LCM would create files under a directory that no longer exists post-rename. LCM-4 also mixes `src/features/intents/` (old) with `backend/src/features/context/` (new). | [`architecture-lossless-context-management.md:366`](plans/architecture-lossless-context-management.md:366) (`webview-ui/src/features/context/`), [`architecture-lossless-context-management.md:405`](plans/architecture-lossless-context-management.md:405), [`architecture-lossless-context-management.md:472`](plans/architecture-lossless-context-management.md:472)–[`473`](plans/architecture-lossless-context-management.md:473), [`architecture-lossless-context-management.md:465`](plans/architecture-lossless-context-management.md:465) (`src/features/intents/`); contradicting v4 [`architecture-v4-connector-abstraction.md:154`](plans/architecture-v4-connector-abstraction.md:154) and A1 rename | Normalize all LCM target paths to `frontend/src/features/context/` and `backend/src/features/intents/…`. Keep old-path references only where they describe *current* HEAD state. |
| M2 | **MAJOR** | **Tone violation of requirement #10.** v4 self-describes as the "final implementation document" but retains change-history wording: `БЫЛО` (explicitly banned), `legacy`, and a full "Ревизия плана (найдено → исправлено)" appendix. | [`architecture-v4-connector-abstraction.md:150`](plans/architecture-v4-connector-abstraction.md:150), [`154`](plans/architecture-v4-connector-abstraction.md:154), [`159`](plans/architecture-v4-connector-abstraction.md:159), [`302`](plans/architecture-v4-connector-abstraction.md:302), [`613`](plans/architecture-v4-connector-abstraction.md:613), [`624`](plans/architecture-v4-connector-abstraction.md:624), [`833`](plans/architecture-v4-connector-abstraction.md:833); appendix [`956`](plans/architecture-v4-connector-abstraction.md:956)–[`973`](plans/architecture-v4-connector-abstraction.md:973) | Strip `БЫЛО`/`legacy`/`deprecated` wording from the body; move the "Приложение. Ревизия плана" table out of the final document (or into a separate changelog file). |
| M3 | **MAJOR** | **Tone violation of requirement #10 (LCM).** LCM header uses the banned word `отклонено` and `legacy export`, and carries a "Приложение A — Ревизия" (REV-1…7) change-history table. | [`architecture-lossless-context-management.md:5`](plans/architecture-lossless-context-management.md:5) (`отклонено`), [`349`](plans/architecture-lossless-context-management.md:349) + [`480`](plans/architecture-lossless-context-management.md:480) (`legacy export`), appendix [`502`](plans/architecture-lossless-context-management.md:502)–[`512`](plans/architecture-lossless-context-management.md:512) | Remove `отклонено`/`legacy`; relabel Appendix A as neutral "verified current-state notes" (it is largely factual verification, not design-change history). |
| M4 | **MAJOR** | **v2 is presented as a pending migration while already implemented.** v2's Phase 0 "Fiber IntentBus — DO FIRST", "WHAT MUST BE DELETED", and "SUCCESS CRITERIA" describe FIFO→fiber as future work, but the fiber bus is implemented at HEAD (confirmed below). v2 header is "Revised 2026-07-14" and contains `legacy`. v4/LCM correctly treat the fiber bus as *current*; v2 does not, and nothing in v2 flags it as implemented/superseded. | [`architectural-restructure-v2.md:1`](plans/architectural-restructure-v2.md:1), [`1378`](plans/architectural-restructure-v2.md:1378)–[`1380`](plans/architectural-restructure-v2.md:1380), [`512`](plans/architectural-restructure-v2.md:512), [`1372`](plans/architectural-restructure-v2.md:1372), [`1531`](plans/architectural-restructure-v2.md:1531) | Add a status banner to v2 ("implemented; retained as conventions reference") or merge v2's still-relevant conventions into the v4 doc and archive v2. |
| m1 | **MINOR** | **Streaming exception contradiction.** v2 fixes the streaming exception as *direct `webview.postMessage()`* (rule #14, success criterion #43), while v4 criterion C-4 requires *no hardcoded postMessage remains* (re-expressed through `connector.sendOutbound`/event bus). v2 is not annotated as superseded on this point. | [`architectural-restructure-v2.md:37`](plans/architectural-restructure-v2.md:37), [`409`](plans/architectural-restructure-v2.md:409)–[`435`](plans/architectural-restructure-v2.md:435), [`1868`](plans/architectural-restructure-v2.md:1868)–[`1872`](plans/architectural-restructure-v2.md:1872) vs [`architecture-v4-connector-abstraction.md:667`](plans/architecture-v4-connector-abstraction.md:667), [`817`](plans/architecture-v4-connector-abstraction.md:817) | Annotate v2 §"Streaming Architecture" with "re-expressed through connector surface in v4" pointer. |
| m2 | **MINOR** | **"providers untouched by v4" is not literally true.** The task framing says providers are untouched; v4 §10.2/L10 physically relocates the `vscode-lm` model provider into `connectors/vscode/backend/model-providers/` (conceptually still a model provider, physically moved). | [`providers-restructure.md:121`](plans/providers-restructure.md:121) (`src/api/providers/` as final) vs [`architecture-v4-connector-abstraction.md:46`](plans/architecture-v4-connector-abstraction.md:46), [`829`](plans/architecture-v4-connector-abstraction.md:829) | Add one line to providers-restructure.md noting the v4 physical relocation of `vscode-lm` (name/role unchanged). |
| m3 | **MINOR** | **vscode import count off by one.** v4 states "≈168" files; actual unique count is **169** (154 wildcard `import * as vscode` + 15 files using named `from "vscode"` / dynamic `require("vscode")` / type-only `import("vscode")`). | [`architecture-v4-connector-abstraction.md:63`](plans/architecture-v4-connector-abstraction.md:63), [`649`](plans/architecture-v4-connector-abstraction.md:649) | Trivial; optionally re-verify at A0 baseline. No action required. |
| m4 | **MINOR** | **v2 target intents structure omits actual files.** v2 lists `intents/` as 4 files; HEAD has `index.ts`, `setup.ts` (backend) and `registrations.ts`, `setup.ts` (frontend) additionally. | [`architectural-restructure-v2.md:719`](plans/architectural-restructure-v2.md:719)–[`724`](plans/architectural-restructure-v2.md:724), [`1095`](plans/architectural-restructure-v2.md:1095)–[`1100`](plans/architectural-restructure-v2.md:1100) | Not a contradiction; note only if v2's whitelist rule is enforced literally. |
| m5 | **MINOR** | **EventBridge constructor gained a 4th param.** v4 §2.1 describes the two construction points but not the `mdmService` argument now present in the signature. | [`architecture-v4-connector-abstraction.md:57`](plans/architecture-v4-connector-abstraction.md:57) vs [`src/extension.ts:71`](src/extension.ts:71) | Cosmetic; no action. |
| m6 | **MINOR** | **LCM §9.1 internal tension.** One clause says "LCM-0…LCM-5 start after v4 Phase C"; the final order line places LCM-0 between A and B. Subsumed by C1 but noted. | [`architecture-lossless-context-management.md:418`](plans/architecture-lossless-context-management.md:418) vs [`423`](plans/architecture-lossless-context-management.md:423) | Resolved by C1 fix. |

---

## 2. Requirement-coverage matrix

| # | Requirement | Status | Where covered |
| - | ----------- | ------ | ------------- |
| 1 | Rename `src→backend`, `webview-ui→frontend`, new `connectors/`; "provider" = LLM only; "connector" = new host adapter | **Covered** (v4) — with LCM naming drift M1 | [`architecture-v4-connector-abstraction.md:146`](plans/architecture-v4-connector-abstraction.md:146)–[`166`](plans/architecture-v4-connector-abstraction.md:166), [`42`](plans/architecture-v4-connector-abstraction.md:42)–[`48`](plans/architecture-v4-connector-abstraction.md:48), decisions D-3/D-4 |
| 2 | Dual-mode VSCode + standalone Node server, Docker images per side, browser via WebSocket, identical minus vscode-only, full MCP access | **Covered** | [`architecture-v4-connector-abstraction.md:23`](plans/architecture-v4-connector-abstraction.md:23)–[`32`](plans/architecture-v4-connector-abstraction.md:32), [`622`](plans/architecture-v4-connector-abstraction.md:622)–[`625`](plans/architecture-v4-connector-abstraction.md:625), §6, §9, §9.6 |
| 3 | TOTAL decoupling both sides from vscode; backend = pure Node zero vscode; frontend sees only injected emitter; every external API through connector interfaces | **Covered** | [`architecture-v4-connector-abstraction.md:641`](plans/architecture-v4-connector-abstraction.md:641)–[`668`](plans/architecture-v4-connector-abstraction.md:668), §4.3, §4.5, criteria C-1…C-5 |
| 4 | Pipeline topology both sides `connector inbound → queue/resolver`; unified protocol; frontend-originated events indistinguishable | **Covered** | [`architecture-v4-connector-abstraction.md:477`](plans/architecture-v4-connector-abstraction.md:477)–[`505`](plans/architecture-v4-connector-abstraction.md:505), §4.1, §6.2, G2/G3 |
| 5 | ONE transport-agnostic EventBridge, never receives a vscode entity; in-memory fake connector test; no "2 EventBridges" | **Covered** | [`architecture-v4-connector-abstraction.md:284`](plans/architecture-v4-connector-abstraction.md:284)–[`315`](plans/architecture-v4-connector-abstraction.md:315), decision D-8 |
| 6 | Fiber IntentBus for ALL comms both sides; Critical=0/High=1/Normal=2/Low=3; preemption at yield; MST snapshots at boundaries; abort/cancel = Critical preempting streaming mid-yield | **Covered** (verified implemented) | [`architecture-v4-connector-abstraction.md:509`](plans/architecture-v4-connector-abstraction.md:509)–[`549`](plans/architecture-v4-connector-abstraction.md:549); [`architecture-lossless-context-management.md:266`](plans/architecture-lossless-context-management.md:266)–[`297`](plans/architecture-lossless-context-management.md:297); code [`src/features/intents/bus.ts:15`](src/features/intents/bus.ts:15) |
| 7 | Connector layout exactly `connectors/vscode/{frontend,backend}` + `connectors/web/{frontend,backend}` (web not http, WebSocket-only, no REST+SSE); content-naming rule for transport | **Covered** | [`architecture-v4-connector-abstraction.md:148`](plans/architecture-v4-connector-abstraction.md:148)–[`187`](plans/architecture-v4-connector-abstraction.md:187), §6, D-3 |
| 8 | Q6 auth: self-hosted NetBird (LAN + 5G + another city, max security, no outside connections; server binds loopback/TUN only) | **Covered** | [`architecture-v4-connector-abstraction.md:781`](plans/architecture-v4-connector-abstraction.md:781)–[`792`](plans/architecture-v4-connector-abstraction.md:792), D-7, F3/F3b |
| 9 | Lossless context: never delete; hierarchical collapse; ES-like search by model AND user via one backend API; SQLite durable; parent/child = child embeds as topic group, infinite branching = recursive collapse; UI tree + search panel; fiber integration | **Covered** | [`architecture-lossless-context-management.md:129`](plans/architecture-lossless-context-management.md:129)–[`264`](plans/architecture-lossless-context-management.md:264), §5, §6, §8; R1–R8 traceability [`530`](plans/architecture-lossless-context-management.md:530)–[`541`](plans/architecture-lossless-context-management.md:541) |
| 10 | Tone: FINAL documents, no change-history/rejection wording | **Partial** — banned wording remains | M2, M3, M4 above |

**Coverage result:** 9/10 fully covered; requirement #10 partially violated (M2/M3/M4). No requirement is *missing* entirely.

---

## 3. Codebase currency

All checks below were performed against HEAD `36ea32a8` (commit `2026-07-19`); since the plans were written `2026-08-17/19` and HEAD is unchanged since, **no new files/features landed after the plans were written**.

### 3.1 Confirmed current (plan claims hold)

| Claim in plan | Verification result |
| ------------- | ------------------- |
| Fiber IntentBus implemented, not FIFO | **Confirmed.** `class PriorityQueue` at [`src/features/intents/bus.ts:15`](src/features/intents/bus.ts:15), `queue = new PriorityQueue<FiberWork>()` at [`bus.ts:56`](src/features/intents/bus.ts:56), scheduler injection at [`bus.ts:71`](src/features/intents/bus.ts:71), priority lookup `?? IntentPriority.Normal` at [`bus.ts:118`](src/features/intents/bus.ts:118), suspend/resume at [`bus.ts:189`](src/features/intents/bus.ts:189)–[`191`](src/features/intents/bus.ts:191). |
| `INTENT_PRIORITY` buckets `{Critical:0, High:1, Normal:2, Low:3}` | **Confirmed** at [`src/features/intents/IntentConstants.ts:96`](src/features/intents/IntentConstants.ts:96)–[`124`](src/features/intents/IntentConstants.ts:124). |
| MST `suspendIntent`/`resumeIntent` actions | **Confirmed** at [`src/features/intents/store.ts:108`](src/features/intents/store.ts:108), [`113`](src/features/intents/store.ts:113). |
| Frontend IntentBus twin exists | **Confirmed.** `webview-ui/src/features/intents/{bus.ts,store.ts,IntentConstants.ts,context.ts,setup.ts,registrations.ts,index.ts}` present. |
| Parent/child task links live in MST fields (not file paths) | **Confirmed.** `rootTaskId`, `childTaskIds`, `parentTaskId`, `childTaskId` in `TaskModelBase` at [`src/features/chat/task/store.ts:36`](src/features/chat/task/store.ts:36)–[`41`](src/features/chat/task/store.ts:41) and [`133`](src/features/chat/task/store.ts:133)–[`135`](src/features/chat/task/store.ts:135). Matches LCM REV-1 correction. |
| Existing summarization is lossy | **Confirmed.** `overwriteApiConversationHistory` at [`src/features/chat/task/messages/actions/save/saveApiMessages.ts:95`](src/features/chat/task/messages/actions/save/saveApiMessages.ts:95); called by `condenseContext` ([`condenseContext.ts:68`](src/features/chat/task/condense/actions/condenseContext.ts:68)), `handleContextWindowExceededError` ([`contextWindow.ts:156`](src/features/api/handlers/helpers/recover/contextWindow.ts:156)), plus `resumeTask.ts:77`, `rewriteHistoryAfterPlanApproval.ts:60`, `messageManager.history.ts:167`. |
| Backend vscode-import inventory (~168) | **Confirmed ≈.** 169 unique files: 154 wildcard `import * as vscode` + 15 files using `from "vscode"` / `require("vscode")` / type-only `import("vscode")`. |
| Frontend window/postMessage inventory (~55 files) | **Confirmed ≈.** 56 files contain `window.addEventListener("message"` or `.postMessage(`. |
| `packages/types/src/protocol/` does not exist at HEAD | **Confirmed** — `protocol/` absent from [`packages/types/src`](packages/types/src) dir listing. |
| SQLite absent (`better-sqlite3`/`node:sqlite`/`DatabaseSync`) | **Confirmed** — zero matches in `src/**` and `packages/**` code files. |
| EventBridge two construction points | **Confirmed exact.** [`src/extension.ts:71`](src/extension.ts:71) (`"sidebar"`) and [`src/activate/registerCommands/open-in-new-tab.ts:23`](src/activate/registerCommands/open-in-new-tab.ts:23) (`"editor"`). |
| `EventBridge implements vscode.WebviewViewProvider`; `sendStreamChunk` exists | **Confirmed** at [`src/features/foundation/webview/EventBridge.ts:26`](src/features/foundation/webview/EventBridge.ts:26) and [`src/features/api/events/actions/sendStreamChunk.ts:26`](src/features/api/events/actions/sendStreamChunk.ts:26). |

### 3.2 Stale / drifted

| Item | Drift | Severity |
| ---- | ----- | -------- |
| v2 target structure & migration phases | Fiber bus / event architecture already implemented; v2 still phrased as "DO FIRST" plan | M4 |
| v2 streaming exception signature | v2 shows `sendStreamChunk(webview, taskId, text)`; actual is `sendStreamChunk(payload: {taskId, text, reset?})` | m1 |
| v4 EventBridge signature | 4th param `mdmService` not mentioned | m5 |
| v2 `intents/` file list | missing `index.ts`/`setup.ts` (BE) and `registrations.ts`/`setup.ts` (FE) | m4 |

---

## 4. Gap list

| Gap | Detail | Recommendation |
| --- | ------ | -------------- |
| G1 | **SQLite ↔ connector-agnostic backend interaction** is addressed (SQLite path = `hostContext.storageDir`, backend-only dep, single writer/WAL) at [`architecture-lossless-context-management.md:360`](plans/architecture-lossless-context-management.md:360)–[`367`](plans/architecture-lossless-context-management.md:367) — **covered**, except coexistence/atomicity between the new SQLite store and v4's file-backed `hashmapMemory` (settings/history) in server mode is only implicit. | Add one explicit sentence in LCM §4.4/§6.3 clarifying the two durable stores (SQLite for messages/DAG, `hashmapMemory` JSON for settings/history) and that task deletion spans both. |
| G2 | **Multi-client concurrent compression** is covered: single backend writer + per-task serialization queue (LCM-2) + WAL readers; LCM Q7 leaves simultaneous *UI topic_group writes* from multiple clients as an optimistic-write open item. | No blocking gap; confirm Q7 decision before LCM-5. |
| G3 | **Streaming exception re-expression through connector** is correctly specified in v4 (C-4 / §10.1) and LCM §7.2 — **covered** — but v2's foundational text still states the old direct-`webview.postMessage` design. | Add cross-reference in v2 (m1). |
| G4 | **No bulk backfill migration** for pre-existing tasks' JSON archives into SQLite; LCM only specifies per-task reconciliation-on-startup (import gaps). Historical tasks would only populate SQLite lazily. | Add an explicit LCM step (or note as non-goal): one-time bulk backfill for existing `tasks/<id>/*.json` before LCM-6 cutover. |
| G5 | **better-sqlite3 native module is absent from v4's Docker/VSIX packaging** (`pnpm install --frozen-lockfile` in v4 §9.1 does not mention the new native dependency). | Flag in v4 §9.1 / LCM RSK-1: backend image and VSIX must build/install better-sqlite3 prebuilds (already partially covered by LCM-0 gate; add the cross-reference). |
| G6 | **`packages/ipc` IpcServer → WS unification** is deferred (v4 §1.2/§3.2). Not a requirement gap; acknowledged as follow-up. | No action. |
| G7 | LCM-4 "Files touched" uses `src/features/intents/` (pre-rename) while the rest of LCM uses `backend/`. | Fold into M1 normalization. |

---

## 5. Tone audit (requirement #10)

Banned/change-history tokens found:

| Token | Files & locations |
| ----- | ----------------- |
| `БЫЛО` | [`architecture-v4-connector-abstraction.md:150`](plans/architecture-v4-connector-abstraction.md:150), [`154`](plans/architecture-v4-connector-abstraction.md:154), [`159`](plans/architecture-v4-connector-abstraction.md:159), [`302`](plans/architecture-v4-connector-abstraction.md:302), [`624`](plans/architecture-v4-connector-abstraction.md:624), [`833`](plans/architecture-v4-connector-abstraction.md:833) (and more in §10.2) |
| `legacy` / `Legacy` | [`architectural-restructure-v2.md:512`](plans/architectural-restructure-v2.md:512), [`1372`](plans/architectural-restructure-v2.md:1372), [`1531`](plans/architectural-restructure-v2.md:1531); [`architecture-v4-connector-abstraction.md:613`](plans/architecture-v4-connector-abstraction.md:613), [`833`](plans/architecture-v4-connector-abstraction.md:833); [`architecture-lossless-context-management.md:349`](plans/architecture-lossless-context-management.md:349), [`480`](plans/architecture-lossless-context-management.md:480) |
| `отклонено` | [`architecture-lossless-context-management.md:5`](plans/architecture-lossless-context-management.md:5) |
| Revision-history appendices | v4 "Приложение. Ревизия плана (найдено → исправлено)" [`956`](plans/architecture-v4-connector-abstraction.md:956)–[`973`](plans/architecture-v4-connector-abstraction.md:973) (mentions "Q6", "RESOLVED", "Rev-2 history block"); LCM "Приложение A — Ревизия" [`502`](plans/architecture-lossless-context-management.md:502)–[`512`](plans/architecture-lossless-context-management.md:512) |
| `конфликт` | Only technical sense (version conflict, concurrency) — not a violation. |

**Verdict:** v4 and LCM are the most tone-clean of the set but still contain banned tokens and revision appendices; v2 contains `legacy` and a "Revised" title. Requirement #10 is **not** met as written.

---

## 6. Applied fixes (in-place edits to existing plans)

| Finding | File edited | Change |
| ------- | ----------- | ------ |
| C1 | [`architecture-lossless-context-management.md`](plans/architecture-lossless-context-management.md) | §9.1: protocol envelope attributed to v4 **Phase B1** (not A); LCM-0 predecessor corrected; final order line updated to `v4-A → v4-B1 → [LCM-0] → v4-B2/B3/B4 → v4-C → …`. |
| M1/G7 | [`architecture-lossless-context-management.md`](plans/architecture-lossless-context-management.md) | Target paths normalized: `webview-ui/src/features/context/` → `frontend/src/features/context/` (3 sites), `src/features/intents/` → `backend/src/features/intents/` (LCM-4). |
| M3 | [`architecture-lossless-context-management.md`](plans/architecture-lossless-context-management.md) | `отклонено` removed; `legacy export` → `read-only export` (2 sites). |
| M2 | [`architecture-v4-connector-abstraction.md`](plans/architecture-v4-connector-abstraction.md) | `БЫЛО` → `(ранее …)` (6 sites); `legacy call sites` → `существующих call sites`; `legacy accessors … deprecated` → `существующие accessors`. |
| M4 | [`architectural-restructure-v2.md`](plans/architectural-restructure-v2.md) | Added `STATUS: IMPLEMENTED` banner noting fiber bus/EventBridge/4-entity model are live at HEAD; streaming exception re-expressed in v4 C-4. |
| m2 | [`providers-restructure.md`](plans/providers-restructure.md) | Added v4 note: `vscode-lm` physically relocates to `connectors/vscode/backend/model-providers/` (name/role unchanged). |

**Not edited (reported only):** the two revision-history appendices (v4 "Приложение. Ревизия плана", LCM "Приложение A — Ревизия") — these are factual verification records, not design-change history, and were left in place pending your decision on whether to relocate them. The remaining `deprecated`/`legacy` tokens in v4/v2 are legitimate technical terms (deprecated re-exports, `deprecated-types.ts` filename, legacy Cline-fork naming), not change-history framing.

## 7. Next steps

1. **Decide on the two revision appendices** (v4 §"Приложение. Ревизия плана", LCM "Приложение A") — relocate to a changelog file or keep as neutral verification notes.
2. **Optional gap closures:** add a bulk JSON→SQLite backfill step (G4) and a better-sqlite3 packaging note in v4 §9.1 (G5).
3. **Re-audit** after any further edits, then hand off implementation: v4 Phase A (mechanical renames) → v4 B1 → LCM-0 → … per the corrected order.

---

*Report generated by Architect mode. Concrete errors were fixed in-place in the existing plans; this report is the consolidated record.*

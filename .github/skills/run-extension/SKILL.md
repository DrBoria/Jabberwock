---
name: run-extension
description: "Local Jabberwock skill: full lifecycle of a VS Code extension debug session via DebugMCP + Jabberwock Devtool — pre-start checks, stale-process cleanup, start/stop protocol, breakpoint-freeze handling, three-layer verification. TWO ENTRY POINTS (browser + vscode extension) must BOTH be validated — they share one backend over WS. Source-of-truth memory: `.serena/memories/debug/debug-workflow-protocol.md`."
---

# Debug Workflow Protocol

## Tools

1. **DebugMCP** (`mcp--debug-mcp--*`) — start/stop debug session, breakpoints, stepping, variables
2. **Jabberwock Devtool** — MCP proxy (command-based via `server.ts` (in mcp-entry/)), auto-connects to the extension on demand: UI navigation, store state, console

## CRITICAL

### BEFORE STARTING DEBUGGING: ALWAYS check for active session

**CRITICAL**: Do NOT call `mcp--debug-mcp--start_debugging` without first checking if a session is active.

1. Check devtool: `mcp--jabberwock-devtools--get_current_state()` → if it responds, the extension IS running
2. Check DebugMCP: `mcp--debug-mcp--list_breakpoints()` → if it succeeds (even empty), a session IS active
3. Only call `start_debugging` if BOTH indicate no session
4. To restart: stop first (`stop_debugging`), then start (`start_debugging`)

### BEFORE STOPPING DEBUGGING: Check if session is active

- Don't call `stop_debugging` if no session is active — prevents killing the extension host

### General

1. **DebugMCP unavailable?** → STOP, notify the user
2. **start_debugging** ALWAYS with `configurationName: "Run Extension"` — otherwise node starts and crashes
3. **Devtool auto-connect** — don't wait for the user, devtool connects automatically via stdio proxy
4. **Root cause found?** → stop_debugging (otherwise it restarts on every sneeze)
5. **NO "known context"/"known files" in delegation.** Previous research is guesses, not facts. Debug finds everything via devtool + debugger.
6. **REPRODUCE FIRST.** A bug not reproduced = you don't know where the problem is. devtool + debugger is the only source of truth.
7. **Debugger running but devtool unresponsive?** → stop the terminals that were launched together with the debugger, then retry `start_debugging` — do NOT keep repeating `start_debugging` forever.

### When Devtool Reports DISCONNECTED / No Active Session Exists

**Do NOT immediately retry `start_debugging`.** A dead session usually leaves stale terminal runs behind — killed by the user or crashed mid-launch (e.g., TypeScript error in a build task). The actual error is sitting in those terminals' output. Diagnose first, then restart.

What one launch of **"Run Extension"** spawns (`preLaunchTask` = default build task **watch**, 4 terminals):

- `build:webview`: `pnpm --filter @jabberwock/frontend build` — foreground
- `build:extension`: `pnpm --filter jabberwock bundle` (= from backend/, `node esbuild.mjs`) — foreground; a TS/bundle error here fails preLaunchTask → the extension host never starts at all
- `watch:tsc`: via `pnpm --filter jabberwock watch:tsc`, runs repo-root-level `tsc --noEmit --watch -p backend/tsconfig.json` — background watcher, **the usual TypeScript crash site** (red diagnostics stay in that terminal)
- `watch:bundle`: `node esbuild.mjs --watch` — background

Recovery procedure (agent does all of it autonomously):

1. **Find stale processes** via serena shell: `ps aux | grep -E "extensionDevelopmentPath|ExtensionDevHost"` for orphaned dev host windows; also look for orphaned watchers (`esbuild.mjs --watch`, `tsc --noEmit --watch`). List PIDs first, then kill precisely — no blind pkill.
2. **Read the errors in terminal sessions.** If launch terminals are visible in the VS Code UI, read their output (TypeScript diagnostics, esbuild failures). When disconnected and nothing is readable there, reproduce: run one-shot equivalents via serena shell — `pnpm exec tsc --noEmit -p backend/tsconfig.json` from repo root and/or `node esbuild.mjs` from backend/. The same errors surface in the output.
3. **Close/kill** the stale terminal runs + orphaned processes found above.
4. **Fix the error if needed.** Obvious compile/bundle failure → fix directly (implementation). Unknown-root-cause bug → delegate to Debug mode per AGENTS.md rules, no "known context".
5. **Restart debugger**: debug mode → `start_debugging` with `configurationName: "Run Extension"`; code mode must NOT call start_debugging itself — ask the user for F5/launch (or hand the gate step over to Debug). Then verify before proceeding: devtool `get_current_state()` responds and the extension host is alive.

**Anti-pattern:** DISCONNECTED → retrying `start_debugging` in a loop while stale watchers/dev hosts still hold state; or killing terminals without reading their output first, losing the real error.

## 🔴 NO USER INTERACTION FOR REPRODUCTION

Full bug reproduction is on the agent. Devtool connects automatically via the stdio MCP proxy. The user does NOT connect devtool manually.
Everything else:

- Navigating the extension UI
- Sending messages, clicks, text input
- Checking store, console, DOM
- Replaying the scenario to re-capture at a breakpoint

Everything is done via devtool (`click_element`, `type_text`, `find_element`) and DebugMCP. The user is not required to do anything.

**Anti-pattern:** "send a message", "press the button", "see what's there", "connect devtool" — forbidden.

## Bug Fix Workflow

1. Check DebugMCP
2. start_debugging with configurationName: "Run Extension"
3. **REPRODUCE FIRST** — click through the extension via devtool, confirm the bug is alive
4. **Find the exact spot** — devtool Locator JS or store state to identify the component/function
5. **Set breakpoint** at the found spot
6. **Repeat the reproduction** — hit the breakpoint, check variables + devtool store/console
7. ⚠️ devtool not responding? → breakpoint fired, use DebugMCP (step_over, get_variables_values)
8. Root cause → stop_debugging
9. Fix via Serena LSP (replace_symbol_body, insert_after_symbol, replace_content)
10. **🛑 `pnpm build --force`** (bust turbo cache — NOT `pnpm build`)
11. start_debugging → verify at three levels:
    - DebugMCP: backend variables
    - devtool store: get_store_state
    - devtool UI: find_element (rendered values)
12. Not fixed? → loop to step 5
13. User sign-off → confirmation from the user
14. pnpm check-all before attempt_completion

## Feature Workflow

Same but without reproduction: find the spot (Serena+RPG) → check current state via devtool → plan → stop debug → implement → restart → verify

## 🌐 DUAL ENTRY-POINT VERIFICATION (browser + vscode extension)

Jabberwock has **TWO entry points that must talk to the same backend over WS**:

1. **Browser** — `node backend/dist/server.js --serve-static` on `127.0.0.1:3000` (static SPA + WS `/ws`). Protocol envelopes: `{protocolVersion:1, sentAt, body:{...}}`; `hello {clientKind:"browser"}` → `state` hydration. Key messages: `upsertApiConfiguration {text, apiConfiguration}`, `newTask {text}`, `cancelTask`.
2. **VS Code extension** — launched via debugger `start_debugging` with `configurationName: "Run Extension"`. Webview talks to the same `startBackend()` bootstrap; state posted via `postStateToWebview` (connector fallback branch delivers to WS clients when `state.view` absent).

### Validation rules (BOTH layers, always)

**After ANY backend fix, validate both entry points — not just the one you tested:**

- **VS Code side** — devtool: `get_current_state()` → `get_store_state()` → `find_element` (rendered DOM). Plus DebugMCP variables for backend state.
- **Browser side** — WS client (e.g. `/tmp/jw-browser-rt.mjs` pattern: hello → upsert provider → newTask → wait for assistant frames), or the browser tools (`open_browser_page` / `read_page` / `click_element` / `type_in_page` against `http://127.0.0.1:3000/`) when CDP is alive. Server log: `/tmp/jw-server.log`.

**Why:** the two entry points diverge — vscode mode gets McpServerManager/ProviderSettingsManager from activation in `connectors/vscode/backend/activation/extension.ts`; web mode gets them from `connectors/web/backend/main.ts` (post-`startBackend`). A fix that only wires one side silently breaks the other (see BUG #1/#3: missing `createMcpServerManager()` / `ProviderSettingsManager` in web `main.ts`).

### Test recipe (provider round-trip, both entry points)

1. Find the local LLM endpoint + model (llama.cpp: `http://127.0.0.1:5801/v1`, model id = full GGUF path from `/v1/models`).
2. Browser: WS `upsertApiConfiguration` with `{apiProvider:"openai", openAiBaseUrl, openAiApiKey:"not-needed", model fields = model id, openAiStreamingEnabled:true}` → `newTask` "Reply with the single word: OK" → expect assistant frame.
3. VS Code: start debugger → devtool → same provider via UI or store → send message → verify store + UI.
4. `pnpm check-all` before completion.

## Verification

- pnpm check-all (lint + types + tests) + functionality working in devtool = task complete
- **BOTH entry points validated** (see DUAL ENTRY-POINT VERIFICATION above) = task complete

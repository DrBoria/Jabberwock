---
name: smoke-test
description: 'Jabberwock end-to-end smoke test: create an OpenAI-compatible provider in settings, verify it persists (store + UI dropdown), send a chat message and verify the LLM response with a bounded timer, check agent/mode switching, in BOTH entry points (VS Code extension + browser on port 3000). VISIBLE UI is mandatory — a hidden DOM is NOT a pass. Use when: validating a full LLM round-trip, regression-checking the extension, or when the user says "smoke test".'
---

# Jabberwock Smoke Test

## 🔴 VERIFICATION RULE (constant, applies to EVERY step)

**A step is PASSED only when ALL layers agree:**

1. **Store** — the backend/frontend store holds the expected value (devtool `get_store_state`).
2. **Visible UI** — a **screenshot** shows the value rendered to a human (not just "element exists in DOM").
    - VS Code: screenshot the extension host window (X11 capture).
    - Browser: `screenshot_page` on the :3000 page.
3. **Runtime effect** — the observable side effect happened (LLM response text, HTTP hit to 8081, etc.).

**"Element exists in DOM" without a screenshot = NOT a pass.** No screenshot, no pass.

**Bounded waits only.** Every "wait for X" has a timeout (default 120 s for LLM, 15 s for UI). A timeout = FAIL with the partial state captured. Never block indefinitely.

## Target config (authoritative)

| Field               | Value                        |
| ------------------- | ---------------------------- |
| provider            | `openai` (OpenAI Compatible) |
| base url            | `http://127.0.0.1:8081/v1`   |
| api key             | `123`                        |
| model               | `qwen3.8-27b-ud`             |
| prompt-caching      | checked                      |
| context-window-size | `131072`                     |

The request goes to the **same llama.cpp/llama-swap that serves this agent** — expect contention. Bounded wait is mandatory, not optional.

## Preconditions (check first, all of them)

```
ss -ltn | grep -E ':(3000|8081|60060)'   # web server, llama-swap, dev host
curl -s -m 5 http://127.0.0.1:8081/v1/chat/completions ... # model answers
```

- Dev host missing → relaunch (see `run-extension` skill), wait for 60060.
- Web server missing → `node backend/dist/server.js --serve-static --data-dir /tmp/jw-data-fresh --port 3000`.
- Model not answering → STOP, tell the user.

## Steps

### 1. Create the provider (VS Code settings)

- Open Jabberwock panel → Settings → Providers tab.
- Click **add profile** (`[data-testid="add-profile-button"]`), type the profile name into the real input.
- Select provider **OpenAI Compatible** (`[data-testid="provider-select"]`).
- Type **Base URL** `http://127.0.0.1:8081/v1` into `vscode-text-field[aria-label="Base URL"]`.
- Type **API Key** `123` into `vscode-text-field[aria-label="API Key"]`.
- Model picker: type `qwen3.8-27b-ud`, pick it (or `use-custom-model`).
- Check **prompt-caching**, set **context window** `131072` where present.
- **Edit real `<input>`s / real Selects. NEVER set DOM labels or mutate the store by hand.**

**Pass:** screenshot shows the filled form AND after Save the **Configuration Profile** dropdown
(`[data-testid="select-component"]`) lists the new profile name.
**Store check:** backend `settings.apiConfig.listApiConfigMeta` contains `{name, id, apiProvider:"openai"}`.

### 2. Send a chat message (VS Code)

- Type a short prompt into `[data-testid="chat-input"]`, e.g. "Reply with the single word: OK".
- Click `[data-testid="submit-button"]`.
- **Bounded wait ≤ 120 s** for `chat.isRunning` → false and a visible assistant message.
- **Pass:** screenshot shows the assistant message bubble with the text; store `chat.tasks` has the
  completed task; (optional) 8081 access log shows the POST.

### 3. Agent / mode switching (VS Code)

- Open the mode dropdown, switch to **Architect** (then e.g. **Debugger**).
- Send one message per mode.
- **Pass:** screenshot shows the mode name rendered + each message got a response; store `settings.modes` / active mode reflects the switch.

### 4. Browser entry point (port 3000)

- Open `http://127.0.0.1:3000` in a shared browser page.
- **Pass:** `screenshot_page` shows the UI (not a blank page).
- Configure the same provider via the browser settings UI (or confirm the shared store already has it),
  send the same prompt, bounded wait ≤ 120 s.
- **Pass:** screenshot shows the assistant response rendered.

### 5. Three-layer verification, both entries

For each entry point (VS Code, browser) and for steps 2–3: store + visible screenshot + runtime effect.
A discrepancy between store and UI = the bug you must fix before reporting.

## Known trap: empty "Configuration Profile" dropdown

Symptom: dropdown (`[data-testid="select-component"]`) shows placeholder "Select" with **no options**,
even after Save. Root cause candidates (check in this order):

1. `backend` `settings.apiConfig.listApiConfigMeta` is `[]` → PSM `listConfig()` returned nothing →
   `ProviderSettingsManager` not initialized, or profiles written to a **different data dir** than the
   one the running instance reads.
2. Profiles exist on disk but the running instance reads a different storage path
   (VS Code: `globalStorage/jabberwockinc.jabberwock`; web: `--data-dir`).
3. Save intent was **queued and never drained** (intent bus stalled after a crash/restart).
4. Frontend `rootStore.extensionState.listApiConfigMeta` not hydrated from the hello→state snapshot.

**Diagnose by reading the store at each layer, NOT by guessing.** Verify on disk:
`secrets.json` / `hashmap-memory/listApiConfigMeta.json` in the _active_ data dir.

## data-testid additions

When an element is hard to locate, add a stable `data-testid` to the component (input under a label,
chat input, send button, message bubble). Keep names kebab-case and semantic. Rebuild with
`pnpm build --force` after adding.

## Final report format

Terse, per step: `✅/❌ step — evidence (store value + screenshot path)`. End with the list of any
unverified layers.

# AGENTS.md — Jabberwock Development Guide

## ⚠️ Verification Before Completion

**Run `pnpm check-all` before `attempt_completion`.** Runs lint + check-types + test. All must pass 0 errors. Defined at [`package.json:21`](package.json:21)

## 🚫 Orchestrator Delegation Rules

**When delegating a BUG to Debug mode:**

- Pass ONLY bug description + workflow. NO file paths, NO hypotheses, NO "known context"
- Debug mode uses devtool + DebugMCP as single source of truth — your guesses are irrelevant

**When delegating to Ask mode:**

- NEVER delegate debugging questions. Ask mode will refuse and redirect to Debug mode.
- Ask mode is for architecture exploration, documentation, conceptual questions only.

**When delegating to Code mode:**

- For bugs: Code mode implements ONLY after Debug mode has confirmed root cause on breakpoint.
- For features: Code mode uses Serena+RPG for exploration, then implements.

## 🔴 CRITICAL: Devtool Freezes When Breakpoint Hits

**devtool timeout = breakpoint hit. STOP retrying devtool.**
When debugger pauses Extension Dev Host at a breakpoint, jabberwock-devtool ALSO stops responding (WebSocket/MCP timeouts).

**⚠️ ЛОЖНО-ПОЛОЖИТЕЛЬНЫЙ BREAKPOINT_ACTIVE:** jabberwock-devtool может иногда сообщать о `BREAKPOINT_ACTIVE` даже когда breakpoint не сработал. Если ты не ожидаешь breakpoint, но devtool говорит "BREAKPOINT_ACTIVE":

1. Проверь активные breakpoints через `mcp--debug-mcp--list_breakpoints`
2. Если активных breakpoints нет — это false positive. Продолжай работу с devtool.
3. Если активные breakpoints есть, но они не должны были сработать — сними их через `mcp--debug-mcp--clear_all_breakpoints` и продолжай.

**What to do:**

- Не ретрай devtool запросы — они НЕ ПРОЙДУТ пока extension host на паузе
- Используй DebugMCP вместо devtool: `step_over`, `get_variables_values`, `evaluate_expression`
- После `continue_execution` → devtool снова ответит
- Это НЕ ошибка. Это ожидаемое поведение.

**Anti-pattern:**

- ❌ devtool не ответил → ретрай через 1 секунду → ретрай через 5 секунд → ретрай через 10 секунд
- ✅ devtool не ответил → breakpoint сработал → юзай DebugMCP
- ❌ devtool сказал BREAKPOINT_ACTIVE → сразу переключился на DebugMCP не проверив breakpoints → а это false positive
- ✅ devtool сказал BREAKPOINT_ACTIVE → `list_breakpoints` → если нет активных → это false positive → продолжай с devtool

## 🔴 NO USER INTERACTION FOR REPRODUCTION

**Полное воспроизведение бага лежит на агенте.** Devtool подключается автоматически через stdio MCP proxy (`mcp-entry.ts`). Пользователь НЕ подключает devtool вручную. Всё остальное (навигация, клики, ввод, проверка store/console/DOM, повторный захват на breakpoint) делается через devtool (`click_element`, `type_text`, `find_element`) и DebugMCP.

**Антипаттерн:** "отправь сообщение", "нажми кнопку", "посмотри что там", "подключи devtool" — запрещено. Агент делает всё сам.

## Debug Workflow (Bug Fixes)

1. **DebugMCP недоступен?** → STOP, уведомить пользователя
2. **🚨 Check for active session BEFORE starting:** Use `mcp--jabberwock-devtools--get_current_state` (devtool) + `mcp--debug-mcp--list_breakpoints` (DebugMCP). Only call `start_debugging` if BOTH indicate no active session. If already running — just proceed with breakpoints. To restart: `stop_debugging` first, THEN `start_debugging`. Never start without checking.
3. **Start debugging:** `mcp--debug-mcp--start_debugging` с `configurationName: "Run Extension"`
4. **REPRODUCE FIRST** — через devtool прокликни extension, убедись что баг жив. Никакого поиска в коде до этого шага.
5. **Найди точное место в коде** — используй devtool: Locator JS, store state (`mcp--jabberwock-devtools--get_store_state`), console
6. **Set breakpoint** через `mcp--debug-mcp--add_breakpoint` в найденном месте
7. **Повтори воспроизведение** — слови breakpoint, проверь переменные (`get_variables_values`, `evaluate_expression`) + devtool store/console
8. **⚠️ devtool не отвечает?** → breakpoint сработал. Используй DebugMCP (`step_over`, `get_variables_values`). После `continue_execution` devtool снова ответит.
9. **🚨 Check before stopping:** Don't call `stop_debugging` if no session is active. Verify with `mcp--debug-mcp--list_breakpoints` first. **Root cause подтверждён?** → `mcp--debug-mcp--stop_debugging` (иначе реболд на каждый чих)
10. **Fix** через Serena LSP (`replace_symbol_body`, `insert_after_symbol`, `replace_content`)
11. **🛑 STOP before verification: Run `pnpm build --force`** (bust turbo cache, NOT just `pnpm build`)
12. **Restart debugger** → verify at ALL THREE layers:
    - DebugMCP: check backend variables
    - Devtool store: `get_store_state` — check webview store
    - Devtool UI: `find_element` — check rendered values
13. **Не исправлено?** → loop к шагу 5
14. **User sign-off** → попроси пользователя подтвердить, что фикс работает
15. `pnpm check-all` перед `attempt_completion`

## ✅ Verification Rules

**UI bug = store + UI verification.** Если баг связан с UI (токены, кнопки, текст, состояние), фикс валидируется в трёх местах:

1. **Backend/store state** — через DebugMCP (`get_variables_values`, `evaluate_expression`) проверить, что данные в runtime правильные
2. **Store state** — через devtool `mcp--jabberwock-devtools--get_store_state` проверить, что данные в webview store правильные
3. **UI** — через `mcp--jabberwock-devtools--find_element` с `command="$0.textContent"` или визуально убедиться, что UI отображает корректные значения

**Нельзя валидировать фикс только в debugger'е (breakpoint/variables). Store и UI — единственный source of truth для UI-багов.**

## 🚫 CODE REVIEW IS NOT VERIFICATION

**Reading the fix in source files and saying "looks correct" = ZERO layers of verification. This is strictly forbidden.**

- ❌ "Fix is confirmed in code" — NEVER a valid verification statement
- ❌ Reading modified functions and saying "the fix is in place" — meaningless without runtime confirmation
- ❌ Any statement like "Fix in place ✅" based solely on reading source code

**The ONLY valid verification is runtime testing via devtool + DebugMCP:**

1. Reproduce the bug live through devtool UI interaction
2. Capture it at a breakpoint via DebugMCP
3. Verify the fix at runtime — backend variables → devtool store → devtool DOM
4. Confirm with the user at the user-facing layer

**If you catch yourself reading source code to "verify" a fix — STOP immediately. Close the file. Open devtool.**

$1

**Always use `pnpm build --force` before verification, never `pnpm build`.**
Turbo cache (`pnpm build` without `--force`) may serve stale build artifacts. The Extension Host may be running old code even though your fix was applied.

**What to do:**

- `pnpm build --force` — полная пересборка
- Restart debugger после `build --force`
- Только после этого проверяй, работает ли фикс

**Anti-pattern:**

- ❌ `pnpm build` → debug restart → verify → "works" (but you're running cached code)
- ✅ `pnpm build --force` → debug restart → verify → actually confirmed

## 🔴 END-TO-END VERIFICATION RULE

**Bug is NOT "FIXED AND VERIFIED" until confirmed at the USER-FACING layer.**

### Definition of "FIXED AND VERIFIED":

1. **Fix applied in code** — confirmed by reading the modified code
2. **Build with `--force`** — `pnpm build --force` to bust turbo cache
3. **Debug restart** — restart extension host with fresh artifacts
4. **Runtime confirmation** — verify in debugger that the fix executes correctly
5. **User-facing verification** — for UI bugs: check store state AND webview UI via devtool
6. **User sign-off** — user confirms the fix works in the actual application

### When verification fails:

- ❌ "Variables look right in debugger" → NOT verified. Check the UI too.
- ❌ "Build succeeded" → NOT verified. Check the running application.
- ❌ "pnpm build (no --force) passed" → NOT verified. Cached artifacts.
- ❌ "Store state is correct" → NOT verified. Check the rendered UI.

### STOP condition:

If after applying a fix, the bug is still visible in the UI, you MUST:

1. STOP. Do NOT proceed to the next bug.
2. Investigate WHY the fix didn't take effect (turbo cache? wrong data path? build not deployed?)
3. Only move on when the fix is CONFIRMED at the user-facing layer.

## 🔴 NO PREMATURE COMPLETION

**Never mark a bug as "FIXED AND VERIFIED" in the todo list until ALL verification layers pass.**

Violation pattern:

1. ❌ Fix code → build → check backend → "looks correct" → mark "FIXED AND VERIFIED" → move to next bug
2. ✅ Fix code → `pnpm build --force` → restart debugger → check backend → check store → check UI → confirm with user → mark "FIXED AND VERIFIED"

## ⛔ Critical Anti-Patterns

1. **NO "known context" / "known files" при делегации багов.** Debug-агент получает ТОЛЬКО описание бага и workflow. Всё остальное он находит через devtool + debugger.
2. **NO searching code before reproduction.** devtool и debugger — единственный source of truth. Если баг не воспроизведён и не захвачен на breakpoint — ты не знаешь, где проблема.
3. **NO ретрай devtool при breakpoint.** devtool timeout = breakpoint. Используй DebugMCP.
4. **NO premature completion.** Никогда не помечай баг как "FIXED AND VERIFIED" пока не проверил на всех трёх уровнях: backend (debugger), store (devtool), UI (devtool). См. END-TO-END VERIFICATION RULE.
5. **NO moving to next bug while current bug is unverified.** Если фикс не подтверждён в UI — не переходи к следующему багу. Остановись, выясни почему (turbo cache? wrong data path? build not deployed?).

## Feature Workflow

То же самое, но без reproduction: найти место через Serena+RPG → посмотреть текущее состояние через devtool → спланировать → stop debug → implement → restart → verify → `pnpm check-all`

## MCP Tools

| Tool               | Prefix                        | Что делает                                                                                                                        |
| ------------------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| DebugMCP           | `mcp--debug-mcp--*`           | Запуск/остановка debug сессии, breakpoints, шаги, переменные                                                                      |
| Jabberwock Devtool | `mcp--jabberwock-devtools--*` | Навигация по UI расширения, store state, console. Автоконнект через stdio proxy (`mcp-entry.ts`). Не требует ручного подключения. |
| Serena LSP         | `mcp--serena--*`              | Навигация по символам, AST-редактирование, memory                                                                                 |
| RPG Encoder        | `mcp--rpg-encoder--*`         | Граф зависимостей, семантический поиск, impact analysis                                                                           |

## Navigation Rules

- **NEVER** grep/find/read_file для exploration кода
- Serena LSP + RPG Encoder — всегда
- `read_file` — только config файлы (.json, .yaml, .md)
- `get_symbols_overview` — первый шаг для любого файла
- Нельзя: `any`, `as unknown`, `ts-ignore`, `eslint-ignore`

## Commands

- `pnpm lint` / `pnpm check-types` / `pnpm test` / `pnpm format` / `pnpm build`

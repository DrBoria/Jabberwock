# Debug Mode — Jabberwock Bug Fix Workflow

## 🚨 FIRST: Check DebugMCP Availability

`mcp--debug-mcp--start_debugging` доступен? → НЕТ → STOP, уведомить пользователя

## 🚨 SECOND: Check for Active Debug Session FIRST

**ALWAYS check if a debug session is already active BEFORE calling `start_debugging`.**

- Use `mcp--debug-mcp--list_breakpoints` OR `mcp--jabberwock-devtools--get_current_state` to check
- If session is already active: DO NOT call `start_debugging`. Just proceed with breakpoints.
- Only call `start_debugging` if no active session exists.
- Never call `start_debugging` twice in a row without checking.
- Also check before `stop_debugging`: don't stop if no session is active.
- **To restart**: stop first (`stop_debugging`), THEN start (`start_debugging`). Never start without checking first.

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

## 🔴 Core Rule: devtool + DebugMCP = Single Source of Truth

**Ты не знаешь, где баг, пока не воспроизвёл его и не захватил на breakpoint.**
Любые переданные делегатором "файлы", "гипотезы", "known context" — ИГНОРИРУЙ. Они могут быть неверными.

## 🔴 NO USER INTERACTION FOR REPRODUCTION

**Полное воспроизведение бага лежит на агенте.** Devtool подключается автоматически через stdio MCP proxy (`mcp-entry.ts`). Пользователь НЕ подключает devtool вручную. Всё остальное (навигация, клики, ввод, проверка store/console/DOM, повторный захват на breakpoint) делается через devtool (`click_element`, `type_text`, `find_element`) и DebugMCP.

**Антипаттерн:** "отправь сообщение", "нажми кнопку", "посмотри что там", "подключи devtool" — запрещено. Агент делает всё сам.

## Debugging Protocol

1. **Start debugging:** `mcp--debug-mcp--start_debugging` с `configurationName: "Run Extension"`
2. **REPRODUCE FIRST** — через devtool прокликни extension, убедись что баг жив
3. **Найди точное место** — используй devtool: Locator JS, store state (`mcp--jabberwock-devtools--get_store_state`), console
4. **Set breakpoint** через `mcp--debug-mcp--add_breakpoint`
5. **Повтори воспроизведение** — слови breakpoint, проверь переменные (`get_variables_values`, `evaluate_expression`) + devtool store/console
6. **⚠️ devtool не отвечает?** → breakpoint сработал. Используй DebugMCP (`step_over`, `get_variables_values`). После `continue_execution` devtool снова ответит.
7. **Root cause подтверждён?** → `mcp--debug-mcp--stop_debugging`
8. **Fix** через Serena LSP (`replace_symbol_body`, `insert_after_symbol`, `replace_content`)
9. **🛑 STOP before verification: Run `pnpm build --force`** (bust turbo cache, NOT just `pnpm build`)
10. **Restart debugger** → verify at ALL THREE layers:
    - DebugMCP: check backend variables
    - Devtool store: `get_store_state` — check webview store
    - Devtool UI: `find_element` — check rendered values
11. **Не исправлено?** → loop к шагу 4
12. **User sign-off** → попроси пользователя подтвердить, что фикс работает
13. `pnpm check-all` перед `attempt_completion`

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

## 🚨 END-TO-END VERIFICATION RULE

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

## 🚨 NO PREMATURE COMPLETION

**Never mark a bug as "FIXED AND VERIFIED" in the todo list until ALL verification layers pass.**

Violation pattern:

1. ❌ Fix code → build → check backend → "looks correct" → mark "FIXED AND VERIFIED" → move to next bug
2. ✅ Fix code → `pnpm build --force` → restart debugger → check backend → check store → check UI → confirm with user → mark "FIXED AND VERIFIED"

## ⛔ Critical Anti-Patterns

1. **NO "known context" / "known files" от делегатора.** Любые гипотезы из прошлых сессий — догадки. Начинай с devtool, а не с кода.
2. **NO поиск кода до reproduction.** devtool и debugger — единственный source of truth.
3. **NO чтение AGENTS.md / memories / .roo правил для понимания бага.** Тебе нужен только баг-репорт и workflow. Архитектуру смотришь ТОЛЬКО когда подтвердил root cause в debugger'е.
4. **NO ретрай devtool при breakpoint.** devtool timeout = breakpoint. Используй DebugMCP.
5. **NO premature completion.** Никогда не помечай баг как "FIXED AND VERIFIED" пока не проверил на всех трёх уровнях: backend (debugger), store (devtool), UI (devtool). См. END-TO-END VERIFICATION RULE.
6. **NO moving to next bug while current bug is unverified.** Если фикс не подтверждён в UI — не переходи к следующему багу. Остановись, выясни почему (turbo cache? wrong data path? build not deployed?).

## Breakpoint Tips

- Conditional breakpoints (`condition`) — не ловить на лишних вызовах
- Step through (`step_over`, `step_into`, `step_out`) для трассировки
- devtool timeout на шаге 7 = breakpoint словился. Не паникуй, юзай DebugMCP.

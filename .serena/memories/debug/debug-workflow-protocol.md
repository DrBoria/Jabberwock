# Debug Workflow Protocol

## Tools

1. **DebugMCP** (`mcp--debug-mcp--*`) — запуск/остановка debug, breakpoints, шаги, переменные
2. **Jabberwock Devtool** — MCP proxy (command-based via `mcp-entry.ts`), автоконнект к extension по запросу: навигация по UI, store state, console

## CRITICAL

### BEFORE STARTING DEBUGGING: ALWAYS check for active session

**CRITICAL**: Do NOT call `mcp--debug-mcp--start_debugging` without first checking if session is active.

1. Check devtool: `mcp--jabberwock-devtools--get_current_state()` → if responds, extension IS running
2. Check DebugMCP: `mcp--debug-mcp--list_breakpoints()` → if succeeds (even empty), session IS active
3. Only call `start_debugging` if BOTH indicate no session
4. To restart: stop first (`stop_debugging`), then start (`start_debugging`)

### BEFORE STOPPING DEBUGGING: Check if session is active

- Don't call `stop_debugging` if no session is active — prevents killing the extension host

### General

1. **DebugMCP недоступен?** → STOP, уведомить пользователя → STOP, уведомить пользователя
2. **start_debugging** ВСЕГДА с `configurationName: "Run Extension"` — иначе node запустится и упадёт
3. **Devtool автоконнект** — не надо ждать пользователя, devtool подключается автоматически через stdio proxy
4. **Root cause найден?** → stop_debugging (иначе реболд на каждый чих)
5. **NO "known context"/"known files" в delegation.** Предыдущие исследования — догадки, не факты. Debug находит всё через devtool + debugger.
6. **REPRODUCE FIRST.** Баг не воспроизведён = ты не знаешь где проблема. devtool + debugger — единственный source of truth.

## 🔴 NO USER INTERACTION FOR REPRODUCTION

**Полное воспроизведение бага лежит на агенте.** Devtool подключается автоматически через stdio MCP proxy. Пользователь НЕ подключает devtool вручную.
Всё остальное:

- Навигация по UI расширения
- Отправка сообщений, клики, ввод текста
- Проверка store, console, DOM
- Воспроизведение сценария для повторного захвата на breakpoint

Всё делается через devtool (`click_element`, `type_text`, `find_element`) и DebugMCP. Пользователь не обязан ничего делать.

**Антипаттерн:** "отправь сообщение", "нажми кнопку", "посмотри что там", "подключи devtool" — запрещено.

## Bug Fix Workflow

1. Проверить DebugMCP
2. start_debugging с configurationName: "Run Extension"
3. **REPRODUCE FIRST** — через devtool прокликни extension, убедись что баг жив
4. **Найди точное место** — devtool Locator JS или store state, чтобы определить компонент/функцию
5. **Set breakpoint** в найденном месте
6. **Повтори воспроизведение** — слови breakpoint, проверь переменные + devtool store/console
7. ⚠️ devtool не отвечает? → breakpoint сработал, юзай DebugMCP (step_over, get_variables_values)
8. Root cause → stop_debugging
9. Fix через Serena LSP (replace_symbol_body, insert_after_symbol, replace_content)
10. **🛑 `pnpm build --force`** (bust turbo cache — НЕ `pnpm build`)
11. start_debugging → verify на трёх уровнях:
    - DebugMCP: backend переменные
    - devtool store: get_store_state
    - devtool UI: find_element (rendered values)
12. Не исправлено? → loop к шагу 5
13. User sign-off → подтверждение от пользователя
14. pnpm check-all перед attempt_completion

## Feature Workflow

То же без reproduction: найти место (Serena+RPG) → devtool посмотреть текущее состояние → спланировать → stop debug → implement → restart → verify

## Verification

- pnpm check-all (lint + types + tests) + функционал рабочий в devtool = задача выполнена

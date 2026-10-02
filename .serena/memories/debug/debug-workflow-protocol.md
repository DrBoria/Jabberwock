# Debug Workflow Protocol

## Tools

1. **DebugMCP** (`mcp--debug-mcp--*`) — запуск/остановка debug, breakpoints, шаги, переменные
2. **Jabberwock Devtool** — MCP proxy (command-based via `server.ts` (in mcp-entry/)), автоконнект к extension по запросу: навигация по UI, store state, console

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

### Когда Devtool сообщает DISCONNECTED / активной сессии нет

**НЕ ретрай `start_debugging` сразу.** Мёртвая сессия обычно оставляет за собой stale-терминалы — убитые пользователем или упавшие посреди запуска (например, TypeScript error в build task). Реальная ошибка сидит в их выводе. Сначала диагностируй, потом перезапускай.

Что один запуск **"Run Extension"** поднимает (`preLaunchTask` = default build task **watch**, 4 терминала):

- `build:webview`: `pnpm --filter @jabberwock/frontend build` — foreground
- `build:extension`: `pnpm --filter jabberwock bundle` (= из backend/, `node esbuild.mjs`) — foreground; TS/bundle error здесь роняет preLaunchTask → extension host вообще не стартует
- `watch:tsc`: через `pnpm --filter jabberwock watch:tsc`, запускает repo-root'овый `tsc --noEmit --watch -p backend/tsconfig.json` — background watcher, **обычное место падения TypeScript** (красные diagnostics остаются в этом терминале)
- `watch:bundle`: `node esbuild.mjs --watch` — background

Процедура восстановления (агент делает всё сам):

1. **Найди stale процессы** через serena shell: `ps aux | grep -E "extensionDevelopmentPath|ExtensionDevHost"` для осиротевших dev host окон; также ищи осиротевшие watchers (`esbuild.mjs --watch`, `tsc --noEmit --watch`). Сначала список PID, потом точечный kill — без blind pkill.
2. **Прочитай ошибки в терминальных сессиях.** Если launch-терминалы видны в UI VS Code — читай их вывод (TypeScript diagnostics, esbuild failures). Когда devtool отключён и читать нечего — воспроизведи: запусти one-shot эквиваленты через serena shell — `pnpm exec tsc --noEmit -p backend/tsconfig.json` из repo root и/или `node esbuild.mjs` из backend/. Те же ошибки вылезут в вывод.
3. **Закрой/убей** stale-терминалы + осиротевшие процессы, найденные выше.
4. **Исправь ошибку при необходимости.** Очевидный compile/bundle failure → чини напрямую (implementation). Баг с неизвестным root cause → делегируй Debug mode по правилам AGENTS.md, без "known context".
5. **Перезапусти debugger**: debug mode → `start_debugging` c `configurationName: "Run Extension"`; code mode сам НЕ вызывает start_debugging — попроси пользователя F5/launch (или передай шаг в Debug). Потом проверь перед продолжением: devtool `get_current_state()` отвечает и extension host жив.

**Антипаттерн:** DISCONNECTED → ретрай `start_debugging` циклом, пока stale watchers/dev hosts держат состояние; или убить терминалы не прочитав их вывод — реальная ошибка теряется.

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

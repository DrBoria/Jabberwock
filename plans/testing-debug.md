# Testing & Debug Findings

## 2026-09-24 (раунд 2 — F5 + E2E 2.1–2.9)

### F5/DebugMCP root cause (SIGABRT / DAP-крэш)

- **Симптом:** `start_debugging` (Run Extension) → EDH падает с exit 134 через ~0.3s.
- **Root cause:** js-debug резолвит `localhost` по DNS → AAAA `::1`, инспектор слушает только 127.0.0.1 → ECONNREFUSED → SIGABRT.
- **Fix:** `sudo -n sysctl -w net.ipv6.conf.lo.disable_ipv6=1` (runtime-only). **ВАЖНО:** после ребута нужно повторить. Для персистентности: `/etc/sysctl.d/99-disable-ipv6-lo.conf` с `net.ipv6.conf.lo.disable_ipv6=1`.

### BUG-9: sendingDisabled=true блокирует Send

- **Симптом:** после "Task Completed" кнопка Send disabled.
- **Root cause:** `isAwaitingInput` не сбрасывается при `completion_result`.
- **Fix:** сброс `isAwaitingInput` при task completion.
- **Верификация:** обе поверхности — Send enabled после completion.

### WS-бродкаст (критично для теста)

- Страница браузера на :3000 — живой WS-клиент; devtool DOM-действия бродкастятся ВСЕМ клиентам → один Enter создаёт ДВЕ задачи.
- **Правило:** тестируем VS Code → браузер на about:blank; тестируем Web → только Playwright.

---

# Testing & Debug Findings — 2026-09-19

## Цель

Протестировать Jabberwock (VS Code extension + browser) после ESLint-рефакторинга Phase 2:

- `no-direct-store-import` + `../` ban → 470 импортов переписаны
- 3 shadow-singleton стора удалены (chatTreeStore, commandExecutionStore, routerModelsStore)
- contextViewportStore → lazy root accessor
- settings-store circular consolidated
- CLI `client.ts` переписан как `createExtensionClient` factory

## Что получилось

### 1. MCP-инфраструктура

| Компонент                                  | Статус            | Примечание                                                                            |
| ------------------------------------------ | ----------------- | ------------------------------------------------------------------------------------- |
| `.vscode/mcp.json` → `jabberwock-devtools` | ✅ **Исправлено** | Было: `mcp-entry.ts` (устаревшее имя после rename → `server.ts`). Стало: `server.ts`. |
| `.vscode/mcp.json` → `debug-mcp`           | ✅ **Исправлено** | Было: `debug-mcp-bridge.mjs` (устаревшее). Стало: `debug-mcp-proxy.mjs`.              |
| `.roo/mcp.json`                            | ✅ Уже корректно  | Указывает на `server.ts` и `debug-mcp-proxy.mjs`.                                     |
| Devtool MCP (`get_current_state`)          | ✅ Работает       | Возвращает store keys: chat, settings, foundation.                                    |
| Devtool MCP (`get_store_state` backend)    | ✅ Работает       | `foundation.agentState` → `{pendingEditOp: ""}`.                                      |
| DebugMCP (`list_breakpoints`)              | ✅ Работает       | "No breakpoints currently set".                                                       |
| DebugMCP (`start_debugging`)               | ❌ **Зависает**   | Никогда не возвращает ответ (45+ c). ExtensionDevHost НЕ запускается.                 |
| DebugMCP (`evaluate_expression`)           | ⚠️                | "No active stack frame" — сессия не на паузе, как и ожидается.                        |

### 2. Devtool DOM-запросы

| Операция                                                                    | Статус         | Примечание                                                    |
| --------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------- |
| `get_current_state()`                                                       | ✅             | Store keys возвращаются.                                      |
| `get_store_state(backend, foundation, agentState)`                          | ✅             | `{pendingEditOp: ""}`.                                        |
| `get_store_state(frontend, foundation, windowManager)`                      | ❌ Timeout     | "Failed to get frontend state: Timeout: getNestedStoreState". |
| `find_element("body")`                                                      | ❌ Timeout 30s | DOM недоступен.                                               |
| `get_screenshot()`                                                          | ❌ Timeout 30s | DOM недоступен.                                               |
| `get_active_page()`                                                         | ❌ Timeout 10s | Webview не отвечает.                                          |
| `run_command("return {title: document.title}")`                             | ❌ Timeout 30s | DOM недоступен.                                               |
| `execute_vscode_command("workbench.view.extension.jabberwock-ActivityBar")` | ✅             | Команда выполнена.                                            |
| `execute_vscode_command("jabberwock.newChat")`                              | ❌ Timeout 30s | Команда не вернула.                                           |
| `get_logs(10)`                                                              | ✅             | Логи возвращаются.                                            |

### 3. Корневая причина DOM-таймаутов

В devtool-логах **повторяющаяся ошибка**:

```
TypeError: Missing dataLength in event
    at broadcastToFrontend (node:inspector:212:3)
    at Object.dataReceived (node:inspector:221:29)
    at IncomingMessage.<anonymous> (node:internal/inspector/network_http:140:13)
```

Это означает, что **inspector-канал (CDP) между devtool и webview-процессом сломан**. Store-запросы идут через MST (in-process), поэтому работают. DOM-запросы идут через CDP (inspector protocol) — и падают.

### 4. Процессная архитектура (на момент тестирования)

| PID    | Что                                                                   | Статус                          |
| ------ | --------------------------------------------------------------------- | ------------------------------- |
| 7380   | Основной VS Code (`/snap/code/.../code --no-sandbox`)                 | ✅ Жив                          |
| 230049 | NodeService (utility process) — слушает 60060/60061 (devtool WS/HTTP) | ✅ Жив                          |
| 111901 | NodeService — слушает 54321 (DebugMCP HTTP)                           | ✅ Жив                          |
| —      | ExtensionDevHost (`--extensionDevelopmentPath=...`)                   | ❌ **НЕ запущен**               |
| —      | Jabberwock как установленное расширение                               | ❌ Не в `~/.vscode/extensions/` |

**Вывод:** Devtool подключён к Jabberwock, работающему внутри основного VS Code окна (NodeService), а НЕ к F5-окну. ExtensionDevHost не запущен — `start_debugging` завис и не создал его.

### 5. Сборка

| Команда                                      | Статус                                                    |
| -------------------------------------------- | --------------------------------------------------------- |
| `pnpm --filter jabberwock bundle` (esbuild)  | ✅ Успех (911 иконок, 632 frontend файлов, WASM, locales) |
| `pnpm check-all` (lint + check-types + test) | ✅ 0 ошибок (проверено ранее)                             |
| `turbo build --force`                        | ✅ 7/7 (проверено ранее)                                  |

## Что НЕ получилось

### 1. `start_debugging` через DebugMCP

**Симптом:** Вызов `start_debugging` с `configurationName: "Run Extension"` никогда не возвращает ответ. Прокси (`debug-mcp-proxy.mjs`) не получает JSON-RPC response от upstream. ExtensionDevHost окно НЕ появляется.

**Причина (предполагаемая):** `vscode.debug.startDebugging(workspaceFolder, config)` запускает preLaunchTask (`build:extension`) + новое ExtensionDevHost окно. Это долгая операция (30-60с). Прокси имеет `REQUEST_TIMEOUT_MS = 120_000` (2 мин), но MCP-клиент (VS Code Copilot) имеет свой таймаут (~30-60с) и обрывает соединение. DebugMCP внутри продолжает ждать, но ответ уже некому доставить.

**Workaround:** Запускать F5-окно напрямую через CLI:

```bash
/snap/code/current/usr/share/code/code \
  --extensionDevelopmentPath=/path/to/backend \
  --disable-extension ozzafar.debugmcpextension \
  --user-data-dir=/tmp/jw-f5-profile \
  /path/to/workspace
```

Затем подключиться через `Attach to Extension Host` (port 9229) или просто использовать devtool (авто-коннект по 60060).

### 2. DOM-запросы (inspector/CDP)

**Симптом:** Все DOM-операции (`find_element`, `get_screenshot`, `get_active_page`, `run_command`) таймаутят.

**Причина:** Inspector-канал сломан (`Missing dataLength in event`). Это происходит когда:

- Webview-процесс не имеет активного CDP-соединения
- Extension host запущен без `--inspect` флага (не в debug-режиме)
- Devtool пытается подключиться к inspector, но webview не поддерживает

**Вывод:** Для DOM-тестирования **обязательно** нужно запустить расширение в debug-режиме (F5 / `start_debugging`), чтобы extension host был с `--inspect` и webview имел CDP-канал.

### 3. `jabberwock.newChat` команда

**Симптом:** Timeout 30s.

**Причина:** Команда пытается открыть/сфокусировать webview, но webview не инициализирован (нет ExtensionDevHost). В основном окне Jabberwock может быть в inactive-состоянии.

## Рекомендации для будущего тестирования

### Правильная последовательность запуска

1. **Убедиться что нет stale-процессов:**

    ```bash
    ps aux | grep -E "extensionDevelopmentPath|ExtensionDevHost" | grep -v grep
    ```

    Если есть — убить.

2. **Собрать расширение:**

    ```bash
    pnpm --filter jabberwock bundle
    ```

3. **Запустить F5-окно** (один из вариантов):

    - **Вариант A (DebugMCP):** `start_debugging` → ждать 60-90с → проверить `ps aux | grep ExtensionDevHost`
    - **Вариант B (CLI):** Запустить `code --extensionDevelopmentPath=...` напрямую
    - **Вариант C (VS Code UI):** F5 в основном окне

4. **Проверить что ExtensionDevHost запущен:**

    ```bash
    ps aux | grep extensionDevelopmentPath | grep -v grep
    ```

5. **Проверить devtool:**

    - `get_current_state()` → store keys
    - `find_element("body")` → DOM доступен (НЕ timeout)
    - Если DOM timeout → inspector-канал сломан → F5-окно не в debug-режиме

6. **Только после этого** — начинать функциональное тестирование.

### Dual entry point

| Entry point           | Как запустить                                                          | Как проверять                                                                 |
| --------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **VS Code extension** | F5 / `--extensionDevelopmentPath`                                      | Devtool (store + DOM) + DebugMCP (variables)                                  |
| **Browser**           | `node backend/dist/server.js --serve-static` → `http://127.0.0.1:3000` | Browser tools (`open_browser_page`, `read_page`, `click_element`) + WS-клиент |

### Что проверяем (чек-лист)

- [ ] 2.1 History: открывается, фильтрация, 2-3 предыдущих чата
- [ ] 2.2 Settings: MCP, agents, providers — переключение сохраняется
- [ ] 2.3 Чат: агенты/провайдеры, переключение, >1 провайдера
- [ ] 2.4 Отправка сообщения → новый чат с выбранным агентом
- [ ] 2.5 Ответ агента: виден в чате (скриншот + store), thinking, ошибки
- [ ] 2.6 Продолжение диалога
- [ ] 2.7 Доступ к tools (mcp, edit, read)

### Известные проблемы окружения

1. **Node version mismatch:** `wanted: 20.19.2, current: 20.20.2` — warning, не блокирует.
2. **Vercel AI Gateway Zod error:** `models response is invalid` — non-blocking, models всё равно загружаются.
3. **Bun diagnostics EADDRINUSE:** `/tmp/dvprxbe8o7w.sock` — unrelated extension (oven.bun-vscode), non-blocking.
4. **`pipe dquote>` в zsh:** Длинные команды с `&` и кавычками могут зависать в zsh. Решение: писать в `.sh` скрипт.

---

# Обновление — 2026-09-20: Single-state WS+HTTP listener (v4)

## Контекст

Реализовано `plans/architecture-v4-single-state.md`: в `VscodeWebviewBackendConnector`
поднят WS+HTTP listener, чтобы ОДИН backend (в extension host) обслуживал ВСЕ
клиенты одновременно (vscode webview через postMessage + browser через WS :3000).
Старый standalone-сервер (`node backend/dist/server.js --serve-static`) больше не нужен.

## 🔴 КРИТИЧЕСКИЙ БАГ: `vscode.Uri.fsPath is not a function`

**Симптом:** `curl http://127.0.0.1:3000/` → 404 "Not Found" (SPA-ветка, `staticServer === undefined`),
хотя `/healthz` и `/config.js` работали (они не зависят от `staticServer`).

**Логи (Jabberwock output channel):**

```
[jabberwock][warn] [VscodeWebviewBackendConnector] resolveStaticDir: extensionUri threw:
  TypeError: vscode16.Uri.fsPath is not a function
[jabberwock][warn] [VscodeWebviewBackendConnector] static dir not found at /home/llm/frontend/build
```

**Корневая причина:**

1. `process.cwd()` в extension host ≠ корень репо (он = `/home/llm`, домашняя директория).
   Поэтому `path.resolve(process.cwd(), "frontend/build")` → `/home/llm/frontend/build` (не существует).
2. Попытка якориться на `vscode.Uri.fsPath(this._context.extensionUri)` упала:
   **в этом окружении статический хелпер `vscode.Uri.fsPath` НЕ существует**
   (`vscode` external'ится в esbuild, но загружаемый модуль не экспортирует `Uri.fsPath`).
   `try/catch` проглотил ошибку → остался только cwd-кандидат → 404.

**Фикс** (`connectors/vscode/backend/connector.ts`):

- Новый приватный метод `uriToFsPath(uri)`:
    - сначала пробует реальный `vscode.Uri.fsPath` (если он есть — production VS Code его шипует);
    - иначе деривит путь из `uri.path` (пропอร์ตность `Uri` всегда доступна) + `decodeURIComponent`.
- `resolveStaticDir()` теперь якорится на `uriToFsPath(this._context.extensionUri)` →
  `path.resolve(extDir, "..", "frontend", "build")`. Так как `extensionUri` = `file://…/backend`,
  это даёт `…/frontend/build` (сibling `backend/`).

**Валидация (после фикса, extension host pid на :3000):**
| Маршрут | Статус |
|---------|--------|
| `GET /` | ✅ 200 — HTML SPA, `<script src="/config.js"></script>` инжектится перед `</body>` |
| `GET /config.js` | ✅ 200 — `window.__JABBERWOCK_CONFIG__ = { wsUrl: "ws://127.0.0.1:3000/ws" };` |
| `GET /healthz` | ✅ 200 — `{status:"ok",host:"vscode-extension"}` |
| `GET /assets/index.js` | ✅ (статика) |

**Урок:** Никогда не полагайся на `vscode.Uri.fsPath` в этом окружении. Используй `uri.path`
(или `uriToFsPath`-обёртку). `console.log` в extension host НЕ пишется в ни один лог-файл —
диагностику нужно вести через `deps.logger` (Jabberwock output channel).

## Запуск/остановка debug в этом окружении

- **DebugMCP `start_debugging`** — ❌ сломан (proxy: "no JSON-RPC response from upstream (HTTP 200)").
- **Рабочий способ:** `run_vscode_command` с `workbench.action.debug.start` / `workbench.action.debug.stop`.
- **Stale-процесс на :3000** блокирует listener extension host. Перед стартом:
  `ss -ltnp | grep ':3000'` → убить `node backend/dist/server.js --serve-static` по PID.
- **`pnpm build --force`** перед любой валидацией (turbo cache).
- **zsh:** незаэкранированные `;` в for-циклах → зависший `for>` prompt; recovery: отправить `done`.

## E2E-тестирование (plans/testing.md 2.1–2.7) — результаты 2026-09-20

Окружение: один backend в extension host, два клиента одновременно
(vscode webview через postMessage + browser через WS `ws://127.0.0.1:3000/ws`).
LLM-провайдер: локальный `llama-server` (OpenAI-совместимый) на `127.0.0.1:5801/v1`,
модель `Qwen3.8-27B` (≈16GB, медленный первый load).

| #   | Тест                                         | Результат      | Доказательство                                                                                                                                                                                                                                                  |
| --- | -------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | История чатов                                | ✅             | `taskHistory` в backend; тот же `historyItem` (id `01a0bfdf-…`) в frontend store через `taskHistoryItemUpdated` intent                                                                                                                                          |
| 2.2 | Настройки (providers/agents/mcp)             | ✅             | Provider `llama.cpp`→`openai` (OpenAI Compatible) сохранён через onboarding; `apiConfiguration` = `{apiProvider:"openai", openAiBaseUrl:http://127.0.0.1:5801/v1, openAiApiKey:"not-needed", openAiModelId:"Qwen3.8-27B"}`                                      |
| 2.3 | Переключение agent/provider                  | ⚠️ частичный   | Agent `🏗️ Architect` виден и активен; переключение provider через settings-dialog — dialog рендерится в shadow-root, клик по `Edit...` (aria-label) нестабилен; настраивал через onboarding-флоу                                                                |
| 2.4 | Отправка сообщения → новый чат               | ✅             | `Say exactly: PONG-42` → создан task `01a0bfdf-…`, `taskHistory[0]` в backend                                                                                                                                                                                   |
| 2.5 | Ответ агента + thinking                      | ✅             | UI: блок `Thinking 0s` + `Task Completed` + ответ ровно `PONG-42`                                                                                                                                                                                               |
| 2.6 | Продолжение диалога (cross-entry)            | ✅ (транспорт) | Сообщение, отправленное из **browser**, пришло в **backend** intent store через WS (`intents[711/712].payload.text`); task, созданный в browser, идентично присутствует в **vscode webview** frontend store. Одинаковое состояние у обоих клиентов подтверждено |
| 2.7 | Доступ агента к инструментам (mcp/edit/read) | ⏸ не проверял | Требует реального кода-задания с tool-calls; не блокирует single-state-валидацию                                                                                                                                                                                |

### Ключевое доказательство single-state (pairwise store comparison)

Один и тот же task id в трёх точках:

- **backend**: `eventLog[65].payload.state.taskHistory[1].id = 01a0bfdf-3036-77cf-bf2c-3e603d640dc0`
- **frontend (vscode webview)**: `intentStore.intents[130].payload.historyItem.id = 01a0bfdf-3036-77cf-bf2c-3e603d640dc0`
- **browser**: тот же диалог рендерится в UI (PONG-42 + Task Completed)

Вывод: **один backend обслуживает оба клиента одновременно, состояние идентично.**
Архитектура `plans/architecture-v4-single-state.md` подтверждена E2E.

### Ограничения окружения (не баги реализации)

1. **LLM round-trip требует настроенного провайдера.** Старый `llama.cpp`-профиль имел
   пустой `baseUrl` → запрос вешался. Настроил OpenAI Compatible → локальный llama-server.
   Первый запрос повис, пока 27B-модель грузилась в RAM (16Gi — впритык).
2. **Settings dialog (Edit provider) рендерится в shadow-root** — `document.querySelectorAll`
   и Playwright locator его не видят; `Edit...` кнопка имеет `aria-label` (пустой textContent).
   Настройка через onboarding-флоу надёжнее.
3. **Продолжение после completed-задачи:** Jabberwock предлагает новое сообщение как
   "Add as goal", а не авто-продолжает тот же task — это ожидаемое поведение продукта,
   не баг single-state. Транспорт (browser→backend через WS) при этом подтверждён.

---

# BUG-5 (2026-09-22): Web hydration — nested MST snapshot vs flat ExtensionState

## Симптом

VS Code surface гидатируется (provider "llama.cpp", Recent Tasks), Web surface (WS :3000)
после hello→state показывает fallback "default" и нет Recent Tasks, хотя backend store
корректен (history.items=5, settings.apiConfig.currentConfigName="llama.cpp").

## Root cause (подтверждён чтением кода)

- WS-хендшейк: `WsServerCore.sendState` (`packages/ws-protocol/src/ws-server-core.ts`)
  вызывает `getState()`, который в ОБЕИХ хостах привязан к `getBackendRootSnapshot()`
  (`backend/features/singleton.ts`) = сырой `getSnapshot(rootStore)` → **NESTED** MST-root
  форма: `{chat, foundation, history, settings, ...}`.
- VS Code webview гидатируется ДРУГИМ путём: `TaskWebviewLaunched` →
  `handleWebviewLaunched` (`backend/features/chat/task/handlers/webview-launched/main.ts`)
  → `postStateToWebview` → `buildEnrichedState` (`backend/features/foundation/window-manager/lib/window-utils.ts`)
  → **FLAT** `ExtensionState`-форма + отдельное сообщение `taskHistoryUpdated`
  (`sendTaskHistory` в `boot.ts`).
- Frontend `handleStateReceived`
  (`frontend/src/features/foundation/events/handlers/foundation-received.ts:125`) делает
  `store.mergeExtensionState(payload.state)` — spread-merge, который подхватывает только
  FLAT-ключи `ExtensionState`. Nested-ключи (`history.items`, `settings.apiConfig.*`)
  никуда не падают → provider остаётся "default", `taskHistory` пуст.

## Дизайн (минимальный, один builder на обе поверхности)

1. Новый `buildHydrationState()` в `backend/features/singleton.ts` (единый дом — уже
   импортируют ОБА хоста; импорты `@features/hist` + window-manager не создают циклов:
   singleton не импортирует ни features, ни hist):
    - `buildEnrichedState()` (flat-база: `_hydration`, `currentApiConfigName` из memento,
      `apiConfiguration`/`listApiConfigMeta`/`isRunning` из MST store, context meta)
    -   - `taskHistory` из `getHistoryState(getStore())` (то же, что `sendTaskHistory` в
          webview-launched boot)
    -   - active task: `currentTaskId`, `currentTaskItem`, `messages` (то же, что
          `restoreChatState` в boot.ts)
    - try/catch → fallback на `{_hydration: true}` (как в `buildEnrichedState`).
2. `connectors/vscode/backend/connector.ts`: `getState: () => buildHydrationState()`
   (вместо `getBackendRootSnapshot`).
3. `connectors/web/backend/main.ts`: `getState: buildHydrationState` (standalone-сервер
   получает тот же flat payload — consistency).
4. `connectors/web/backend/declarations/store-singleton.d.ts`: добавить декларацию
   `buildHydrationState` (tsc-изоляция web-коннектора).
5. Frontend менять НЕ нужно — `mergeExtensionState` уже применяет flat-форму.

## Ограничения

- Без `any`/`as unknown`/`ts-ignore`; max-len 120, complexity 10, max-lines 250.
- `pnpm build --force` после изменений; рестарт dev-host ручным запуском.

## Реализация (2026-09-22)

- `backend/features/hydration.ts` (НОВЫЙ): `buildHydrationState()` = `buildEnrichedState()`
    - `applyTaskHistory` (`getHistoryState(getStore())` → `taskHistory`) + `applyActiveTask`
      (`currentTaskId`/`currentTaskItem`/`messages` из `getStore().chat.activeTask`), try/catch
      fallback `{_hydration: true}`. Вынесен в отдельный модуль (не в singleton.ts) —
      `hydration.ts` импортирует `getStore` из singleton, поэтому импорт из коннекторов
      идёт напрямую в `hydration.ts`, чтобы не создавать цикл singleton→hydration→singleton.
- `connectors/vscode/backend/connector.ts`: `getState: buildHydrationState`
  (import `../../../backend/features/hydration`), `getBackendRootSnapshot` убран.
- `connectors/web/backend/main.ts`: `getState: buildHydrationState`
  (import `@features/hydration`).
- `connectors/web/tsconfig.json` + `connectors/web/backend/declarations/features-hydration.d.ts`:
  декларация `buildHydrationState(): Record<string, unknown>` для tsc-изоляции web-коннектора
  (runtime резолвит в реальную реализацию через алиасы backend/tsconfig.json).

## Верификация (2026-09-22, PASS)

- `pnpm build --force` ✅ (7/7 tasks, BUILD_EXIT=0).
- `pnpm check-all` ✅ (lint + check-types + test, 0 errors, CHECKALL_EXIT=0).
- Ручной рестарт dev-host: свежий exthost pid=301739, :3000/:60060/:9223, healthz=200.
- **VS Code surface (devtool frontend store):** `currentApiConfigName` = "llama.cpp",
  `taskHistory` = 5 элементов, `_hydration: true` ✅
- **Web surface (WS hello handshake на ws://127.0.0.1:3000/ws — ровно то, что получает браузер):**
    - state keys = `_hydration, currentApiConfigName, listApiConfigMeta, apiConfiguration, isRunning, taskHistory`
      → FLAT `ExtensionState` shape, НЕ nested MST snapshot ✅
    - `currentApiConfigName` = "llama.cpp" ✅
    - `taskHistory` = 5 элементов ✅
- Вывод: обе поверхности гидатируются одним flat builder'ом; `mergeExtensionState`
  применяет payload корректно. BUG-5 закрыт.

---

## BUG-6 (OPEN, блокирует 2.5) — ответ агента не рендерится: `entry.handler` undefined

### Симптом

- VS Code: новый чат, вопрос «Explain in 3 short bullet points why a single backend
  serving both VS Code and Web surfaces is better than two separate backends».
- Ответ НЕ рендерится. Backend store: `isCompleted: true`, `activeTasks: 0`.
- Diagnostics (повторяется): `[jabberwock] [presentAssistantMessage] Error processing
assistant message: [TypeError: Cannot read properties of undefined (reading 'handle')]
at dispatchToolExecution (backend/dist/extension.js:657817:25)
at handleToolBlock (…:657933:9) at dispatchBlockByType (…:657956:7)
at presentAssistantMessage (…:658018:5)`

### Диагностика (2026-09-22)

- `chat.toolCallLog` → последний блок: `read_file` (status `started`,
  `path: plans/architecture-v4-connector-abstraction.md`).
- `read_file` НЕ special-cased в `dispatchToolExecution` → идёт через
  `entry.handler.handle(...)`. Лог «started» пишется ДО dispatch
  (`tool-block.ts` → `getStore().chat.toolCallStarted`) → падение именно на
  `readFileTool.handle`, т.е. `TOOL_HANDLER_MAP["read_file"].handler === undefined`.

### Root cause — circular import

- `dispatchMaps.ts` (`…/presentAssistantMessage/dispatchMaps.ts`) строит
  `TOOL_HANDLER_MAP` при оценке модуля, импортируя `readFileTool` из
  `@features/chat/tools`.
- `ReadFileTool.ts` (`…/tools/n-r/ReadFileTool.ts:20`) импортирует
  `sayAndCreateMissingParamError` из **barrel** `@features/chat` — того же barrel,
  который реэкспортирует `dispatchMaps.ts`.
- Цикл: `@features/chat` → `dispatchMaps.ts` → `@features/chat/tools` →
  `ReadFileTool.ts` → `@features/chat` (ещё не инициализирован) → `readFileTool`
  получает `undefined` на момент оценки `dispatchMaps.ts`.

### Фикс (кандидаты)

1. **Primary:** убрать barrel-импорт из `ReadFileTool.ts` — импортировать
   `sayAndCreateMissingParamError` из конкретного модуля (не `@features/chat`),
   разорвав цикл. Проверить, нет ли аналогичных barrel-импортов у других tools
   (особенно тех, что в TOOL_HANDLER_MAP).
2. **Defensive (обязательно):** в `dispatch.ts` `if (entry)` → добавить guard
   `if (entry?.handler)`; иначе → fallback на unknown-tool error path
   (не падать с TypeError, а дать модели понятную ошибку).

### Статус

- OPEN. Фикс через цепочку orchestrator → architect → coder → debugger.
- После фикса: retest 2.5 (VS Code first, затем Web), затем удалить этот раздел
  из файла после подтверждения.

---

## 2026-09-24: F5/DebugMCP — root cause найден и исправлен

### Корневая причина "Extension host did not start in 10 seconds (debugBrk: true)"

- js-debug (VS Code snap 265) подключается к DAP через `cacheable-lookup` — резолвит `localhost` по **DNS**, а не по `/etc/hosts`.
- DNS роутера отвечает **AAAA `::1`** на `localhost` (`dns.resolve6('localhost') → ::1` в snap-namespace), а инспектор слушает только `--inspect-brk=127.0.0.1:PORT` → `ECONNREFUSED ::1:PORT` (≈96 попыток) → таймаут.
- Не помогло: правки `/etc/hosts`, `/etc/gai.conf` (precedence), рестарты VS Code — `cacheable-lookup` их не читает.

### Фикс (работает)

```
sudo -n sysctl -w net.ipv6.conf.lo.disable_ipv6=1
```

IPv6 на loopback отключён → `::1` недоступен → DAP падает на 127.0.0.1. **Runtime-only**: после ребута нужно применить заново (или записать в `/etc/sysctl.d/`). Проверено безопасно для llama-server (bind `127.0.0.1:5801`, IPv4).

### Подтверждено

- `start_debugging` (DebugMCP, `configurationName: "Run Extension"`) → EDH поднимается, Jabberwock активируется, **breakpoint срабатывает** (vscode-surface.ts:173 `webview.html = html`, стек `setSurfaceHtmlContent ← resolveWebviewView:32 ← VscodeWebviewBackendConnector.resolveWebviewView:282`).
- `workbench.action.debug.start` тоже теперь работает (корень был в DNS, не в способе запуска).
- `stop_debugging` убивает EDH-окно — после него обязателен повторный `start_debugging`.

### Наблюдения (не блокирующие)

- **EADDRINUSE 127.0.0.1:3000 crash-loop**: если предыдущий EDH ещё держит :3000, новый EDH падает (`listen EADDRINUSE` + `[mobx] multiple versions active` + `Missing dataLength in event`). Правило: перед стартом `ss -ltnp | grep ':3000'` должен быть пуст.
- **Devtool stale pid**: jabberwock-devtool кэширует pid таргета; после рестарта EDH может отвечать `alive: NO` / `DISCONNECTED`, хотя новый EDH владеет :60060. Решение: `get_target_info` заново / переподключение.
- "Chat took too long" popup — фикс: `"args": ["--enable-proposed-api=johnny-zhao.oai-compatible-copilot"]` в `~/.config/Code/User/settings.json`.

---

## 2026-09-24: "Дубликат PONG-VS-E2E" — root cause = артефакт тестового окружения (НЕ баг рендера)

### Симптом

Пользователь увидел дубликат блока "Say exactly: PONG-VS-E2E" под "Task Completed"
в VS Code-чате. Требование: в тест-план добавить правило — никаких лишних/чужих
элементов, все необходимые на месте, никаких дублей (→ добавлен шаг 2.9 в testing.md).

### Корневая причина (ПОДТВЕРЖДЖДЕНО чистым тестом)

Страница браузера `http://127.0.0.1:3000/` — **живой WS-клиент** того же backend'а.
DOM-действия devtool (`type_text` + Enter в webview) **бродкастятся ВСЕМ WS-клиентам**
(и webview VS Code, и браузеру). Один Enter → **две задачи** (по одной на поверхность).
То, что выглядело как "дубль рендера", было двумя разными заданиями.

**Доказательство (чистый тест):** браузер на about:blank → одна отправка
"Say exactly: SINGLE-SEND-TEST" → ровно **1** `on-new-requested`
(taskId=01a0d458-a04c-7622-83e9-90b31220ef85), 1 user_feedback, 1 reasoning,
1 completion_result. Backend-консоль: ровно одна строка `[on-new-requested]`.
Эха в web-коннекторе нет (`grep on-new-requested connectors/web/**` → пусто) —
вторую задачу создаёт собственный frontend браузера, обработавший Enter в своей DOM-копии.

### Проверка правила 2.9 (DOM leaf-count)

6 вхождений текста в DOM webview — все объяснимы реальными событиями:

1. `SPAN[truncate]` — заголовок задачи (title = текст сообщения)
2. `DIV[overflow-auto]` — блок "You said" (user_feedback)
3. `SPAN[gap-1]` — Goals chip @1 (goal из сообщения)
4. `DIV[sc-kThouk]` — shadow-копия блока "You said" (Mention withShadow, легитимно)
5. `P[sc-hBDmJg]` — ответ (completion_result)
6. `SPAN[text-xs.truncate]` — список задач слева (тот же task, что #1)

**Вывод: рендеринг-дубля нет. Продуктовый фикс НЕ требуется.**

### Правила для будущих прогонов (VAЖНО)

- **Тестируем VS Code → браузер ОБЯЗАТЕЛЬНО на about:blank** (иначе бродкаст создаёт вторую задачу).
- **Тестируем Web → только Playwright browser tools**, devtool не использовать.
- **Никогда не гонять два параллельных LLM-стрима**: IntentBus накручивает очередь
  (225–642, "WATCHDOG: burst cap hit"), webview frontend bridge перестаёт отвечать
  20+ минут → только полный рестарт EDH (stop_debugging → start_debugging).

### Рецепт отправки сообщения через devtool (VS Code)

1. `xdotool windowactivate <wid EDH>` — фокус ОКНА (типизация приземляется только в фокусированное окно; wid меняется после реболдов — находить через `xdotool search --name "code"` + `getwindowname | grep -i "extension development"`).
2. `type_text text="<полный текст>" selector=textarea[data-testid="chat-input"] submit=true` — ОДНИМ вызовом.
   `type_text` использует нативный value setter (ЗАМЕНЯЕТ значение, не дописывает).

### Кварки devtool (накоплено)

- `get_console`/`get_store_state`: `limit` максимум **10**.
- `find_element` + `command=<JS>`: команда, начинающаяся с `const x=...`, падает
  ("Unexpected token 'const'") — оборачивать в IIFE `(()=>{...})()`.
- "No content available" inline-картинки = артефакт рендера VS Code, НЕ баг —
  валидировать скриншоты через `view_image` на сохранённом PNG.
- Во время активного LLM-стрима store-запросы и `get_screenshot` таймаутятся —
  backend-консоль при этом отвечает.
- **Playwright `locator.click()` может не дойти до React-обработчика** (element
  "not stable" / tooltip перехват): на web-поверхности :3000 надёжнее нативный
  `page.evaluate(() => btn.click())` — именно он сработал для Settings-кнопки
  (BUG-4), тогда как `locator.click({force:true})` молча не вызывал onClick.

## 2026-09-24: BUG-4 «нет кнопки настроек на Web» — фикс + верификация

**Симптом:** на web-поверхности :3000 (и в home-screen) не было видимой кнопки
открытия Settings; в VS Code был только sidebar-команд `jabberwock.settingsButtonClicked`.

**Фикс (2 файла, frontend):**

1. `frontend/src/sections/dndTextArea/view/components/BottomToolbar.tsx` — новая
   `SettingsButton` (иконка `Settings` из lucide-react, tooltip/aria-label =
   `chat:retiredProvider.openSettings` = "Open Settings"), `onClick` →
   `rootStore.windowManager.pushWindow("settings")`; рендерится справа, перед
   DevToolsButton.
2. `frontend/src/features/chat/task/messages/components/displays/home-screen.tsx` —
   кнопка "Settings" (иконка + label) в правом верхнем Container, тот же onClick.

**Сборка/рестарт:** `pnpm build --force` (7/7, BUILD_EXIT=0) → `stop_debugging`
→ порты свободны → `start_debugging` (Run Extension) → EDH pid 833318, healthz=200.

**Верификация VS Code (devtool):**

- `button[aria-label="Open Settings"]` видна в нижнем тулбаре.
- Клик → `window-layer-Settings` `data-active="true"`, вкладки
  Providers/Modes/Skills/MCP Servers/... на месте.
- Клик по Done → слой закрывается, `window-layer-chat` снова активен.

**Верификация Web :3000 (Playwright):**

- `read_page`: кнопки "Settings" (top-right) и "Open Settings" (bottom toolbar)
  присутствуют.
- `locator.click()` НЕ сработал (element not stable) → нативный
  `page.evaluate(() => document.querySelector('button[aria-label="Open Settings"]').click())`
  → `window-layer-Settings` `data-active="true"`, все вкладки на месте.
- Done → слой закрылся, чат активен.

**Итог: BUG-4 закрыт, 2.2 Web = PASS.**

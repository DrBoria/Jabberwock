# vscode-extension-devtool-mcp — Финальный план рефакторинга

Пакет для npm. 5 доменов: `utils/`, `mcp/`, `backend/`, `frontend/`, `stores/`.
Правила:

- Никаких выдуманных сущностей: ни bridge, ни adapter (кроме store-адаптеров по фреймворкам — это сторы), ни factory, ни consumer/handlers/serialization.
- Каждый домен = один `tools.ts`-селектор, который решает, какие тулзы активны, исходя из того, что реально есть в проекте. Недоступность домен сообщает ВВЕРХ (в общий статус/логи), а не вниз.
- `mcp/config.ts` НЕ знает про сущности проекта — только агрегирует то, что домены сообщили.
- Пакет self-contained: нуль импортов извне пакета (workspace devDeps на build-time ок).
- `utils/` — только чистые lodash-подобные функции.
- Нет захардкоженных путей (roo-cline, jabberwock) и нет упоминаний jabberwock внутри пакета.
- Папки/файлы названы по ФУНКЦИОНАЛУ: `findElement/`, `runCommand`, `events/click.ts`, `screenshot/` и т.д.

## Целевое дерево src/

```
src/
├── index.ts                    # публичный API пакета (переписать)
├── types.ts                    # общие типы (DiagnosticLog, StoreEnv, IStoreAdapter, ...)
├── utils/
│   ├── index.ts
│   ├── log.ts                  # formatLogLine, tailReversed, filterBackendLogs (чистые)
│   └── rpc.ts                  # DEFAULT_PORT, nextId, INITIALIZED_NOTIFICATION, resolveUrl (БЕЗ MCP_SETTINGS_PATH)
├── mcp/
│   ├── server.ts               # DevtoolServer: оркестратор. DevtoolBridgeProvider, sendDomQuery,
│   │                           #   wrapBridge, buildBridgeFromProvider, registerGenericTools
│   ├── config.ts               # DevtoolConfig/resolveConfig/availableStoreEnvs
│   ├── command-registry.ts     # CommandRegistry (execute_vscode_command)
│   ├── logger.ts               # общий логгер (уже есть)
│   ├── methods.ts              # DevtoolMethods: контракт методов + createDevtoolMethods (stores)
│   ├── queries.ts              # DevtoolQueries: контракт query-методов (backend/frontend/stores)
│   ├── dom-methods.ts          # реализация DOM-методов поверх bridge
│   ├── dom-query.ts            # sendDomQuery: маршрутизация query → webview
│   ├── console/
│   │   ├── index.ts            # registerConsoleTools (env:"debug", CDP-консоль)
│   │   └── buffer.ts           # ring-buffer логов консоли
│   ├── interceptor/
│   │   ├── index.ts            # MessageInterceptor — общая сущность (без привязки к домену)
│   │   └── tools.ts            # registerInterceptorTools: prefix/directions/sendTool/trace —
│   │                           #   один и тот же набор и для backend, и для frontend
│   └── transport/
│       ├── index.ts
│       ├── ws.ts               # WsMcpServer (60060) — имя "vscode-extension-devtool-mcp"
│       ├── http.ts             # HTTP health check (60061): /status — build ts, pid, uptime, workspace, focused
│       ├── stdio.ts            # AgentEntrypoint: stdio-КЛИЕНТ, коннектится к ws-серверу,
│       │                       #   ре-экспортирует tools на stdio. Имя "vscode-extension-devtool-mcp"
│       ├── target-identity.ts  # buildTargetIdentity + probeTargetStatus
│       └── errors.ts           # общая обработка ошибок транспорта + retry interceptor
├── backend/
│   ├── index.ts                # barrel: DevtoolServer, http status fns, startStdioProxy
│   ├── tools.ts                # СЕЛЕКТОР backend-тулз: импортирует из console/, commands.ts, info.ts;
│   │                           #   решает что активировать; о недоступности сообщает вверх
│   ├── console.ts              # (бывш. console/index.ts) handleGetConsole/handleSearchConsole,
│   │                           #   registerDiagnosticTools, registerConsoleTools
│   ├── console-handlers.ts     # чистые обработчики консольных query
│   ├── commands.ts             # (бывш. interceptor/tools.ts) registerCommandTools — execute_vscode_command
│   ├── info.ts                 # (из factory-state) get_extension_info, get_current_state
│   └── interceptor/
│       └── tools.ts            # тонкая обёртка над mcp/interceptor: send_message_to_webview,
│                               #   set/remove interceptor, trace tools (направление backend → webview)
│   ├── profiler/               # DiagnosticsManager, LifecycleManager, LogFileManager,
│   │                           #   Tracer, ResourceMonitor, SnapshotBuilder, TimelineTracker,
│   │                           #   DevToolsLogger, types (global __DEVTOOL_DIAGNOSTICS_INTERCEPTING__)
│   └── hosts/
│       ├── express.ts / nest.ts / index.ts / hosts.test.ts
├── frontend/
│   ├── index.ts                # barrel: <DevtoolProvider>, createDomMessageHandler, console, source-maps, locator
│   ├── Provider.tsx            # <DevtoolProvider> (бывш. webview/DevtoolProvider.tsx + Devtool.tsx):
│   │                           #   window message listener (createDomMessageHandler), storeSubscriptions
│   ├── tools.ts                # СЕЛЕКТОР frontend-тулз: импортирует тулзы из dom/, console/, screenshot/;
│   │                           #   решает какие активны (есть ли frontend/webview вообще); если нет —
│   │                           #   сообщает вверх "frontend недоступен" и ни один тулз не активен
│   ├── console/
│   │   └── index.ts            # (бывш. webview/console.ts) initWebviewConsoleBridge, getWebviewConsoleLogs,
│   │                           #   clearWebviewConsoleLogs + тулзы get_console/search_console (frontend env)
│   ├── locator/
│   │   └── index.tsx           # (бывш. webview/LocatorBridge.tsx) LocatorBridge: Alt+Click → parseLocatorId →
│   │                           #   postMessage LOCATOR_OPEN_FILE. Вся логика локатора: теги, парсинг, открытие файла
│   ├── source-maps/
│   │   ├── index.ts            # barrel
│   │   ├── resolve.ts          # (бывш. webview/utils.ts) applySourceMapsToStack, enhanceErrorWithSourceMaps, parseStackTrace
│   │   └── preload.ts          # (бывш. webview/main.ts) initializeSourceMaps, exposeSourceMapsForDebugging
│   ├── profiler/
│   │   ├── index.ts            # MetricsCollector (бывш. metrics.ts) + тест
│   ├── interceptor/
│   │   ├── index.ts            # createFrontendInterceptor — тонкая обёртка над mcp/interceptor
│   │   └── tools.ts            # frontend_-тулзы: send_message_to_extension, set/remove interceptor,
│   │                           #   trace tools (направление webview → backend)
│   └── dom/
│       ├── index.ts            # createDomMessageHandler + createWebviewStoreBridge (store-запросы из webview)
│       ├── types.ts            # DomHandlerContext, DomRequest, DomIframeResponse
│       ├── actions.ts          # (бывш. action-handlers.ts) мапа action → обработчик
│       ├── message-handler.ts  # (бывш. create-message-handler.ts) createDomMessageHandler
│       ├── bridge/
│       │   ├── create-frontend-bridge.ts            # FrontendBridge из webview-окружения
│       │   └── register-dom-response-handler.ts     # приём domResponse
│       ├── store-queries.ts    # (бывш. store-query-handlers.ts + webview-store-bridge.ts)
│       │                       #   getRootSnapshot/getNestedStoreState/getActionBuffer/applySnapshot/
│       │                       #   getConsoleLogs/searchConsole — логика СТОРОВ, использует stores/
│       ├── findElement/
│       │   ├── index.ts        # (бывш. handlers/finding/main.ts) handleFindElement + serialize
│       │   ├── lookup.ts       # (бывш. lookup.ts) findAllElementsBySelector
│       │   ├── serialize.ts    # (бывш. serialization/*) dom-tree + helpers
│       │   └── iframe.ts       # (бывш. handlers/finding/iframe.ts) поиск внутри iframe
│       ├── runCommand.ts       # (бывш. handlers/runCommand.ts)
│       ├── getActivePage.ts    # (бывш. handlers/getActivePage.ts)
│       ├── screenshot/
│       │   └── index.ts        # (бывш. handlers/getScreenshot.ts) get_screenshot + тулзы скриншотов
│       ├── events/
│       │   ├── index.ts
│       │   ├── click.ts        # (бывш. interaction/clickElement.ts)
│       │   ├── type.ts         # (бывш. interaction/typeText.ts)
│       │   ├── scroll.ts       # (бывш. interaction/scrollElement.ts)
│       │   ├── select.ts       # (бывш. interaction/selectOption.ts)
│       │   └── drag.ts         # (бывш. interaction/drag.ts) dragElement + dragFromTo
│       └── iframe.ts           # (бывш. iframe.ts) createIframeContext, handleDomResponse
└── stores/
    ├── index.ts                # barrel: адаптеры по фреймворкам + tools
    ├── tools.ts                # СЕЛЕКТОР store-тулз: импортирует тулзы из mobx/, redux/, zustand/,
    │                           #   apollo/ и решает какие показывать (какой store есть в проекте);
    │                           #   + event-bus тулзы (interceptor)
    ├── mobx/                   # store.ts (createMobxAdapter), actions.ts, search.ts, history.ts,
    │                           #   tools.ts (тулзы mobx), snapshot/ (state, store, tree, truncate)
    ├── redux/                  # store.ts, tools.ts
    ├── zustand/                # store.ts, tools.ts
    └── apollo/                 # store.ts, tools.ts
```

УДАЛЯЕТСЯ:

- `backend/factories/` (factory-dom, factory-state, factory-helpers, factory-mock, index)
- `backend/bridge.ts` (ExtensionBridge — сущность мёртвая; контракт = DevtoolBridgeProvider в mcp/server.ts)
- `backend/debug-mcp-proxy.mjs`
- `backend/tools/dom.ts` (DOM-тулзы → frontend/tools.ts)
- `frontend/webview/` целиком (LocatorBridge → locator/, DevtoolProvider → Provider.tsx, console → console/,
  utils/main → source-maps/, vscode.ts → frontend/vscode.ts, DevToolsStore + diagnostic-dashboard → УДАЛИТЬ)
- `frontend/dom/consumer/`, `frontend/dom/handlers/`, `frontend/dom/serialization/`
  (всё перераспределено по функциональным папкам; `bridge/` — легитимная часть дерева)
- `frontend/metrics.ts` → `frontend/profiler/`
- `stores/state.ts`, `stores/eventBus.ts` в корне stores/ → логика внутрь `stores/tools.ts` + подпапки фреймворков

## RENAMES (jabberwock → devtool)

- `utils/rpc.ts`: УДАЛИТЬ MCP_SETTINGS_PATH (roo-cline) и lookup "jabberwock-devtools"; resolveUrl принимает URL напрямую или из env `DEVTOOL_MCP_URL`
- `mcp/transport/ws.ts`: "Jabberwock DevTools" → "vscode-extension-devtool-mcp"
- `mcp/transport/stdio.ts`: "jabberwock-e2e" → "devtool-e2e", "Jabberwock DevTools (Stdio)" → "vscode-extension-devtool-mcp (Stdio)", name "jabberwock-devtools" → "vscode-extension-devtool-mcp"
- `backend/tools/dom.ts` (→ frontend/tools.ts): tmp png `jabberwock-devtool-*.png` → `devtool-screenshot-*.png`
- `backend/profiler/managers/DiagnosticsManager.ts`: `__JABBERWOCK_DIAGNOSTICS_INTERCEPTING__` → `__DEVTOOL_DIAGNOSTICS_INTERCEPTING__` (синхронно в connectors/vscode)
- `frontend/vscode.ts`: `__JABBERWOCK_EARLY_API__` → `__DEVTOOL_EARLY_API__` (синхронно в connectors/vscode/backend/html-utils.ts)
- `backend/factories/factory-state.ts` (→ backend/info.ts): name "Jabberwock DevTools" → "vscode-extension-devtool-mcp"
- `backend/interceptor/tools.ts` (→ backend/commands.ts): примеры команд jabberwock → нейтральные
- `mcp/config.ts`: примеры command-id jabberwock → нейтральные

## EXPORTS package.json (новое)

- `.` → ./src/index.ts
- `./webview` → ./src/frontend/index.ts (frontend app импортирует отсюда: createWebviewStoreBridge, initWebviewConsoleBridge, vscode, LocatorBridge, createDomMessageHandler, source-maps)
- `./backend` → ./src/backend/index.ts
- `./mcp-entry` → ./src/mcp/transport/stdio.ts
- `./express` → ./src/backend/hosts/express.ts
- `./nest` → ./src/backend/hosts/nest.ts
- УДАЛИТЬ `./dom/consumer`

## MIGRATION потребителей

1. `connectors/vscode/backend/extension-activation/modules/core/devtool.ts`:
    - убрать сломанный импорт `createDevtoolBridge`; использовать `new DevtoolServer({ provider, config, backendStore, frontendBridge })`
    - `__JABBERWOCK_EARLY_API__` → `__DEVTOOL_EARLY_API__` (в html-utils.ts)
2. `frontend/tsconfig.json:29`: mapping `vscode-extension-devtool-mcp/webview` → `src/frontend/index.ts`
3. `frontend/src/**`: импорты из `/webview`:
    - `devToolsStore` → УДАЛИТЬ из bootstrap.tsx (mstBridge.registerStore("DevToolsStore", ...) — убрать строку)
    - `DiagnosticDashboard` → УДАЛИТЬ из main.tsx (компонент удаляется из пакета)
    - остальное (createWebviewStoreBridge, initWebviewConsoleBridge, vscode, LocatorBridge, createDomMessageHandler, source-maps) — работает через новый `./webview` subpath
4. `scripts/devtool-migrate.cjs` — stale, обновить или удалить
5. `README.md` — таблица subpaths

## ФАЗЫ

- **A. backend cleanup**: удалить factories/, bridge.ts, debug-mcp-proxy.mjs, tools/dom.ts; console/index.ts → console.ts; interceptor/tools.ts → commands.ts (registerCommandTools); info.ts (getExtensionInfo/getCurrentState из factory-state); tools.ts-селектор; mcp/server.ts — убрать factory-импорты, buildBridgeFromProvider без ExtensionBridge (объект с методами напрямую)
- **B. frontend**: функциональная dom/ (findElement/, runCommand, getActivePage, screenshot/, events/, iframe.ts, actions.ts, message-handler.ts, store-queries.ts, types.ts); locator/; Provider.tsx; console/; source-maps/; profiler/; vscode.ts; tools.ts-селектор (dom+console+screenshot тулзы, был backend/tools/dom.ts); УДАЛИТЬ webview/
- **C. stores**: state.ts+eventBus.ts → tools.ts (селектор) + подпапки; store-queries в frontend/dom используют stores/mobx
- **D. root**: index.ts переписать, types.ts, utils/rpc.ts, renames, package.json exports, README
- **E. consumers**: devtool.ts, html-utils.ts, tsconfig, frontend/src, scripts
- **F. verification**: pnpm --filter check-types/lint/test → pnpm check-all

## СОСТОЯНИЕ

- [x] A. backend cleanup
- [x] B. frontend
- [x] C. stores
- [x] D. root + renames + exports
- [x] E. consumers
- [x] F. verification (lint 0, tsc 0, 50/50 тестов, все файлы ≤200 строк)

Дополнительно (по решению):

- Общий ядро interceptor вынесено в `mcp/interceptor/` (домены не импортируют друг друга).
- `frontend/interceptor/` — frontend-зеркало backend-интерцептора (prefix `frontend_`).
- `mcp/console/` — CDP-консоль (env:"debug", порт 9223).
- stdio-транспорт переименован в AgentEntrypoint (это MCP-клиент, а не сервер).

# Lossless Context Management — расширение архитектуры v4 (целевой дизайн + план миграции)

**Статус:** PLANNING ONLY. Документ не меняет исходный код; это финальный документ реализации lossless context management как расширения [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md). Файл v4 НЕ модифицируется; документ ниже расширяет его и переиспользует (phase-gate discipline: `pnpm check-all` на каждую фазу; runtime-верификация только после `pnpm build --force`; 3-layer devtool/DebugMCP для UI). Все утверждения о текущем состоянии кода верифицированы через Serena LSP + RPG Encoder по состоянию на 2026-08-19.

**Имя файла:** выбрано в семействе `architecture-*` рядом с v4, т.к. документ определяет целевую архитектуру (не просто план работ) и является peer'ом к финальному плану v4; имя зафиксировано по соображениям консистентности именования в `plans/`.

**Ключевые решения документа:**
- **Lossless by construction:** ни одно сообщение не удаляется. SQLite = durable source of truth (полный архив + FTS5); MST = ограниченный working set («активное окно»). Суммаризация создаёт higher-level представление, оригинал остаётся searchable on demand (§4).
- **Hierarchical collapse** — единая рекурсивная структура `ContextNode` DAG: message → topic group → rollup (fan-in 4), fresh tail защищён; иерархия одновременно является структурой данных И деревом UI с collapsible уровнями на любой глубине (§4.3, §8).
- **Один backend search API для модели и человека:** `context.search` / `context.recall` — те же сообщения протокола и тот же сервис; модель вызывает их как native tool, пользователь — через панель поиска в UI (требование R3) (§5.4, §7).
- **Storage+search tech: better-sqlite3 + FTS5 (BM25)** — конкретная рекомендация с обоснованием против embeddings/semantic-first; hybrid semantic search = отложенный follow-up (§4.6).
- **Fiber integration:** compression = Low-priority intents, никогда не блокирует рендер новых сообщений; recall/search = High priority; Critical cancel preemptует in-flight compression на yield points (требование R6) (§5).
- **Parent/child tasks:** дочерняя задача встраивается в ветку родителя как `task_embed` topic group; бесконечное ветвление subtasks = тот же механизм рекурсивного collapse. Текущее file-based хранение не ломается — SQLite сначала параллельный индекс, затем source of truth (§6).
- **v4 integration:** новый backend feature module `backend/src/features/context/` (чистый Node, ноль vscode), протокольные типы в `packages/types/src/protocol`, frontend строго через `IConnectorEventBus`; идентично работает в vscode и web mode (требование R7) (§7).

**Связанные планы:**
- [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md) — фундамент: layout `backend/`+`frontend/`+`connectors/{vscode,web}`, capability DI (`hostContext.storageDir`, `hashmapMemory`), fiber IntentBus (глава 5 v4), streaming exception pattern.
- [`plans/architectural-restructure-v2.md`](architectural-restructure-v2.md) — EventBridge как IPC канал, action creator + handler на event constant, всё состояние в MST, snapshots discipline.

---

## 1. Goals / Non-Goals и маппинг требований пользователя

### 1.1 Требования (R1–R8) → разделы документа

| # | Требование пользователя | Где закрыто |
| - | ----------------------- | ----------- |
| R1 | Lossless: никогда не удалять; «бесконечный» контекст ограничен только памятью/диском устройства. Compression = higher-level representation при сохранении полного контента, searchable on demand («recall по требованию») | §4 (принципы + split), §9 LCM-6 cutover |
| R2 | Hierarchical collapse: message → topic → group of topics → larger group рекурсивно; 45k-token thinking block схлопывается в summary, после compression только main/summary занимает активный контекст. Иерархия = структура данных + UI (tree-shaped chat view с collapsible уровнями на любой глубине) | §4.3, §8 |
| R3 | Searchable «как Elasticsearch»: collapsed content queryable on demand — и моделью (recall/search intents), и пользователем в UI, через ОДИН backend search API; обоснованный выбор storage+search tech (SQLite better-sqlite3: FTS5 keyword vs embeddings) | §4.6, §5.4, §7 |
| R4 | Memory/disk split: точно определить что живёт в MST working set (active window), а что в SQLite; hydration/eviction policy на границе с сохранением MST snapshots | §4.4 |
| R5 | Parent/child tasks: child task = topic group в main chat branch; бесконечное ветвление subtasks = рекурсивный collapse тем же механизмом; маппинг текущего file-based parent/subtask management без ломки поведения | §6 (валидация логики пользователя + 1 коррекция) |
| R6 | Fiber: compression — Low priority, не блокирует fast rendering новых сообщений/уведомлений; recall/search — High priority для быстрого fetch collapsed content; «вся коммуникация должна быть такой же молекулярной, fiber-ной»; Critical cancel preemptует in-flight compression | §5.1–§5.3 |
| R7 | v4 integration: новый backend feature module под `backend/` (connector-agnostic — идентично в vscode и web); протокольные additions в `packages/types/src/protocol`; frontend строго через IConnectorEventBus + streaming exception pattern где применимо; ноль host API вне connectors | §7, §9 |
| R8 | UI: tree view с collapse уровнями, зеркалящими иерархию; user-facing search panel (тот же API что у модели); работает в vscode webview И browser mode | §8, LCM-5/LCM-6 gates |

### 1.2 Non-Goals (v1)

- Semantic/embeddings retrieval — только FTS5/BM25 keyword; hybrid = follow-up после sign-off (§4.6).
- Cross-task / cross-session memory consolidation («долговременная память» между задачами) — вне scope: иерархия строится внутри задачи (task branch); межзадачный recall через существующий history не меняется в v1.
- Замена LLM model providers, MCP hub, checkpoint/time-machine механики — они сохраняются; lossless context management работает поверх них (§2).
- Мультипроцессный доступ к SQLite из нескольких backend-процессов — один процесс = одна сессия (non-goal v4 §1.2 сохраняется); multi-client web mode = несколько клиентов ОДНОГО процесса, writer один.
- Retention/pruning архива: «бесконечность» ограничена диском устройства; VACUUM/операционные утилиты — LCM-6 ops tooling, удаление данных не предусмотрено политикой (R1).

---

## 2. Текущее состояние Jabberwock (верифицировано Serena LSP + RPG Encoder)

### 2.1 Персистентность задач: file-system based (подтверждено)

Каждая задача имеет каталог `<globalStoragePath>/tasks/<taskId>/` — [`getTaskDirectoryPath`](../src/utils/io/storage.ts): `path.join(basePath, "tasks", taskId)` + mkdir recursive; базовый путь из memento через `getStorageBasePath`. Файлы задаёт константа [`GlobalFileNames`](../src/shared/globalFileNames.ts):

| Файл | Содержимое | Кто пишет (верифицировано) |
| ---- | ---------- | --------------------------- |
| `api_conversation_history.json` | Полный массив `ApiMessage[]` — то, что реально уходит в LLM API (user/assistant/tool blocks) | [`saveApiMessages`](../src/features/chat/task/messages/actions/save/saveApiMessages.ts):79 → `safeWriteJson`; чтение: `readApiConversation` там же; **перезапись** при condense/truncation через `overwriteApiConversationHistory` (§2.3 — lossy!) |
| `ui_messages.json` | UI-представление сообщений (Notification[]) для рендера webview/CLI | [`saveMessages.io.ts`](../src/features/chat/task/messages/actions/saveMessages/saveMessages.io.ts):22,54 → тот же taskDir + safeWriteJson |
| `task_metadata.json`, `history_item.json` | Метаданные задачи / history item (id, name, mode, parentTaskId, tokenUsage...) | [`saveMessages.metadata.ts`](../src/features/chat/task/messages/actions/saveMessages/saveMessages.metadata.ts):124-179 → `updateTaskHistory` |
| `_index.json`, `mcp_settings.json`, `custom_modes.yaml` | Индекс/настройки (константы объявлены; основной индекс истории сегодня — memento, §2.2) | — |

Атомарность записи: [`safeWriteJson`](../src/utils/io/safeWriteJson.ts):110 (temp file + replace + rollback). **Вывод:** «parent/child task management is file-system based» = верно на уровне per-task каталогов; связи parent↔child лежат в данных history item (`parentTaskId`) и MST (§2.2), а не в структуре файловых путей (пути плоские: `tasks/<id>/`).

### 2.2 Разговорное состояние в MST (backend) + история

- **Chat store:** [`ChatModelDefinition`](../src/features/chat/store.ts):8 — `tasks: types.map(TaskModel)` + `activeTaskId`, streaming/checkpoint sub-stores, toolCallLog. Это backend root store (`getBackendRootStore().chat`).
- **Task model:** [`TaskModelBase`](../src/features/chat/task/store.ts):31 — identity: `taskId` (identifier), `instanceId`, **`rootTaskId?: string`, `childTaskIds: array<string>`, `parentTaskId?: string`, `childTaskId?`** — parent/child связи УЖЕ есть в MST как поля; плюс control flags, streaming state, todoList/goals, sub-model `notifications`.
- **Volatile runtime:** [`createTaskVolatileState`](../src/features/chat/task/volatile-state.ts):11 — `apiConversationHistory: ApiMessage[]`, `messages: Notification[]` (UI), token usage snapshots, abort controllers и т.д. живут в volatile state Task'а (не сериализуются snapshot'ом) + персистятся в JSON-файлы §2.1 при сохранении сообщений.
- **История задач:** [`updateTaskHistory`](../src/features/hist/actions/history-actions.ts):92 — upsert в `getBackendRootStore().history` (MST items) + запись всего массива в memento: `getVscodeContext().updateGlobalState("taskHistory", rawItems)`; broadcast `sendTaskHistoryUpdated`. History item несёт `parentTaskId` → UI строит группы.
- **Frontend:** [`ChatStore`](../webview-ui/src/features/chat/store.tsx) (webview-ui) — только UI-state (ask responder, expanded rows, streaming state); контент разговора приходит snapshot'ами/сообщениями от backend через EventBridge/MstBridge.

### 2.3 Существующий token counting / context-window handling / summarization (lossy — заменяется)

| Механизм | Где | Поведение сегодня |
| -------- | --- | ----------------- |
| Token counting | [`countTokens`](../src/workers/countTokens.ts):8 (worker, tiktoken); default impl в [`BaseProvider.countTokens`](../src/api/providers/base-provider.ts):141 (`useWorker: true`), override'ы у провайдеров (vscode-lm — нативный `client.countTokens`, fake-ai) | Счётчик существует и переиспользуется для оценки узлов DAG (§4.3); worker уже изолирован от main thread |
| **Auto-condense при переполнении** | [`handleContextWindowExceededError`](../src/features/api/handlers/helpers/recover/contextWindow.ts):78 → `manageContext` ([context-management.ts](../src/features/foundation/time-machine/file-context/context-management.ts)) + `overwriteApiConversationHistory` | **LOSSY:** при context-window error история сжимается/обрезается (condense LLM-суммаризацией или truncation до FORCED_CONTEXT_REDUCTION_PERCENT) и оригинал ПЕРЕЗАПИСЫВАЕТСЯ — данные теряются. Это ровно то, что устраняет R1 |
| **Ручной condense** | [`condenseContext`](../src/features/chat/task/condense/actions/condenseContext.ts):44 → `summarizeConversation` + `overwriteApiConversationHistory`; frontend action creators `condenseContext.ts` / `summarizeConversation.ts` (webview-ui, §2.4 v4) | **LOSSY:** та же перезапись истории суммаризацией; оригинал не сохраняется нигде |
| Truncation helper'ы | [`truncateAndReturn`](../src/features/foundation/time-machine/file-context/context-management.helpers.ts):190 и др. в time-machine file-context | Обрезка с пере-оценкой токенов — lossy, остаётся только как deterministic fallback внутри новой escalation ladder (§4.5) |

**Вывод:** инфраструктура «суммаризация + перезапись истории» существует; новая механика заменяет `overwriteApiConversationHistory` на «collapse в DAG: оригинал → архив SQLite, активное окно получает summary node». Существующие entry points (context-window error handler, ручной condense) переключаются на новый сервис — их сигнатуры и UI-кнопки сохраняются.

### 2.4 Parent/child task management сегодня (валидация утверждения пользователя)

| Факт | Где (верифицировано) |
| ---- | -------------------- |
| Создание subtask: `startSubtask(parentTaskId, ...)` → [`delegateToProvider`](../src/features/chat/task/actions/delegateTask.ts):12 — **stub возвращает undefined** («startSubtask was removed from Task - direct delegation») | delegateTask.ts; обёртка `delegateParentAndOpenChild` там же:65 бросает ошибку при неудаче |
| Альтернативный путь: [`startBackgroundTask`](../src/features/chat/task/actions/startTask/start-background-task.ts):4 — ищет parent в chat store, вызывает `Reflect.get(parentTask, "startSubtask")` (метод на Task-модели) через reflection; вызывается из MCP tool path | start-background-task.ts + [`delegateApprovedTasks`](../src/features/chat/tools/mcp/delegateApprovedTasks.ts):35,49 |
| Завершение subtask → делегирование родителю: `AttemptCompletionTool.execute` проверяет `task.parentTaskId`, затем [`resolveSubtaskDelegation`](../src/features/chat/tools/helpers/lifecycle/attemptCompletionHelpers.ts):47 / [`delegateToParent`](../src/features/chat/tools/helpers/lifecycle/attemptCompletionHelpers.ts):81 (ask parent approval, reopen parent) | AttemptCompletionTool.ts:71 + attemptCompletionHelpers.ts |
| Создание модели задачи с родителем: `createTaskModel` принимает `parentTaskId`, резолвит из history item (`resolvedParentTaskId`) | [`createTaskModel`](../src/features/chat/task/actions/createTaskModel.ts):50,76; options в [`chatStore.actions.ts`](../src/features/chat/actions/chatStore.actions.ts):101-114 |
| UI: история рендерит parent с collapsible subtask rows (рекурсивный count) — уже есть tree-shaped представление на уровне истории задач | [`TaskGroupItem`](../webview-ui/src/features/history/components/task-rows/TaskGroupItem.tsx):36, тип `TaskGroup` в [types.ts](../webview-ui/src/features/history/components/types.ts):39; subtask tag в TaskItemFooter |

**Вывод:** parent/child = плоские MST-поля + per-task каталоги на диске (каждый task — свой «разговор» со своей историей). Логика пользователя R5 («child embeds into main branch as topic group») **валидна и реализуема**; единственная коррекция: сегодня child task физически НЕ вложен в сообщения родителя вообще (отдельный разговор, отдельная ветка UI) — новая механика добавляет `task_embed` узел-ссылку в DAG родителя (§6.2), не меняя существующие пути создания/завершения subtasks.

### 2.5 Чего НЕТ сегодня (проверено аудитом)

- **SQLite отсутствует:** ноль совпадений по `better-sqlite3` / `node:sqlite` / `DatabaseSync` в `src/**` и `packages/**/*.ts`. Единственный «vector store» — qdrant metadata ([qdrantMetadata.ts](../src/services/code-index/vector-store/qdrantMetadata.ts)) для code index, не для контекста.
- Embeddings/semantic search по разговорам отсутствуют; FTS отсутствует.
- Ни один механизм суммаризации сегодня НЕ сохраняет оригинал (§2.3).

---
## 3. Референсный материал: что взято, что нет (loseless-context/* + arXiv)

Читано полностью до дизайна: `remnic/docs/guides/lossless-context-management.md` + полный дизайн-док [`2026-03-14-lossless-context-management.md`](../loseless-context/remnic/docs/plans/2026-03-14-lossless-context-management.md) (схемы SQLite, escalation ladder, MCP tools), `lcm/docs/architecture.md` + `lcm/docs/fts5.md`, `volt/README.md`, `agentic-context-management/README.md`; arXiv 2607.21503v1 («Agentic Context Management: Solving Agent Memory and Cost by Treating Them as Lifecycle and Architecture Problems», Maximem Synap) — успешно получен через curl (HTML → текст, ~65k chars), прочитаны Abstract + §4–§5.

### 3.1 Что взято из каждого источника

| Источник | Взято в наш дизайн | Где применено |
| -------- | ------------------- | ------------- |
| **remnic** (LCM for Engram/OpenClaw) | (a) Summary DAG: leaf (~8 turns/20k tokens) → rollup fan-in 4, depth cap; fresh tail protection (последние N turn'ов всегда в detail); (b) three-level escalation normal→aggressive→deterministic с гарантией конвергенции без LLM; (c) SQLite-схемы: `messages` + FTS5 external-content tables (`content=`, `content_rowid=`), `summary_nodes` с range index'ами, WAL mode; (d) три инструмента recall: search / describe(range→best node) / expand(raw by budget); (e) «complement, don't replace» — LCM не управляет нативным compaction runtime'а | §4.3 DAG + fresh tail; §4.5 escalation ladder; §4.6 схема БД и FTS5 external-content pattern; §5.4 recall API (describe/expand = наши `context.recall`); принцип «не заменяем, дополняем» → LCM-1/LCM-2 параллельный индекс до cutover |
| **lcm** (lossless-claude) | (a) Dual-state: immutable store + active context как materialized view; summaries = cache, не source of truth; (b) `context_items` — ordered list «что видит модель» с ordinal'ами и заменой диапазона одним summary item → наш working-set manifest (§4.4); (c) XML-обёртка summary для модели (`<summary id depth descendant_count earliest_at latest_at>` + `<parents>`) — даёт модели метаданные для drill-down; (d) per-session serialization mutating ops (promise queue) против гонок afterTurn/compact; (e) bootstrap reconciliation: на старте сверить ground-truth файл с БД и импортировать gap'ы (crash recovery); (f) large-file handling: >25k tokens → external file + ~200-token exploration summary + reference в сообщении | §4.1 dual-state; §4.4 working-set manifest = наш `context_items`-эквивалент (`active_window` view); §7 протокол — summary metadata attributes; LCM-3 serialization queue; LCM-6 reconciliation на старте (наш ground truth = JSON файлы §2.1, не JSONL Claude Code); large-file reference → R4 eviction policy для больших tool results |
| **volt** (Voltropy) | (a) Deterministic control loop: soft/hard token thresholds — ниже soft ничего не происходит; выше soft compaction асинхронно МЕЖДУ turn'ами, atomic swap summary в контекст между LLM calls («no compaction delays»); (b) «upward»-режим как базовый: рекурсивное bottom-up condensing без eviction bindles — проще и покрывает наш R1/R2; dolt/ghost-cue off-context retrieval НЕ берём в v1 (сложность lineage pointers при том, что FTS5 даёт тот же recall); (c) `lcm_grep` = regex search прямо по raw messages вне active context → подтверждение: keyword-поиск по архиву — базовый и достаточный инструмент; (d) task tree viewer в TUI для sub-agents → визуальный прецедент «иерархия работы = дерево UI» | §4.2 trigger policy (soft/hard thresholds, async between turns); выбор upward-стратегии как базовой (§4.3); FTS5-first решение подкреплено тем, что даже Volt держит grep по raw messages в обоих режимах; §8 tree view |
| **agentic-context-management** (CMU/Meta repo) | Концептуально: «agent-native + lossless» — агент сам решает когда компрессировать, discarded context пишется на диск и хранится навсегда. В v1 мы НЕ делаем agent-decided compression (детерминированные thresholds надёжнее для production; см. §4.2), но фиксируем направление: recall/search tools дают модели контроль над тем, ЧТО вернуть в контекст — это и есть «agentic» часть ACM | §5.4 (модель управляет recall'ом через High-priority intents); open question Q3 (§10) |
| **arXiv 2607.21503v1** (Maximem Synap / ACM lifecycle paper) | (a) Lifecycle framing: architecting/ingesting/scoping/anticipating/compacting — наш дизайн закрывает ingesting+scoping(retrieval)+compacting в рамках одной задачи; (b) **validated compaction**: каждая компрессия проверяется на information loss, при провале retry с менее агрессивной стратегией → наша escalation ladder получает явный quality gate (§4.5); (c) linear cost argument: re-compaction bounded context'а даёт O(N·W·(1+c/p)) против O(N²) full-append — обоснование «суммаризируем только evictable prefix, fresh tail не трогаем»; (d) async non-blocking ingestion с read-your-writes через verbatim recent turns в working set → наш R4 split; (e) polyglot storage (vector+graph+relational+object) — НЕ берём: для single-process local agent relational(SQLite)+FTS5 достаточно, graph/vector = follow-up | §4.2/§4.3 cost model; §4.5 validation gate; §4.6 обоснование «почему не polyglot»; R1/R4 split |

### 3.2 Что сознательно НЕ копируем (и почему)

| Из референсов | Почему не берём в Jabberwock v1 |
| ------------- | --------------------------------- |
| Retention/pruning (`lcmArchiveRetentionDays=90`, auto-prune raw messages — remnic/lcm) | **Прямое нарушение R1** («никогда не удалять»). Архив живёт до удаления задачи пользователем; VACUUM/оптимизация размера без потери данных — ops tooling LCM-6, удаление контента политикой запрещено |
| Postgres / embedded Dolt (volt) как immutable store | Тяжёлая зависимость для local-first extension: Volt тянет отдельный postgres-процесс + бинарники. better-sqlite3 = один нативный модуль в Node runtime, WAL даёт concurrent reads при одном writer'е — ровно наш профиль нагрузки (§4.6) |
| Ghost-cue / bindle eviction lineage (volt dolt mode), pre-response hooks с cue injection | Сложность off-context pointer machinery не нужна: FTS5 + DAG ranges дают тот же recall проще; upward-режим как базовый покрывает R1/R2 без eviction'а вообще |
| Polyglot storage stack, entity resolution cascade, per-agent LLM-synthesized memory architecture (arXiv/Maximem) | Это hosted multi-tenant сервис. Jabberwock v1 = single-process local agent: relational store + FTS5 закрывают ingesting/scoping/compacting; entity/graph layer и anticipatory retrieval — явные follow-up'ы (§4.6, §10 Q2/Q3), не блокируют |
| Agent-decided compression (ACM repo: модель сама решает когда компрессировать) | Ненадёжно для production latency/cost predictability; детерминированные soft/hard thresholds + async execution дают тот же результат без стохастического контроля. «Agentic» часть оставляем на стороне recall'а (§5.4), не compression-триггера |
| MCP tools как интерфейс recall (remnic `engram.context_*`, lcm/volt `lcm_*`) | У нас уже есть native tool framework + fiber IntentBus: recall/search реализуются как **native tools** (`context_search`/`context_recall`), чьи execution идут через High-priority intents — «молекулярная, fiber-ная» коммуникация (R6) вместо MCP round-trip. Протокольные сообщения те же для UI (§7) |
| JSONL transcripts как ground truth + reconciliation с ним (lcm bootstrap) | Наш ground truth = существующие per-task JSON файлы (`api_conversation_history.json`/`ui_messages.json`, §2.1). Reconciliation-паттерн берём, источник — свой: на старте сверяем SQLite архив с JSON и импортируем gap'ы (crash recovery), не вводя новый формат |
| `node:sqlite` (DatabaseSync) как реализация | Node 20.19.2 закреплён репозиторием (.nvmrc/engines, v4 §9.1): встроенный `node:sqlite` появился позже и на этой версии недоступен; FTS5 в нём не гарантирован (lcm/docs/fts5.md описывает проблему именно с runtime-зависимостью FTS5). better-sqlite3 = зрелый нативный модуль, FTS5 включён по умолчанию в бинарные сборки — см. §4.6 |

---

## 4. Целевой дизайн: lossless context management как расширение v4

### 4.1 Принципы (R1)

| # | Принцип | Следствие для реализации |
| - | ------- | ------------------------ |
| P1 | **Append-only archive.** Каждое сообщение задачи пишется в SQLite архив ровно один раз, при появлении; запись никогда не модифицируется и не удаляется. Суммаризация НЕ трогает строки `messages` — она создаёт узлы DAG (§4.3) | Таблица `context_messages` без UPDATE/DELETE путей в коде сервиса (ESLint-правило на уровне модуля: только INSERT + SELECT); «удаление задачи» = удаление каталога+строк по taskId как явное пользовательское действие, не часть контекст-менеджмента |
| P2 | **Summaries are views.** Узел DAG — materialized view (cache) над диапазоном сообщений; любой узел может быть пересобран из архива. Active context = набор узлов + fresh tail (§4.4), а не «история» | `overwriteApiConversationHistory` перестаёт существовать как операция: вместо перезаписи JSON-файла история модели собирается на лету из working-set manifest (LCM-6 cutover) |
| P3 | **Bounded by device, not by window.** Ограничение «бесконечного» контекста — диск/память устройства. Token budget управляет только тем, что уходит в LLM; архив не имеет token cap'а | Бюджетные политики (§4.2) действуют на assembly active context, никогда на запись в архив |
| P4 | **One search API.** Модель и пользователь ходят в один backend сервис `ContextSearchService` через одинаковые протокольные сообщения (R3); различие — только вызывающий (native tool vs UI panel) | §5.4: native tools `context_search`/`context_recall` вызывают те же intent'ы, что frontend search panel; результаты одного формата (§7) |
| P5 | **Complement existing mechanics.** Checkpoints/time-machine, MCP hub, providers не меняются; lossless context management вставляется на шов «история → API request» (assembly) и «сообщение появилось → персистентность» (ingest) | §2.3 entry points (`handleContextWindowExceededError`, `condenseContext`) переключаются на новый сервис без изменения их сигнатур/UI-кнопок |

### 4.2 Trigger policy: когда компрессия запускается (deterministic control loop, из volt + arXiv)

| Параметр | Значение v1 | Источник/обоснование |
| -------- | ------------ | --------------------- |
| `softThreshold` = доля contextWindow модели, при превышении которой **запускается** асинхронная leaf-компрессия (между turn'ами) | 0.75 × modelInfo.contextWindow − maxOutputTokens | volt: «ниже soft — ничего не происходит»; запас под output; модельные значения уже в `modelInfo` (§2.3, getModelMaxOutputTokens используется сегодня) |
| `hardThreshold` = доля, при превышении которой компрессия догоняет синхронно (до следующего API request), т.к. асинхронная не успевает | 0.9 × contextWindow − maxOutputTokens | volt critical threshold; гарантирует что API call никогда не уйдёт за окно без сжатого prefix'а |
| `leafChunkTokens` = размер чанка сообщений для одного leaf summary (в токенах) | 20_000 | lcm default (`leafChunkTokens=20k`) — проверено на реальных coding-сессиях |
| `rollupFanIn` = сколько sibling узлов склеивается в один parent при condensation | 4 | remnic/lcm/volt единогласно (fan-in 4: d1≈32 turns, d2≈128...) |
| `freshTailMessages` = последние N сообщений задачи, которые НИКОГДА не схлопываются и всегда в active context verbatim | 16 | remnic default; read-your-writes (arXiv §4: recent turns carried verbatim) — модель видит только что сказанное без ожидания ingestion/summary |
| `maxDepth` = потолок глубины DAG | 5 (~8k+ сообщений на ветку при fan-in 4, leaf≈20k tokens → покрывает месяцы сессии) | remnic default; выше — flatten (не создаём новые узлы, старые остаются) |
| Trigger points | (a) после каждого завершённого turn'а задачи (afterTurn-эквивалент: конец `presentAssistantMessage`/сохранения сообщений); (b) при context-window error handler'е (§2.3 — вместо lossy truncation); (c) ручной «Condense» из UI (сегодняшняя кнопка, §2.3) | P5; все три точки уже существуют в коде и получают новый backend-вызов |
| Execution semantics | Компрессия = Low-priority intent'ы (§5), выполняются МЕЖДУ turn'ами асинхронно; atomic swap: working-set manifest обновляется одной MST action (snapshot boundary) после успешной записи узла DAG + архивных строк в одном SQLite transaction | volt «atomic swap between LLM turns»; v4 §5.1 snapshots discipline — одна точка мутации = один snapshot, preemption-safe (§5.3) |

**Cost model (arXiv §5):** каждый pass компрессирует bounded prefix (≤ leafChunkTokens + уже сжатые узлы), fresh tail не трогаем → суммарный overhead O(N·W·(1+c/p)) против O(N²) full-append; при W≈4k, p=8 turns, c≈2 — экономия ~90% токенов к 200 turn'ам. Это и есть «бесконечная» сессия: стоимость растёт линейно, а не квадратично (R1).

### 4.3 Иерархический collapse: ContextNode DAG — единая структура данных для контекста И UI (R2)

**Одна рекурсивная структура на всех уровнях.** Узел `ContextNode` имеет тип и детей; «сообщение» = leaf-узел, «тема/группа сообщений» = topic group узел, «большая группа» = rollup — различие только в `kind`, механизм collapse идентичен (требование R2: message → topic → group of topics → larger group рекурсивно).

```
ContextNode {
  nodeId        : string            // ULID; детерминирован для summary-узлов = hash(content+range) как в lcm sum_<16hex>
  taskId        : string            // ветка задачи (task branch); один DAG на задачу + её subtasks (§6.2)
  kind          : "message" | "topic_group" | "rollup" | "task_embed"   // §4.3 kinds ниже
  depth         : int               // 0 = message/leaf, 1+ = rollups; topic_group на глубине родителя +1
  parentIds     : string[]          // ссылки вверх (для UI tree и lineage)
  childNodeIds  : string[]          // ordered children — это И есть порядок в active context (§4.4 manifest)
  range         : { fromSeq, toSeq }// диапазон seq сообщений задачи, которые покрывает узел (message: от=до=seq)
  tokenCount    : int               // оценка tiktoken-счётчиком §2.3; для rollup = сумма детей + overhead summary'я
  status        : "active" | "collapsed"   // active = в working set verbatim/summary; collapsed = только DAG+архив (R1: данные на месте)
  createdAt     : number
}

MessageNode (kind=message, depth=0): { seq, role: user|assistant|tool|system, contentRef → context_messages.rowid }
TopicGroup    (kind=topic_group):    { title?, source: "auto" | "user", childNodeIds ordered }  // «тема» — группа сообщений/узлов
Rollup        (kind=rollup):         { summaryText, escalationLevel: 0|1|2 (§4.5), descendantCount, earliestAt/latestAt }
TaskEmbed     (kind=task_embed):     { childTaskId, statusRef → task state, completionSummary? }   // §6.2 — subtask как узел в ветке родителя
```

**Каскад collapse (пример из R2: 45k-token thinking block):** assistant message с reasoning блоком ~45k tokens попадает в архив целиком (P1). При превышении softThreshold он входит в leaf chunk → создаётся `rollup` depth-0→1 c summaryText (~800–1200 токенов, lcm типичный размер); узел message помечается `collapsed`. В active context теперь только rollup занимает место (R2: «после compression only the main/summary message occupies active context»). Дальше 4 таких rollups → depth-1 rollup и т.д., до maxDepth=5. **Topic groups** — промежуточный уровень между сообщениями и rollups: либо auto-сгруппировка (по tool-call цепочкам / временным кластерам, LCM-3), либо ручная группировка пользователем в UI (§8) с `source:"user"`; collapse topic group = один summary узел над его children — тот же механизм.

**Recall по требованию (R1):** любой collapsed узел раскрывается: `context.recall(nodeId, maxTokens)` → сервис идёт вниз по DAG до сообщений и возвращает raw content из архива с truncation от середины при превышении бюджета (remnic expand semantics). Модель видит в active context summary-узлы **с метаданными** (`nodeId`, depth, descendantCount, range) — формат XML-обёртки lcm (§3.1): модель сама решает, какой узел раскрыть через `context.recall`/`context_search`.

### 4.4 Memory/disk split: MST working set vs SQLite (R4)

| Слой | Что живёт | Почему именно там |
| ---- | --------- | ------------------ |
| **SQLite** (`<storageDir>/jabberwock-context.db`, путь из `hostContext.storageDir` — v4 §4.3; в vscode mode = globalStoragePath, server mode = --data-dir) | (a) `context_messages` — полный append-only архив всех сообщений задачи (verbatim content + parts JSON); (b) `context_nodes` — DAG (§4.3); (c) FTS5 external-content indexes на messages и summary texts; (d) `active_window_manifest` — ordered список узлов, составляющих working set задачи (= lcm context_items: ordinal → nodeId, kind message/summary/task_embed); (e) `compaction_events` — границы сжатий (для reconciliation/UI timeline) | Durable source of truth. Переживает crash/restart; не ограничен RAM; FTS5 = «Elasticsearch-like» поиск по collapsed content (R3). WAL mode: один writer (backend process), concurrent readers (UI queries через тот же процесс в v1 — multi-client web mode читает, пишет только backend) |
| **MST working set** (`TaskModel` volatile + новый `ContextWindowStore`) | (a) Активное окно задачи: resolved узлы fresh tail'а verbatim + summary-тексты collapsed узлов (текущий manifest из SQLite); (b) streaming state как сегодня; (c) UI tree-state: expanded/collapsed nodeId set per task, selected node — для §8 tree view; (d) pending compression queue metadata | Ограниченный по размеру набор = то, что реально уходит в LLM + рендерится. **MST snapshots сохраняются** на каждой границе (v2 rule 4/26): manifest swap (§4.2 atomic), hydration, eviction — каждая мутация через action → snapshot boundary; preemption-safe по v4 §5 |

**Hydration policy (запуск / reconnect):**
1. Backend старт: для active task'а читает `active_window_manifest` + связанные узлы/сообщения из SQLite → строит working set в MST одной batched action (один snapshot). Задачи, не открытые пользователем — НЕ гидрируются (лениво при open; их DAG живёт только в SQLite).
2. Web mode reconnect / webview reload: тот же путь через существующий `state`/`requestState` механизм v4 §6.2 — snapshot несёт working set, не весь архив.

**Eviction policy (граница MST→SQLite):**
- Evictable = всё вне fresh tail'а (§4.2). При росте окна сверх softThreshold: oldest collapsed узлы уже в SQLite; их summary-тексты могут быть выгружены из MST working set до «metadata only» (nodeId+depth+range без текста) — текст остаётся в SQLite и возвращается по `context.recall` за один запрос. Это и есть «mobx не бесконечно»: RAM держит только metadata + fresh tail, диск держит всё.
- **Никакого eviction из архива:** P1; единственный путь удаления строк = явное удаление задачи пользователем (сегодняшний delete-task flow расширяется на SQLite rows по taskId).

**Crash recovery / reconciliation (lcm bootstrap pattern):** при старте для каждой задачи сверяем `max(seq)` в SQLite с последним сообщением в JSON ground truth (`api_conversation_history.json`, §2.1) и импортируем gap'ы; расхождение логируется, не блокирует старт. До LCM-6 cutover (когда JSON перестаёт быть source of truth для API assembly) reconciliation обязателен на каждом старте.

### 4.5 Summarization engine: escalation ladder + validation gate (из remnic/lcm/volt/arXiv)

Каждый summary узел создаётся по трёхуровневой лестнице с гарантией конвергенции; уровень фиксируется в `escalationLevel` узла (прозрачность для UI/отладки):

| Уровень | Метод | Бюджет выхода | Когда |
| ------- | ----- | -------------- | ------ |
| 0 — Normal | LLM-суммаризация dense paragraph; prompt сохраняет: решения, code artifacts, ошибки, open questions, next steps (remnic §5.4); `previous_context` = ближайший предшествующий summary для непрерывности (lcm leaf pass) | ≤25% input tokens | default |
| 1 — Aggressive | LLM bullet points «one per fact/decision», temperature ниже | ≤12% input tokens | если уровень 0 превысил бюджет или output > input (LLM-сбой, lcm step 8) |
| 2 — Deterministic | Без LLM: first/last sentences + truncation середины с маркером `[Truncated for context management]` | ≤512 tokens | если LLM недоступен / уровни 0–1 не сошлись. **Гарантия:** компрессия всегда завершается (R6 — Low intent'ы не могут зависнуть) |

**Validation gate (arXiv §4 validated compaction):** после создания summary узла сервис проверяет: `summaryTokens < inputRangeTokens` (иначе retry на уровень выше); для уровня 0–1 опциональный spot-check «ключевые сущности из range присутствуют в summary» — v1 = только token-проверка + escalation, LLM-judge отложен (§10 Q4). Провал всех уровней невозможен: deterministic fallback всегда сходится.

**LLM для суммаризации:** существующий `apiHandler` задачи (тот же provider/config) через отдельный короткий request — переиспользует auth/credentials без новой механики; модель = текущая model config задачи, override-настройка `contextSummaryModel?` в settings (remnic preset pattern).

### 4.6 Storage + search tech: решение и обоснование (R3)

**Решение v1: better-sqlite3 + FTS5 (BM25 keyword ranking), WAL mode, один файл БД под `hostContext.storageDir`.** Hybrid semantic (embeddings) — отложенный follow-up за тем же API (§4.6.3).

| Критерий | better-sqlite3+FTS5 | node:sqlite (встроенный) | Embeddings/semantic-first (local model или API) |
| -------- | ------------------- | ------------------------ | ------------------------------------------------- |
| Совместимость с runtime репозитория (Node 20.19.2, .nvmrc — v4 §9.1) | ✅ нативный модуль, бинарные prebuilds для linux/darwin/win x64/arm64; FTS5 включён в стандартных сборках sqlite3-зависимости better-sqlite3 | ⚠️ `node:sqlite` на 20.19.x — experimental/недоступен стабильно (появление и стабилизация позже); **FTS5 не гарантирован** в embedded build — lcm/docs/fts5.md документирует ровно эту проблему (нужна пересборка Node с SQLITE_ENABLE_FTS5) | ✅ runtime-agnostic, но требует embedding model |
| Профиль нагрузки: 1 writer + N readers в одном процессе; multi-client web mode = читатели того же процесса | ✅ WAL даёт concurrent reads при writes без блокировок; synchronous API (better-sqlite3 sync — идеален для fiber yield points: нет async-гонок, каждая операция атомарна и коротка) | ⚠️ DatabaseSync тоже sync, но FTS5-risk выше | ❌ embedding inference = тяжёлая CPU/GPU работа в extension host process; local model (onnxruntime-node ~GB бинарники + память) противоречит «bounded by device» на слабых машинах и VSIX-размеру |
| Размер/зависимости для dual-mode (VSIX bundle + server image, v4 G8) | ✅ один нативный .node файл; в webview НЕ попадает (backend-only dep — frontend не импортирует сервис напрямую, только протокол §7); Docker backend image: `pnpm install` ставит prebuild без toolchain | ✅ ноль deps | ❌ модель-файлы 0.5–4GB + runtime lib; API-based embeddings = внешний вызов на каждое сообщение (latency+cost против P3) |
| Качество поиска для coding-контента (идентификаторы, ошибки, пути файлов — точные строки) | ✅ FTS5 BM25: prefix queries (`token*`), phrase matching, snippet'ы с подсветкой; код/логи = keyword-dominant контент, где BM25 конкурентен dense retrieval без overhead | ⚠️ то же качество при наличии FTS5 | ⚠️ semantic лучше на перефразировании («почему упало» → stack trace), но хуже на точных идентификаторах; hybrid нужен для выигрыша — а это и есть follow-up |
| «Elasticsearch-like» требования R3 (queryable on demand, snippets, ranking, фильтры) | ✅ FTS5: MATCH + bm25() ranking + snippet(); фильтры = обычные SQL WHERE по taskId/role/range; один запрос закрывает search+describe+expand (§5.4) — «как ES» для локального масштаба (миллионы сообщений на задачу не ожидается; даже 10M строк FTS5 отвечает <ms–tens of ms) | ⚠️ то же при наличии FTS5 | ✅ семантический recall, но + инфраструктура |

**Схема БД v1** (external-content FTS по паттерну remnic §4.3 — индекс не дублирует данные):

```sql
PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;

CREATE TABLE context_messages (          -- P1: append-only, только INSERT/SELECT в сервисе
  rowid INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL, seq INTEGER NOT NULL, role TEXT NOT NULL,   -- user|assistant|tool|system
  content_json TEXT NOT NULL,           -- verbatim parts (Anthropic blocks) — lossless source of truth
  token_count INTEGER NOT NULL, created_at INTEGER NOT NULL, metadata_json TEXT,
  UNIQUE(task_id, seq));
CREATE INDEX idx_cm_task_seq ON context_messages(task_id, seq);

CREATE TABLE context_nodes (             -- DAG §4.3; summary-текст только у rollup'ов
  node_id TEXT PRIMARY KEY, task_id TEXT NOT NULL, kind TEXT NOT NULL, depth INTEGER NOT NULL,
  parent_ids_json TEXT NOT NULL DEFAULT '[]', child_node_ids_json TEXT NOT NULL DEFAULT '[]',
  from_seq INTEGER NOT NULL, to_seq INTEGER NOT NULL, token_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', summary_text TEXT, escalation_level INTEGER,
  title TEXT, source TEXT,               -- topic_group: auto|user; task_embed: child_task_id в metadata_json
  meta_json TEXT, created_at INTEGER NOT NULL);
CREATE INDEX idx_cn_task_depth ON context_nodes(task_id, depth);
CREATE INDEX idx_cn_range ON context_nodes(task_id, from_seq, to_seq);

CREATE VIRTUAL TABLE messages_fts USING fts5(content_text, content='context_messages', content_rowid='rowid');  -- trigger'и на INSERT (append-only → только AFTER INSERT)
CREATE VIRTUAL TABLE summaries_fts USING fts5(summary_text, content='context_nodes', content_rowid=rowid);

CREATE TABLE active_window_manifest (    -- lcm context_items: что видит модель сейчас (§4.4)
  task_id TEXT NOT NULL, ordinal INTEGER NOT NULL, node_id TEXT NOT NULL PRIMARY KEY(task_id,node_id), kind TEXT NOT NULL);

CREATE TABLE compaction_events (         -- границы сжатий + reconciliation/UI timeline
  id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL, fired_at INTEGER NOT NULL,
  from_seq INTEGER NOT NULL, to_seq INTEGER NOT NULL, node_ids_json TEXT NOT NULL, tokens_before INTEGER, tokens_after INTEGER);
```

**FTS5 content-текст:** для `context_messages` — плоский text extraction из parts (text blocks + tool input/output как текст) при INSERT; structured parts остаются в `content_json` verbatim. Snippet'ы и ranking работают по extracted text; expand возвращает structured parts (§7).

**4.6.3 Почему НЕ embeddings-first v1:** (a) runtime-зависимость FTS5 у node:sqlite исключает встроенный вариант на закреплённом Node 20.19.2 — остаётся выбор «нативный модуль vs модель»; (b) local embedding model = GB бинарники + RAM/CPU в extension host, противоречит dual-mode VSIX-размеру и слабых устройствам; API embeddings = внешний вызов на каждое сообщение (latency/cost/офлайн); (c) контент coding-агента keyword-dominant — BM25 закрывает основной recall без overhead'а; (d) **API не меняется:** `context.search` принимает опциональный режим, hybrid ranker добавляется в follow-up как ещё один scoring pass над теми же таблицами (+ таблица embeddings с content_rowid-ссылками). Это решение фиксируется здесь, чтобы LCM-2 не расползался.
---

## 5. Fiber IntentBus: compression/recall как молекулярные intents (R6)

Вся коммуникация lossless context management идёт через существующий fiber scheduler v4 §5 — сам scheduler НЕ меняется; добавляются новые event constants + handlers в priority buckets. Механика preemption/yield/snapshots верифицирована по HEAD: [`IntentConstants.ts`](../src/features/intents/IntentConstants.ts) (`INTENT_PRIORITY`, `{Critical:0, High:1, Normal:2, Low:3}`), [bus.ts](../src/features/intents/bus.ts):71 (scheduler injection `ctx.scheduler?.yield()`), :185-191 (suspend/resume → MST snapshot'ы).

### 5.1 Новые intents и приоритеты

| Intent type | Priority bucket | Почему именно этот уровень |
| ----------- | --------------- | --------------------------- |
| `context.compress.requested` | **Low (3)** — R6: «compression runs as Low-priority intents that never block fast rendering of new chat messages/notifications» | Компрессия = фоновая работа между turn'ами. Новые сообщения пользователя (`user.message.received`, High) и уведомления всегда обгоняют её; scheduler не тратит время на компрессию, пока есть что-то поважнее |
| `context.compress.completed` (manifest swap + broadcast UI tree update) | Normal (2) | Swap working set — быстрая MST action; должна пройти до следующего API request'а, но не обгоняет user input |
| `context.recall.requested` / `context.search.requested` | **High (1)** — R6: «recall/search run at High priority so the model fetches collapsed content quickly without waiting on long responses» | Модель ждёт результат tool call на критическом пути turn'а; recall = короткий SQLite read (<ms–tens of ms), должен пройти без ожидания длинных LLM-ответов/стриминга. На том же уровне что `tool.execution.required` — семантически это и есть execution инструмента |
| `context.window.evicted` (metadata-only eviction из MST, §4.4) | Low (3) | RAM-hygiene; никогда не блокирует рендер |

Неизвестные типы дефолтятся в Normal ([bus.ts:118](../src/features/intents/bus.ts)) — новые constants регистрируются явно в `INTENT_PRIORITY` на LCM-4.

### 5.2 Preemption-safety in-flight compression (R6: «Critical cancel must be able to preempt an in-flight compression intent»)

| Ситуация | Механика (существующая, не меняется) |
| -------- | ------------------------------------- |
| `task.cancel.requested` (Critical=0) приходит во время выполнения fiber'а компрессии | PriorityQueue + FiberScheduler: Critical прерывает текущий fiber на ближайшем yield point; preempted compression fiber suspendится с MST snapshot ([store.ts](../src/features/intents/store.ts):108,113), после завершения cancel resume-ится — либо дожимает узел (идемпотентно по nodeId hash: повторная генерация того же summary детектируется и отбрасывается), либо отменяется handler'ом при проверке `task.abort` на следующем yield |
| Где compression fiber делает yield points | Перед/после каждого LLM-вызова суммаризации (уровни 0–1, §4.5) — это длинные блокирующие участки; SQLite операции короткие и синхронные (better-sqlite3 sync API), не требуют yield внутри транзакции → **атомарность узла**: либо запись messages+node+manifest в одном transaction завершена, либо fiber suspendится до/после неё целиком. Partial state невозможен |
| Deterministic fallback и preemption | Уровень 2 (§4.5) — чистая CPU-операция <10ms без yield'ов: preempt не нужен, она просто быстрее любого Critical round-trip; на практике cancel обгоняет только LLM-wait участки |

**Идемпотентность:** nodeId summary-узла = детерминированный hash(content+range) (lcm `sum_<16hex>` pattern) → повторный запуск компрессии того же range после preemption не создаёт дублей: INSERT OR IGNORE по node_id.

### 5.3 Почему Low compression НЕ блокирует fast rendering новых сообщений/уведомлений (R6, проверка против механики v4 §5.1)

| Поток | Приоритет | Взаимодействие с in-flight compression fiber'ом |
| ----- | --------- | ------------------------------------------------- |
| Новое сообщение пользователя → `user.message.received` | High (1) | Очередь: dispatchится раньше любого Low; если scheduler занят compression fiber'ом — тот suspendится на ближайшем yield point, user message обработается первым. Рендер нового сообщения в UI идёт через существующий broadcast (`message.*.broadcast`, Normal) + streaming exception (§8.3 v4) — оба не ждут компрессию |
| Уведомления/asks → `notification.ask.*` (Normal), ask response High | 1–2 | Аналогично: обгоняют Low; UI-рендер уведомления = frontend intent'ы, backend compression их не держит |
| Streaming чанки | мимо IntentBus/MST — streaming exception pattern v4 §8.3 C-4 (`connector.sendOutbound` / bus subscription) | Физически не пересекаются с fiber scheduler: компрессия даже при 100% загрузки Low bucket'а не влияет на доставку streamChunk'ов (тот же канал, что и сегодня) |

### 5.4 Recall/search API — один backend сервис для модели И человека (R3/R4)

**Сервис:** `ContextSearchService` в `backend/src/features/context/` (§7) — единственный владелец SQLite-чтения; два фасада над ним:

| Фасад | Кто вызывает | Путь |
| ----- | ------------ | ---- |
| **Native tools** (модель): `context_search`, `context_recall` (+ опционально `context_describe`) | LLM tool call в ходе turn'а → существующий native tool framework (§2.3: buildToolDefinitions) → execution создаёт intent `context.search.requested` / `context.recall.requested` (High, §5.1) → handler вызывает сервис → результат возвращается как tool result в тот же API request | «молекулярная fiber-ная коммуникация» (R6): модель не ждёт компрессию — её запрос High priority и короткий; длинные LLM-ответы идут параллельно на других fibers |
| **UI search panel** (человек) (§8.3) | Frontend action creator → event constant `context.search.requested` через IConnectorEventBus (тот же body, что у модели — G2 v4: backend не знает источник) → resolver → тот же intent'ы/сервис | **Один API = идентичные возможности** (R3): пользователь видит те же snippets/ranking/node metadata, может раскрыть узел тем же `context.recall` вызовом; различие только в UI-презентации результатов |

**Формы запроса/ответа v1:**

```typescript
// context.search — keyword FTS5 (BM25) по архиву + summary'ям, фильтры как SQL WHERE
request:  { taskId?: string; query: string; scope?: "messages"|"summaries"|"all"; roleFilter?: Role[]; limit?: number /*default 10*/ }
response: { results: Array<{ nodeId: string; kind: NodeKind; snippet: string; rank: number; range: {fromSeq,toSeq}; taskId: string }> }

// context.recall — «раскрыть» узел/диапазон до raw content (lossless, R1)
request:  { nodeId?: string; fromSeq?: number; toSeq?: number; maxTokens?: number /*default 8000*/ }
response: { items: Array<{ seq:number; role:string; partsJson:string }> ; truncatedFromMiddle: boolean; nodeMeta?: ContextNodeMeta }

// context.describe — best-fit summary узел для диапазона (remnic describe semantics)
request:  { taskId: string; fromSeq: number; toSeq: number }
response: { nodeId: string; depth: number; descendantCount: number; summaryText: string | null /*null = нет готового узла — предложить recall*/ }
```

**Бюджет ответа:** `maxTokens` enforced сервисом (truncation от середины, first/last сохраняются — remnic expand semantics); для модели результат укладывается в tool result budget задачи; для UI панель пагинирует по limit'у.

---

## 6. Parent/child tasks → tree: маппинг и коррекция логики пользователя (R5)

### 6.1 Валидация утверждения пользователя

Утверждение R5: *«a child task embeds into the main chat branch AS A TOPIC GROUP; infinite subtask branching = recursive group collapsing»*. **Валидно** — с одной уточняющей коррекцией, зафиксированной ниже. Текущее состояние (§2.4): parent/child связи уже существуют как MST-поля (`parentTaskId`, `childTaskIds`, `rootTaskId` в [`TaskModelBase`](../src/features/chat/store.ts)) + per-task каталоги на диске; child task сегодня — **отдельный разговор** (свой DAG, свой архив), который НЕ виден внутри сообщений родителя вообще.

### 6.2 Целевое состояние: `task_embed` узел в ветке родителя

| Аспект | Механика v1 |
| ------ | ----------- |
| Встраивание child'а в main branch | При создании subtask (существующие пути §2.4: `startBackgroundTask`, MCP delegate, orchestrator delegation) сервис контекста создаёт узел **`kind:"task_embed"`** в DAG родителя на текущей позиции ветки (`from_seq=to_seq`=seq последнего сообщения родителя; childNodeIds = []): это и есть «child task embeds into the main chat branch AS A TOPIC GROUP» — узел-группа, чьё содержимое живёт в собственном DAG child'а (отдельный taskId) |
| Что видит модель родителя | В active context родителя `task_embed` рендерится как компактный summary: `{childTaskId, status(running/completed/failed), completionSummary?}` — ровно то, что родитель должен знать; полный разговор child'а НЕ раздувает контекст родителя (R2-логика collapse применяется к ветвлению) |
| Recall содержимого child'а | `context.recall(nodeId=<task_embed>)` → сервис резолвит в DAG child task'а и возвращает его working set/summary по maxTokens; модель может «заглянуть» внутрь subtask без ожидания завершения (R1: всё на месте) |
| **Бесконечное ветвление = рекурсивный collapse** | Subtask создаёт свой `task_embed` в СВОЁМ DAG и т.д. — та же структура данных, тот же механизм rollup'ов (§4.3): глубина ветвления не ограничена; каждый уровень схлопывается независимо (fan-in 4 внутри каждой ветки). UI tree показывает рекурсивное дерево: parent branch → task_embed node → child branch → ... с collapse на любом уровне (R2/R8) |
| Завершение subtask | Существующий flow (`delegateToParent`/`resolveSubtaskDelegation`, §2.4) без изменений; дополнительно `completionSummary` пишется в meta_json узла task_embed родителя — родитель видит результат как collapsed summary, полный разговор child'а остаётся searchable (R1) |
| **Коррекция логики пользователя** | «child embeds AS A TOPIC GROUP» верно по целевому состоянию, но важно: topic group = **узел-ссылка на отдельный DAG**, а не физическое перемещение сообщений child'а в ветку родителя. Архивы остаются per-task (P1 append-only внутри taskId), связь — через task_embed узел + `parentTaskId`/`childTaskIds`. Это сохраняет: (a) изоляцию контекстов (subtask с 45k thinking не раздувает parent'а); (b) существующее file-based хранение (§2.1) без миграции данных; (c) независимый lifecycle subtasks (abort/resume child не трогает DAG родителя, кроме статуса узла task_embed) |

### 6.3 Маппинг текущего file-system based management → tree (без ломки поведения)

| Сегодня (§2.1/§2.4) | После LCM-5/LCM-6 | Что НЕ меняется |
| -------------------- | ------------------- | --------------- |
| `tasks/<taskId>/api_conversation_history.json` — source of truth для API assembly | До cutover (LCM-5): SQLite = параллельный индекс, JSON остаётся ground truth; reconciliation на старте (§4.4). После LCM-6: API assembly читает working set из `active_window_manifest`; JSON перестаёт перезаписываться condense'ом и становится read-only export | Пути каталогов, имена файлов (`GlobalFileNames`), delete-task flow (расширяется на SQLite rows) |
| Parent/child в MST-полях + history item `parentTaskId` (§2.4) | Те же поля; task_embed узел создаётся рядом при создании subtask — additive, не заменяет связи | Создание/завершение/delegation flow'ы (`startBackgroundTask`, AttemptCompletionTool path), UI истории задач (TaskGroupItem уже рендерит tree §2.4) |
| `updateGlobalState("taskHistory", ...)` memento-персистентность (§2.2) | Без изменений до v4 Phase B capability DI; после — hashmapMemory slot по плану v4 L3 | Формат history items, broadcast'ы |

**Итог R5:** логика пользователя подтверждена как целевое состояние; единственная коррекция — «embed as topic group» реализуется через `task_embed` узел-ссылку (не физическое слияние DAG), что сохраняет изоляцию контекстов и текущее file-based хранение.
---

## 7. Интеграция с v4: backend feature module + протокол (R7)

### 7.1 Размещение в layout v4

| Компонент | Путь (v4 naming, §3/§6 v4) | Зависимости / инварианты |
| --------- | --------------------------- | ------------------------ |
| Feature module «context» | `backend/src/features/context/` — новый feature наравне с chat/settings/mcp: `store.ts` (MST ContextWindowStore), `actions/*.ts`, `services/{ContextArchiveService,ContextSearchService,SummarizationEngine}.ts`, `db/schema.sql` + migrations | Чистый Node: ноль импортов из `connectors/` и vscode API; storage path приходит через capability DI (`hostContext.storageDir`) — v4 §4.3 G1/G2; better-sqlite3 = backend-only dependency (не попадает в webview bundle) |
| Протокольные типы | `packages/types/src/protocol/context.ts` + экспорт из index: ContextNode, NodeKind, SearchRequest/SearchResult, RecallRequest/RecallItem, DescribeResponse, event constants (`context.*`) — v4 §6.1 (envelope в packages/types/src/protocol/) | Только types; без runtime-кода и host API |
| Intent'ы | Новые constants в [`IntentConstants.ts`](../src/features/intents/IntentConstants.ts) + регистрация приоритетов (§5.1); handlers — action creators по v2 pattern (action creator + handler на event constant, всё состояние через MST actions → snapshots discipline) | Scheduler/bus не меняются; preemption-механика существующая ([bus.ts](../src/features/intents/bus.ts)) |
| Native tools для модели | `context_search`, `context_recall` (+ `context_describe`) в native tool framework (рядом с buildToolDefinitions, §2.3); execution → High-priority intent (§5.4) — не MCP round-trip | Tool definitions собираются как существующие; доступность по settings-флагу `enableLosslessContextManagement` (default off до LCM-6 sign-off) |
| Frontend UI | `frontend/src/features/context/`: tree view + search panel (§8); общается ТОЛЬКО через IConnectorEventBus (v4 §7.1 G3): action creators → event constants; данные — snapshot'ы ContextWindowStore + broadcast'и `context.*` | Ноль host API вне connectors (G2 v4); идентично в vscode webview и browser mode (§8) |
| Connectors | Без изменений: события идут по существующему EventBridge/connector-каналу; streaming exception pattern применяется к recall-result stream при больших ответах (chunked delivery через `context.recall.chunk` broadcast, как C-4 v4 §8.3 для tool output'ов) | Web mode multi-client: все клиенты получают те же broadcast'и — search panel работает в браузере без изменений backend'а |

### 7.2 Протокольные сообщения (envelope по v4 §6.1; body-типы ниже)

| Direction | Event constant | Body | Приоритет/канал |
| --------- | -------------- | ---- | ---------------- |
| FE→BE / tool→BE | `context.search.requested` | SearchRequest (§5.4) | High intent (модель и UI — один путь, R3) |
| BE→FE | `context.search.results.broadcast` | SearchResult[] + query echo | Normal broadcast; при >N результатов chunk'и через streaming exception pattern |
| FE→BE / tool→BE | `context.recall.requested` | RecallRequest (§5.4) | High intent |
| BE→FE | `context.recall.chunk` (0..k) + `context.recall.completed` | RecallItem[] chunk'и; финал с nodeMeta/truncatedFromMiddle | Streaming exception pattern для больших raw-ответов (R1: 45k block вернётся целиком по требованию — чанками, не блокируя UI) |
| FE→BE / tool→BE | `context.describe.requested` | DescribeRequest (§5.4) | High intent |
| BE→FE | `context.node.updated.broadcast` | ContextNode (создан/обновлён summary узел; status change active↔collapsed) | Normal broadcast — UI tree обновляет узел без полных snapshot'ов |
| BE→FE | `context.window.manifest.changed` | task_id + ordinal range dirty-маркер → FE запрашивает delta через существующий requestState/селекторы ContextWindowStore | Snapshot boundary (§4.2 atomic swap) — один broadcast на swap, MST snapshots сохраняются (R4/v2 rule 26) |
| BE→FE | `context.compress.progress` (опц.) | taskId + stage(leaf/rollup/deterministic)+range | Low-priority informational; UI показывает индикатор «схлопывается» в tree view, не блокируя рендер (R6) |

**Инварианты v4, сохраняемые:** G1 backend чистый Node (better-sqlite3 — нативный модуль Node runtime, не host API); G2 frontend без host imports; G5 dual-mode идентичность — в web mode БД лежит под `--data-dir` сервера, UI-поведение то же; capability DI: путь к БД = f(hostContext.storageDir), никакого hardcode'а globalStoragePath.
---

## 8. UI surface: tree view + search panel, dual-mode (R2/R3/R8)

### 8.1 Tree-shaped chat view с collapsible уровнями на любой глубине

| Элемент | Поведение v1 | Источник данных |
| ------- | ------------ | ----------------- |
| Ветка задачи = дерево ContextNode'ов (§4.3), рендерится вместо плоского списка сообщений в active task view | Каждый узел — строка с indent по depth; collapsed rollup/summary отображает summaryText (1–2 строки) + метаданные: descendantCount, token savings («45k → 0.9k»), range timestamps; message-узлы fresh tail'а рендерятся как обычные сообщения сегодня | ContextWindowStore snapshot (working set §4.4); `context.node.updated.broadcast` — инкрементальные обновления без полных re-render'ов |
| Collapse/expand на ЛЮБОМ уровне (R2) | Клик по узлу: expand → если summaryText есть, показывается; «раскрыть до raw» → `context.recall.requested`(nodeId) с chunk-доставкой (§7.2); collapse обратно — локальный UI-state + опционально Low intent для eviction metadata-only (§4.4). Expanded/collapsed set хранится в MST (UI tree-state §4.4), переживает reload | Recall через тот же API что у модели (R3) |
| Topic groups: ручная группировка пользователем | Drag/selection сообщений → «Group as topic» → создаётся `topic_group` узел (`source:"user"`) — MST action + broadcast; collapse группы = один summary по §4.5 при следующем compression pass (или сразу, если пользователь просит) | UI-state в ContextWindowStore; DAG-мутация через Normal intent'ы |
| Task embed nodes (§6.2) | Рендерятся как особые строки: иконка subtask + статус (running/completed/failed) + completionSummary; клик → переход к child task view ИЛИ inline recall содержимого по maxTokens — оба действия через существующие navigation/recall пути | TaskModel.parentTaskId/childTaskIds (§2.4) + context_nodes kind=task_embed |
| Индикатор compression (R6: не блокирует рендер) | Дискретный индикатор на узлах/range «схлопывается…» по `context.compress.progress`; новые сообщения и уведомления рендерятся параллельно без ожидания (§5.3) — визуально подтверждает Low-priority семантику | Broadcast'и §7.2 |
| Context usage bar (уже есть в task header, §2.4 TaskHeaderView) | Расширяется: показывает split «active window / archived» + token savings от collapse; клик → search panel с prefill по текущему range | Token counts из DAG (§4.3) — точные оценки tiktoken'ом вместо эвристик |

### 8.2 Search panel (user-facing, тот же API что у модели — R3/R8)

| Элемент | Поведение v1 |
| ------- | --------------|
| Поисковая строка + фильтры (role: user/assistant/tool; scope: messages/summaries/all; range по ветке) | Отправляет `context.search.requested` — **тот же body, что native tool модели** (§5.4); результаты = snippets с BM25-ранкингом и подсветкой FTS5 snippet'ов + nodeId/range метаданные (как у модели: идентичные возможности, R3) |
| Результат → раскрытие | Клик по результату → `context.recall.requested`(nodeId/seq range) с chunk-доставкой; панель показывает raw content в read-only view с навигацией seq±N («показать соседние») — lossless drill-down (R1) |
| История запросов + «спросить модель» | Кнопка на результате: отправить найденный фрагмент как контекст следующего user-сообщения (copy-to-prompt); история последних N запросов в UI-state (не персистится отдельно — поиск воспроизводим по архиву, R1) |
| Dual-mode идентичность | Панель = обычный React компонент frontend'а: в vscode mode рендерится во webview панели расширения; в browser mode — в том же SPA. Оба пути — IConnectorEventBus (§7.2), ноль host API (G3 v4); streaming exception pattern для chunk'ов recall работает одинаково на обоих connectors |

### 8.3 Что НЕ меняется в UI-каркасе

Существующие компоненты task view/сообщений сохраняются: tree view заменяет плоский список только внутри active task conversation; history (задачи), settings, tool approval dialogs — без изменений. Frontend не импортирует SQLite/сервисы напрямую — только протокольные типы из packages/types + event constants (G2 v4).
---

## 9. План миграции: фазы LCM-0…LCM-6, порядок относительно v4 A–F

### 9.1 Почему старт после v4 Phase B/C (обоснование)

| Факт | Вывод для порядка |
| ---- | ------------------|
| Feature module живёт в `backend/src/features/context/` — каталог и его инварианты («чистый Node, ноль vscode», capability DI storageDir/hashmapMemory) создаются v4 **Phase B** (backend extraction + hostContext capabilities, §3.2/§6.1 v4). До Phase B «backend feature module» физически не существует — код лег бы в `src/features/chat/context/` и нарушил G1 при переносе | LCM-0…LCM-5 стартуют **после завершения v4 Phase C** (frontend extraction + IConnectorEventBus стабилен): протокольные сообщения (§7.2) должны идти по финальному event bus, а не по временным шинам; capability DI (`hostContext.storageDir`) доступен для пути к БД |
| v4 **Phase B1** (protocol envelope в packages/types/src/protocol/ — §3.2/§4.1 v4) — обязательный предшественник: body-типы context.* (§7.2) добавляются туда же, и LCM-0 начинается сразу после B1 как «первый consumer» нового протокола — это одновременно smoke-test для Phase B1 | Порядок: v4-B1 → **LCM-0** (протокол+схема БД, без поведения) → v4-B2/B3/B4/C параллельно/после → LCM-1…6. Если B уже сделан к моменту старта LCM — LCM-0 и LCM-1 идут сразу |
| Phase-gate discipline v4 переиспользуется как есть: `pnpm check-all` (lint+check-types+test) на КАЖДУЮ фазу; runtime-верификация только после `pnpm build --force`; UI-фазы — 3-layer devtool/DebugMCP (backend vars → store state → DOM). Никаких исключений для LCM | Каждая фаза ниже имеет явный gate-блок в этом формате |
| v4 Phase D/E/F (connectors web, server mode, cutover) НЕ блокируют LCM: dual-mode идентичность проверяется на LCM-5/6 через существующие vscode+web devtool'ы; полный server-mode rollout остаётся зоной ответственности v4-F | LCM не двигает фазы v4 — только встраивается после B1, затем идёт своим ходом до sign-off (LCM-6) |

**Итоговый порядок:** `v4-A → v4-B1 → [LCM-0] → v4-B2/B3/B4 → v4-C → LCM-1 → LCM-2 → LCM-3 → LCM-4 → LCM-5 → LCM-6`, где LCM-1…LCM-4 могут перекрываться с D/E при свободных ресурсах (зависимости только внутри LCM).

### 9.2 Фазы

**Общий формат gate'ов:** GATE = `pnpm check-all` → 0 ошибок; для runtime: `pnpm build --force` → рестарт debugger/devtool → верификация по слоям (backend vars через DebugMCP, store state через devtool get_store_state, DOM/UI через find_element) + user sign-off. Файлы ниже — пути, верифицированные Serena/RPG (§2).

#### LCM-0 — Протокол и схема БД (без поведения)
| Поле | Содержание |
| ---- | ---------- |
| Scope | Типы в `packages/types/src/protocol/context.ts` + экспорт: ContextNode/NodeKind/SearchRequest+Result/RecallRequest+Item/DescribeResponse, event constants (`context.*`, §7.2); SQL-схема (§4.6) как файл миграции `backend/src/features/context/db/schema.sql`; ESLint boundary rule «features/context не импортирует connectors/vscode» (по образцу v4 G1 rules) |
| Files touched | `packages/types/src/protocol/{context.ts,index.ts}`; новый каталог `backend/src/features/context/db/` (+ placeholder store); eslint config для boundaries |
| Acceptance | Типы компилируются в packages build; схема создаёт БД из CLI-теста (better-sqlite3 dev-dep добавлен, prebuilds ставятся на CI image'ах linux/darwin/win — проверка install без toolchain); `pnpm check-all` зелёный; ноль runtime-изменений |
| Gate | Статический: только `pnpm check-all`. Runtime не требуется (поведения нет) |

#### LCM-1 — Append-only архив + reconciliation (P1, foundation R1)
| Поле | Содержание |
| ---- | ----------|
| Scope | ContextArchiveService: INSERT в context_messages при каждом сохранении сообщения задачи (хук рядом с существующим saveMessages flow §2.3); FTS5 triggers; hydration на старте (§4.4 step 1): manifest+узлы active task'а → MST одной batched action; reconciliation JSON↔SQLite на каждом старте до cutover |
| Files touched | `backend/src/features/context/{store.ts,services/ContextArchiveService.ts,actions/*.ts}` (новые); хук-точки: [`saveMessages.io.ts`](../src/features/chat/task/messages/actions/saveMessages/saveMessages.io.ts) / saveApiMessages flow — additive вызов сервиса; ContextWindowStore в root store |
| Acceptance | После сессии N сообщений: SELECT count(*) по taskId = числу сохранённых (0 потерь); kill -9 mid-session → рестарт → reconciliation импортирует gap'ы, working set идентичен snapshot-у до crash (сравнение seq ranges); FTS5 MATCH на известном идентификаторе возвращает строку |
| Gate | `pnpm check-all`; runtime: `pnpm build --force` + devtool — store state содержит hydrated window; DebugMCP vars в reconciliation path. UI-слоя нет (backend-only) → 3-layer не требуется, но snapshot identity проверяется через get_store_state |

#### LCM-2 — DAG collapse engine (R1/R2 core: leaf→rollup, fresh tail, escalation ladder)
| Поле | Содержание |
| ---- | ----------|
| Scope | SummarizationEngine (§4.5): уровни 0/1/2 + validation gate; создание ContextNode'ов (message leaves при ingest LCM-1 уже есть → leaf chunks→rollups fan-in 4, maxDepth); nodeId hash idempotency; compaction_events запись; per-task serialization queue mutating ops (lcm pattern §3.1) |
| Files touched | `backend/src/features/context/services/{SummarizationEngine.ts,dag/*.ts}`; LLM-вызов через существующий apiHandler задачи (§4.5); settings: thresholds из §4.2 + `contextSummaryModel?` в [`settings`](../src/shared/apiProviderConfigs.ts)-adjacent config |
| Acceptance | Синтетическая задача 30k+ токенов (eval fixture): leaf chunk схлопывается, rollup создаётся с escalationLevel=0 и summaryTokens ≤25% input; kill LLM-ответа → уровень 1/2 сходится deterministically (тест без сети); fresh tail'ы (§4.2 N=16) никогда не помечаются collapsed; повторный запуск того же range = INSERT OR IGNORE, дублей нет |
| Gate | `pnpm check-all` + unit/integration tests на фикстурах; runtime: `pnpm build --force`, DebugMCP — vars в escalation path (уровень, token counts), store state — узлы DAG. UI-слоя ещё нет → 3-layer не требуется |

#### LCM-3 — Working set assembly + eviction policy (R4)
| Поле | Содержание |
| ---- | ----------|
| Scope | Active window = manifest (§4.4): сборка API-ready истории из working set вместо `task.apiConversationHistory` volatile'я; metadata-only eviction collapsed узлов за softThreshold; hydration/eviction как MST actions (snapshot boundaries); **entry point переключение**: [`handleContextWindowExceededError`](../src/features/api/handlers/helpers/recover/contextWindow.ts) и [`condenseContext`](../src/features/chat/task/condense/actions/condenseContext.ts) вызывают новый сервис вместо `overwriteApiConversationHistory` — но за флагом (default off), JSON-запись продолжается параллельно |
| Files touched | `backend/src/features/context/services/{WorkingSetAssembler,EvictionPolicy}.ts`; мутации: contextWindow.ts / condenseContext.ts (обёртка с feature flag); saveApiMessages — dual-write до cutover; ContextWindowStore actions |
| Acceptance | Флаг on: API request'ы собираются из manifest; при переполнении окна модель получает collapsed prefix + fresh tail, а JSON-файл НЕ перезаписывается (diff до/после = 0 изменений в оригинальных сообщениях — lossless check); eviction metadata-only не меняет архив (SELECT count invariant); snapshots: каждая мутация working set'а = один snapshot boundary (проверка через devtool store history) |
| Gate | `pnpm check-all`; runtime: `pnpm build --force` + 3-layer НЕ требуется для backend-логики, НО lossless-invariant проверяется на диске (diff JSON до/после сессии с переполнением окна). User sign-off по «condense больше не теряет данные» |

#### LCM-4 — Fiber intents: compression Low / recall High + preemption (R6)
| Поле | Содержание |
| ---- | ----------|
| Scope | Регистрация intent constants в [`IntentConstants.ts`](../src/features/intents/IntentConstants.ts): `context.compress.requested`(Low), `.completed`(Normal), `context.recall/search/describe.requested`(High), `context.window.evicted`(Low); handlers как action creators (v2 pattern); compression запускается afterTurn-хуком (§4.2 trigger points) через Low intent; preemption: cancel(Critical) во время LLM-wait компрессии → fiber suspend/resume, идемпотентный дожим/отмена |
| Files touched | `backend/src/features/intents/{IntentConstants.ts,bus handlers registration}` (регистрация); `backend/src/features/context/actions/*.ts`; afterTurn hook-точка в presentAssistantMessage/saveMessages flow (§2.3) |
| Acceptance | Тест preemption: запустить компрессию 45k fixture, на середине LLM-wait'а отправить task.cancel.requested → cancel обработан <1s (DebugMCP timing), compression fiber resumed и либо отменён по abort-флагу, либо дожат идемпотентно; новые user сообщения во время компрессии рендерятся без задержки (devtool: timestamp message render vs compress start — нет head-of-line blocking); recall запрос модели отвечает <100ms p95 на fixture'е 1M токенов архива |
| Gate | `pnpm check-all`; runtime: `pnpm build --force` + DebugMCP breakpoints в compression fiber (yield points) + devtool store/DOM для «сообщение рендерится во время компрессии». User sign-off по R6-сценарию |

#### LCM-5 — UI tree view + search panel, dual-mode (R2/R3/R8)
| Поле | Содержание |
| ---- | ----------|
| Scope | `frontend/src/features/context/`: ContextTreeView (§8.1: collapse на любом уровне, task_embed nodes §6.2, compression indicator), SearchPanel (§8.2 — тот же body что у модели); action creators → event constants через IConnectorEventBus; chunk-доставка recall (streaming exception pattern); context usage bar extension |
| Files touched | Новые: `frontend/src/features/context/**`; интеграция в task view контейнер (рядом с существующим message list — замена рендера active conversation на tree, §8.3); event constants уже из LCM-0; ContextWindowStore selectors для FE |
| Acceptance | Vscode webview: дерево отражает DAG 1:1 (сравнение node count/depth через devtool store vs DOM rows); expand collapsed узла → raw content появляется chunk'ами без блокировки ввода нового сообщения; search panel: запрос «<известный идентификатор>» возвращает те же результаты, что `context_search` tool модели на том же query (parity-тест — R3 идентичность); browser mode: тот же UI через web connector работает (devtool для web) |
| Gate | `pnpm check-all`; runtime: `pnpm build --force` + **полный 3-layer**: DebugMCP vars в search handler → devtool get_store_state (ContextWindowStore tree state, expanded set) → find_element DOM (rows, snippets, collapsed states). User sign-off по UI-сценарию §8 |

#### LCM-6 — Cutover: SQLite = source of truth + parent/child task_embed live (R5 final)
| Поле | Содержание |
| ---- | ----------|
| Scope | Feature flag default ON; API assembly читает ТОЛЬКО manifest (§4.4), `overwriteApiConversationHistory` удалён как операция (JSON-файлы = read-only export, перезапись condense'ом прекращена); task_embed узлы создаются на всех существующих subtask paths (`startBackgroundTask`, MCP delegate §2.4) + recall содержимого child'а; delete-task flow расширяется на SQLite rows по taskId (единственный путь удаления — P1); ops: VACUUM/интегрити-утилита без потери данных |
| Files touched | Флаги в settings access ([`access.ts`](../src/utils/settings/access.ts)); удаление lossy-paths из contextWindow.ts/condenseContext.ts (замена на сервис LCM-3); subtask creation paths (§2.4) — additive task_embed; delete-task flow + `backend/src/features/context/services/{ArchiveOps}.ts`; reconciliation остаётся как crash-recovery |
| Acceptance | End-to-end: сессия > context window модели завершается без потери данных (diff архива = append-only, 0 UPDATE/DELETE); subtask создаётся → task_embed виден в tree родителя и recall'ится; kill -9 mid-compression → рестарт → reconciliation + идемпотентный дожим, working set консистентен; web mode: идентичное поведение (G5 v4) |
| Gate | `pnpm check-all`; runtime: `pnpm build --force` + полный 3-layer на ВСЕХ UI-поверхностях (§8) + DebugMCP в cutover paths. **User sign-off обязателен** — это точка, после которой lossless механика становится default'ом |
---

## 10. Риски и митигация

| # | Риск | Вероятность/влияние | Митигация в плане |
| - | ---- | ---------------------| --------------------|
| RSK-1 | better-sqlite3 prebuilds не ставятся на одном из CI image'ов (linux musl, arm64) → сборка падает или тянет toolchain | Средняя/высокая для dual-mode rollout | LCM-0 gate включает проверку `pnpm install` + smoke-open БД на ВСЕХ целевых платформах; fallback: prebuild-install с явным бинарным артефактом в releases (v4 §9.1 уже требует platform matrix) |
| RSK-2 | LLM-суммаризация деградирует качество контекста → модель «забывает» критичные детали, хотя данные в архиве | Средняя/среднее: lossless гарантирует recoverability, но UX страдает | Escalation ladder + validation gate (§4.5); метаданные summary'я (descendantCount/range) дают модели явный сигнал «здесь есть 128 сообщений — recall'; FTS5 поиск по оригиналу как страховка; open question Q4 про LLM-judge spot-check |
| RSK-3 | Preemption compression fiber'а оставляет partial state при crash (не только cancel) | Низкая/высокое доверие к lossless claim | Атомарность: messages+node+manifest в одном SQLite transaction (§5.2); nodeId hash idempotency; reconciliation на старте (§4.4/LCM-1) — даже partial state сходим при рестарте |
| RSK-4 | FTS5 keyword search не покрывает semantic recall («почему упало» → stack trace), пользователи ожидают «Elasticsearch-like» = и семантику | Средняя/среднее UX gap в v1 | Явное решение §4.6: BM25-first с фиксированным API; hybrid ranker как follow-up за тем же `context.search` (таблица embeddings + content_rowid ссылки); до этого — документация поведения поиска в UI-подсказках панели |
| RSK-5 | Рост БД на очень длинных сессиях (месяцы, 10M+ сообщений) → деградация FTS/память WAL | Низкая для v1 / средняя long-term | «Bounded by device» — заявлено честно (R1); ops tooling LCM-6: VACUUM + integrity check; partition по taskId уже в индексах (§4.6 schema); при необходимости — per-task БД файлы как follow-up без изменения API |
| RSK-6 | Dual-write период (LCM-3…5, флаг on/off) расхождением JSON↔SQLite → путаница source of truth | Средняя/среднее | Reconciliation на каждом старте до cutover (§4.1 P2/LCM-1); lossless-invariant тест «diff JSON = 0 изменений оригиналов» в LCM-3 gate; cutover атомарен по флагу (LCM-6), без смешанных режимов внутри задачи |
| RSK-7 | UI tree view на больших DAG'ах (тысячи узлов) деградирует рендером webview | Средняя/среднее UX | Virtualized rendering дерева (только видимые depth-levels); collapsed по умолчанию до fresh tail + top rollups; инкрементальные broadcast'ы (§7.2), не полные snapshot re-render'ы; LCM-5 acceptance включает perf-check на fixture 10k узлов |
| RSK-8 | Task embed nodes ломают существующие subtask flow'ы (delegation, completion) при additive интеграции | Средняя/высокое для core UX | LCM-6 идёт ПОСЛЕ полного прогона существующих subtask сценариев на флаге off; task_embed = additive узел (§6.2), не меняет MST parentTaskId/childTaskIds связи и delegation paths (валидировано §2.4); regression suite по AttemptCompletionTool/delegateToParent в gate LCM-6 |
| RSK-9 | Token counting расхождение: tiktoken оценка DAG vs реальный счётчик провайдера → soft/hard thresholds срабатывают неточно | Средняя/низкое (запас 0.75→0.9) | Thresholds — доли от contextWindow, не абсолютные токены (§4.2); provider-specific countTokens override'ы уже существуют (§2.3 BaseProvider/vscode-lm) и переиспользуются для оценки узлов; hard threshold + deterministic fallback гарантирует корректность даже при ошибке оценки |

---

## Приложение A — Ревизия: расхождения текущего кода с допущениями (нейтральная фиксация на 2026-08-19)

| # | Допущение/ожидание | Фактическое состояние (верифицировано Serena/RPG) | Влияние на план |
| - | -------------------| --------------------------------------------------| ---------------|
| REV-1 | «Parent/child task management is file-system based» — связи parent↔child ожидалось видеть в структуре файловых путей | Пути плоские (`tasks/<taskId>/`, [`getTaskDirectoryPath`](../src/utils/io/storage.ts)); связи живут в данных: MST `parentTaskId`/`childTaskIds`/`rootTaskId` ([`TaskModelBase`](../src/features/chat/task/store.ts):31) + history item field; на диске — только per-task каталоги и metadata-файлы | §6.2 task_embed = additive узел в DAG, не реорганизация файловой структуры; маппинг без миграции данных (§6.3) |
| REV-2 | Ожидалось: существующая суммаризация сохраняет оригинал где-то (archive/backup path) | Оба пути lossy и перезаписывают историю: `handleContextWindowExceededError` → manageContext + [`overwriteApiConversationHistory`](../src/features/chat/task/messages/actions/save/saveApiMessages.ts); ручной `condenseContext` — то же. Никакого архива оригиналов нет (§2.3) | LCM-1 (append-only ingest) обязателен ДО переключения entry points (LCM-3): сначала данные перестают теряться, потом механика меняется; порядок фаз §9.1 это гарантирует |
| REV-3 | Ожидалось: subtask creation — активный основной путь работы с задачами | `delegateToProvider` в [`delegateTask.ts`](../src/features/chat/task/actions/delegateTask.ts):12 — stub (возвращает undefined, «startSubtask was removed from Task»); рабочий путь = `startBackgroundTask` через reflection на метод Task-модели + MCP delegate path (§2.4) | LCM-6 task_embed интеграция привязана к рабочим путям (`startBackgroundTask`, AttemptCompletionTool completion flow), не к stub'у; open question Q5 — судьба stub'а вне scope этого плана |
| REV-4 | Ожидалось: SQLite уже присутствует в стеке (code index / vector store) как переиспользуемая зависимость | Ноль совпадений better-sqlite3/node:sqlite/DatabaseSync в src/** и packages/**/*.ts; qdrant metadata ([qdrantMetadata.ts](../src/services/code-index/vector-store/qdrantMetadata.ts)) — только метаданные code index, не storage для контекста (§2.5) | LCM-0 добавляет better-sqlite3 как новую backend-only зависимость с platform-matrix проверкой (RSK-1); переиспользовать существующий vector store нельзя/не нужно (§4.6 решение) |
| REV-5 | Ожидалось: token counting централизован в одном сервисе для всех потребителей | Счётчик распределён: worker tiktoken ([`countTokens`](../src/workers/countTokens.ts):8), default BaseProvider.countTokens (useWorker:true), provider override'ы (vscode-lm нативный, fake-ai) (§2.3); единого «context budget service» нет | §4.5/§9 LCM-2 переиспользует существующие countTokens пути для оценки узлов; централизация в ContextBudgetService — опциональный refactor внутри LCM-2 (не блокирует), фиксируется как open question Q6 |
| REV-6 | Ожидалось: история задач персистится только через memento `taskHistory` | Верно для списка ([`updateTaskHistory`](../src/features/hist/actions/history-actions.ts):92 → updateGlobalState("taskHistory")), НО per-task данные (api_conversation_history.json, ui_messages.json) — отдельные JSON-файлы в taskDir (§2.1); т.е. «история» = два слоя: memento index + file content | Reconciliation ground truth (§4.4/LCM-1) работает с обоими слоями; cutover LCM-6 не трогает memento-index (остаётся как есть до v4 hashmapMemory slot'а), меняет только source of truth для API assembly |
| REV-7 | Ожидалось: fiber IntentBus уже имеет bucket'ы compression/recall типов | Нет: существующие constants — user.message.*, tool.execution.required, notification.ask.* и т.п.; приоритеты {Critical:0…Low:3} есть ([IntentConstants.ts](../src/features/intents/IntentConstants.ts)), но context-типы отсутствуют (§5) | LCM-4 = регистрация новых constants + handlers; scheduler/bus код не меняется (валидировано по bus.ts yield/suspend механике §5.1–§5.3) — риск минимальный, gate LCM-4 проверяет preemption на fixture'е |

---

## Приложение B — Открытые вопросы (не блокируют старт LCM-0…LCM-2; решаются до соответствующих фаз)

| # | Вопрос | Когда решить | Кандидаты |
| - | ------ | --------------| ----------|
| Q1 | Точные значения freshTailMessages=16 и leafChunkTokens=20k — подтверждение на реальных Jabberwock сессиях (coding-контент плотнее chat'а) | До LCM-3 gate (после первых runtime прогонов LCM-2 fixture'ов) | 8/12/16 tail; 15k/20k/40k chunk — замер по p95 длины tool results в репо |
| Q2 | Hybrid semantic search: когда и как (local embedding model vs API embeddings, размер модели для VSIX-бюджета) | После LCM-6 sign-off; отдельный follow-up план поверх §4.6.3 API | onnxruntime-node small model (~100–300MB) в backend-only optional dep; или provider-side embeddings с кэшем в SQLite (таблица embeddings, content_rowid ссылки — схема уже готова под это) |
| Q3 | Agent-decided compression: дать модели tool `context.compress_hint` для явного запроса компрессии текущего range (ACM-направление §3.1) | После LCM-4; опциональный follow-up | Tool → Normal intent с тем же engine (§4.5); детерминированные thresholds остаются primary, hint = user/model override поверх них |
| Q4 | Validation gate: добавить ли LLM-judge spot-check «ключевые сущности сохранены» на уровне 0 (стоимость vs качество) | До LCM-2 acceptance расширения; v1 без judge (§4.5) | Judge только при escalationLevel=0 провале → уровень 1 уже есть как fallback; замер частоты деградации по user feedback после LCM-6 |
| Q5 | Судьба stub'а `delegateToProvider` (REV-3): восстановить startSubtask path или удалить — влияет на количество subtask entry points для task_embed интеграции | До LCM-6 scope freeze; вне scope этого плана, эскалируется в v4/roadmap обсуждение | Удалить stub + задокументировать рабочие пути (§2.4) как canonical; либо восстановить метод Task.startSubtask по образцу startBackgroundTask |
| Q6 | Централизовать ли token counting в ContextBudgetService (REV-5): единая точка оценки узлов DAG vs переиспользование распределённых countTokens путей | Внутри LCM-2 при реализации SummarizationEngine; не блокирует | Переиспользование существующих provider-aware счётчиков как default + опциональный wrapper для batch-оценки range'ов (избегает N отдельных worker вызовов) |
| Q7 | Multi-client web mode: разрешить ли UI search panel из браузера писать topic_group узлы (`source:"user"`, §8.1) — writer один (backend), но несколько клиентов могут одновременно группировать | До LCM-5 gate для web; v1 vscode single-user без конфликта | Оптимистичная запись через Normal intent'ы + последовательность по taskId (serialization queue уже в LCM-2); конфликты редки и идемпотентны по nodeId hash |

---

## Приложение C — Соответствие требований → решения (traceability)

| Требование (§1.1) | Решения/разделы | Фазы реализации |
| ------------------| ---------------| -----------------|
| R1 lossless, bounded by device | P1 append-only архив SQLite; summaries = views; eviction только из MST metadata (§4.1–§4.4); retention/pruning сознательно не копируется (§3.2) | LCM-1 (архив), LCM-6 (cutover: JSON перестаёт перезаписываться) |
| R2 hierarchical collapse, tree UI | ContextNode DAG message→topic_group→rollup рекурсивно, fan-in 4, maxDepth 5, fresh tail (§4.3); tree view с collapse на любом уровне (§8.1) | LCM-2 (engine), LCM-5 (UI) |
| R3 ES-like search, один API для модели и человека | better-sqlite3+FTS5 BM25 решение с обоснованием против embeddings/node:sqlite/polyglot (§4.6); ContextSearchService + native tools = UI panel body parity (§5.4/§7) | LCM-1 (FTS), LCM-4 (tools/intents High), LCM-5 (panel, parity test в gate) |
| R4 memory/disk split, hydration/eviction с snapshots | Таблица split MST working set vs SQLite; hydration на старте/reconnect; metadata-only eviction за softThreshold; snapshot boundaries (§4.2/§4.4) | LCM-1 (hydration), LCM-3 (assembly+eviction) |
| R5 parent/child = topic group, recursive branching | Валидация + коррекция: task_embed узел-ссылка на отдельный DAG; рекурсивное ветвление тем же механизмом collapse (§6); маппинг file-based без миграции (§6.3) | LCM-2 (kind в схеме), LCM-5 (UI nodes), LCM-6 (live paths + recall child'а) |
| R6 fiber: Low compression / High recall, preemption-safe | Intent priority table; yield points на LLM-wait; atomic transactions; idempotency hash (§5.1–§5.3); streaming exception для chunk delivery (§7.2) | LCM-4 (весь блок), LCM-6 (cutover под fiber'ами) |
| R7 v4 integration, connector-agnostic | backend/src/features/context/ чистый Node + capability DI storageDir; протокол в packages/types/src/protocol; frontend только IConnectorEventBus (§7); dual-mode идентичность G5 | LCM-0 (протокол+boundaries), все фазы — инварианты, LCM-6 web verification |
| R8 UI tree + search panel, vscode и browser | §8 полностью: ContextTreeView, SearchPanel, usage bar; streaming exception pattern для recall chunks; ноль host API в FE (§7.2/§8) | LCM-5 (весь блок), gate 3-layer на обоих connectors |

**Конец документа.** Реализация начинается с v4 Phase A → LCM-0 по порядку §9.1; каждая фаза имеет scope/files/acceptance/gate и не стартует до зелёного `pnpm check-all` предыдущей (runtime — только после `pnpm build --force`).

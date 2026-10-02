# Сравнение: кастомные ESLint-правила vs ручной проход vs сторонние инструменты

Дата: 2026-07-20. Данные: живой `eslint --format json` по 4 пакетам, ручной grep-проход, jscpd 5.3.2, eslint-plugin-functional-core/purity, RPG (rpg-encoder), knip 5.44.4.

## 0. Сводная таблица по всем 21 кастомному правилу

| #   | Правило                             | Уровень                | Живых ошибок | Debt | Сторонний аналог                                                               | Вердикт                                                         |
| --- | ----------------------------------- | ---------------------- | ------------ | ---- | ------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| 1   | `local/no-shadow-store`             | error                  | **8**        | 18   | нет готового (MST-доктрина специфична)                                         | **оставить кастомное**                                          |
| 2   | `local/no-empty-handlers`           | error                  | **15**       | 61   | нет (no-empty не ловит пустые _callback-хендлеры_ в обработчиках)              | **оставить кастомное**                                          |
| 3   | `local/no-passthrough`              | error (off в 1 скоупе) | **3**        | 9    | нет                                                                            | **оставить кастомное**                                          |
| 4   | `local/no-duplicated-logic`         | error (off в 1 скоупе) | **0**        | —    | **jscpd** (130 клонов / 3330 строк)                                            | **заменить на jscpd**                                           |
| 5   | `local/no-impure-utils`             | error                  | **0**        | 23   | **functional-core/purity** (132 файла / 685 нарушений)                         | **заменить на purity**                                          |
| 6   | `local/no-classes`                  | error                  | 0            | —    | нет (можно `@typescript-eslint/no-extraneous-class` — слабее)                  | оставить                                                        |
| 7   | `local/no-state-outside-mobx`       | error                  | 0            | —    | нет                                                                            | оставить                                                        |
| 8   | `local/no-store-outside-store`      | error                  | 0            | —    | нет                                                                            | оставить                                                        |
| 9   | `local/no-direct-store-import`      | error                  | 0            | —    | нет                                                                            | оставить                                                        |
| 10  | `local/no-direct-ipc`               | error                  | 0            | —    | нет                                                                            | оставить                                                        |
| 11  | `local/no-feature-store`            | error                  | 0            | —    | нет                                                                            | оставить                                                        |
| 12  | `local/no-deep-feature-import`      | error                  | 0            | —    | нет (частично `import/no-internal-modules` — слабее)                           | оставить                                                        |
| 13  | `local/no-reexport`                 | error                  | 0            | —    | **eslint-plugin-import** `no-exports-from` (частично)                          | можно заменить частично                                         |
| 14  | `local/no-logic-in-index`           | error                  | 0            | —    | нет                                                                            | оставить                                                        |
| 15  | `local/no-misplaced-concern`        | error                  | 0            | —    | **project-structure** — **частично подходит** (дерево + состав файлов; см. §9) | оставить (semantic-часть) + добавить plugin (структурная часть) |
| 16  | `local/no-monolithic-registration`  | error                  | 0            | —    | нет                                                                            | оставить                                                        |
| 17  | `local/no-dynamic-imports`          | error                  | 0            | —    | **no-restricted-syntax** (готовое)                                             | можно заменить                                                  |
| 18  | `local/no-empty-files`              | error                  | 0            | —    | **no-restricted-syntax** / knip files                                          | можно заменить                                                  |
| 19  | `local/feature-naming`              | error                  | 0            | —    | **eslint-plugin-import** naming conventions (частично)                         | можно заменить частично                                         |
| 20  | `local/actions-purity`              | error                  | 0            | —    | **functional-core/purity** (частично, другая семантика)                        | оставить                                                        |
| 21  | `local/no-complex-folder-structure` | off                    | 0            | —    | project-structure — см. §9                                                     | уже off, кандидат на удаление при adoption plugin'а             |

Итого: **3 правила дают живые ошибки** (26 сообщений в 20 файлах), **2 заменяются сторонними** (no-duplicated-logic → jscpd, no-impure-utils → purity), остальные — нет готового эквивалента.

---

## 1. Shadow state (состояние вне store)

**Что ищем:** `let`/`var` на уровне модуля, `const x = new Map/Set/EventEmitter/NodeCache`, мутируемые внешние переменные.

| Метод                       | Нашёл                                                            | Детали                                                                                                                                                                              |
| --------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ручной grep (M1–M3)**     | 13 `let`-хитов в 6 файлах, ~20 `const=new`, 6 `new EventEmitter` | `backend/features/singleton.ts`, `frontend root-store/singleton.ts`, `apps/cli useToast.ts:30` (`let toastIdCounter`), `connectors/vscode` (cloud.ts, extension.ts, panel-store.ts) |
| **`local/no-shadow-store`** | **8 живых** + 18 debt + 4 exemptions                             | Живые: `connector-bus.ts` (connectorBusState ×3), `highlighter.ts` (state ×2), `Icon.tsx` (nerdFontCache ×3)                                                                        |
| **Сторонние**               | 0                                                                | Готового инструмента для MST-доктрины не существует                                                                                                                                 |

**Сравнение:**

- Все 6 файлов ручного прохода **полностью покрыты конфигом**: 2 — в `exemptions` (singleton.ts ×2 — санкционированные root holders), 1 — `useToast.ts` в `exemptions`, 3 — в `connectors/` (исключено `excludePaths`). **Ложных отрицательных нет.**
- ⚠️ **Спорная exemption:** `useToast.ts:30 let toastIdCounter = 0` — счётчик ID тостов, а не root-store holder. По доктрине должен быть в store. Рекомендую убрать из exemptions.
- 🔴 **Слепое пятно всех инструментов:** `connectors/vscode` **не имеет eslint-конфига вообще** — 9 `let`-хитов там невидимы ни одному линтеру.

**Вердикт:** кастомное правило покрывает 100% ручных находок в lint-покрытых зонах. Оставить. Закрыть gap: (1) eslint-конфиг для connectors/vscode, (2) пересмотр exemption useToast.

---

## 2. Impure utils (нечистые функции в utils)

| Метод                       | Нашёл                         | Детали                                                                                                       |
| --------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Ручной grep (M5)**        | 18 файлов                     | —                                                                                                            |
| **`local/no-impure-utils`** | 0 живых + **23 debt**         | debt-лидер — grandfathered список                                                                            |
| **functional-core/purity**  | **132 файла / 685 нарушений** | Топ: highlighter.ts 29, cli agent/extension/utils.ts 29, tag-matcher.ts 26, tts.ts 24, settings/access.ts 21 |

**Сравнение:**

- Ручной M5 (18) ⊂ purity (132) — **100% покрыто**.
- Debt-лидер (23) ⊂ purity (132) — **100% покрыто**.
- Purity находит **в 5.7× больше** файлов, чем наш debt-лидер.

**Вердикт:** functional-core/purity полностью заменяет `no-impure-utils`. План: включить purity в base.js (settings `purePaths: ["utils\\.ts$", "-utils\\.ts$", "/utils/"]`, `allowThrow: true`), сделать grandfather-лист из 132 файлов, удалить кастомное правило. ⚠️ Требует `NODE_OPTIONS=--max-old-space-size=8192` (без этого OOM-crash на backend).

---

## 3. Пустые хендлеры / catch

| Метод                         | Нашёл                      | Детали                                            |
| ----------------------------- | -------------------------- | ------------------------------------------------- |
| **Ручной grep (M4)**          | 12 хитов в 8 файлах        | 7 backend + 5 в `connectors/vscode html-utils.ts` |
| **`local/no-empty-handlers`** | **15 живых** + **61 debt** | Живые: 9 в apps/cli, 6 в connectors/web           |

**Сравнение:**

- 7 backend-файлов ручного прохода — **все 7 в debt** (покрыто).
- 🔴 `connectors/vscode/backend/html-utils.ts` (5 пустых catch) — **не в debt, не в живых находках**: пакет без eslint-конфига. **Единственный реальный gap.**

**Вердикт:** оставить кастомное (готового нет — `no-empty` не различает намеренные пустые catch с комментарием и забытые хендлеры). Gap тот же: конфиг для connectors/vscode.

---

## 4. Дубликаты кода (в т.ч. с разными именами)

| Метод                                              | Нашёл                        | Детали                                                                         |
| -------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------ |
| **Ручной**                                         | нет систематического способа | только точечный grep                                                           |
| **`local/no-duplicated-logic`**                    | **0 живых**                  | Dice-метрика, scope-ограничена, всё в debt/под порогом                         |
| **jscpd** (minTokens 80, minLines 12)              | **130 клонов, ~3330 строк**  | 35 within-file (649 строк) + 95 cross-file                                     |
| **RPG semantic** (Jaccard ≥0.7 на lifted features) | **19 пар при 100%**          | `getSessionToken` ×2, `isRecord` ×2, `getCommandNames` ×3, `setLogFilePath` ×2 |

**Топ cross-file пар jscpd (разные имена, одинаковая логика):**

| Пара                                                                                  | Строк |
| ------------------------------------------------------------------------------------- | ----- |
| `api/transform/r1/messages.ts` ↔ `api/transform/zai/messages.ts`                     | 181   |
| `types/gemini/models-part1.ts` ↔ `types/vertex/models-part1.ts`                      | 169   |
| `features/chat/ask/handlers.ts` ↔ `features/chat/task/notifications/ask/handlers.ts` | 152   |
| `todo/update-todo-list-tool-block.tsx` ↔ `topic/todo/…`                              | 148   |
| `ask/orchestrators.ts` ↔ `task/notifications/ask/orchestrators.ts`                   | 85    |
| `openai/main.ts` ↔ `stream/helpers.ts`                                               | 81    |
| `foundation/events/constants` ↔ `types/events/constants`                             | 68    |

**Сравнение:** jscpd находит клоны **между файлами с разными именами** (r1/zai, ask/notifications-ask) — кастомное правило их не видит (0 живых). RPG semantic дополняет: ловит концептуальные дубли, где код написан по-разному, но фичи совпадают 100%.

**Вердикт:** jscpd **полностью заменяет** `no-duplicated-logic`. 🔴 Проблема: `jscpd.config.mjs` — CLI **не парсит .mjs** (ожидает JSON). Нужно: переименовать в `jscpd.config.json` + скрипт `"dup-check": "jscpd"` + включить в check-all. RPG semantic — опциональный слой (требует свежий lift).

---

## 5. Дубликаты сущностей (stores, actions, handlers)

| Метрика                   | Значение                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Файлов `store.ts`         | **48** (24 backend + frontend + packages)                                                                                                                                                                                                                                                                                                                                                              |
| Экспортируемых имён всего | 3640, уникальных 3499                                                                                                                                                                                                                                                                                                                                                                                  |
| **Дублирующихся имён**    | **120**                                                                                                                                                                                                                                                                                                                                                                                                |
| Топ                       | `getModelParams` ×5, `addCacheBreakpoints` ×5, `extractErrorMessage` ×4, `buildUsageChunk` ×4, `processUsageMetrics` ×4, `detectAgentState` ×4, `INTENT_PRIORITY` ×3, `readResource` ×3, `executeCompletePrompt` ×3, `IconButton` ×3, `isAgentWaitingForInput` ×3, `isAgentRunning` ×3, `isContentStreaming` ×3, `IntentModel` ×2, `IntentStoreModel` ×2, `IntentConstants` ×2, `BackendIntentType` ×2 |
| RPG semantic-pairs (100%) | 19 (см. §4)                                                                                                                                                                                                                                                                                                                                                                                            |
| jscpd store-клоны         | `ask/handlers.ts` ↔ `notifications/ask/handlers.ts` 152 строки                                                                                                                                                                                                                                                                                                                                        |

**Сравнение:** ни одно кастомное правило не ловит дубликаты _имён_ экспортов (120 шт.) — только `no-duplicated-logic` ловит дубли _кода_, и то 0 живых. jscpd + RPG вместе покрывают: jscpd — текстовые клоны, RPG — семантические.

**Вердикт:** для дублей имён готового инструмента нет (можно `eslint-plugin-unicorn/no-duplicate...` — нет; typehunt — только типы). Рекомендация: скрипт `dup-check:names` (node-скрипт, как уже использовался) в CI как warning-репорт, либо принять как технический долг.

---

## 6. Итог по сторонним инструментам

| Инструмент                                 | Статус         | Пригодность                                                                                                                                                                                                                                                   |
| ------------------------------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **jscpd 5.3.2**                            | установлен     | ✅ **АДОПТИРОВАТЬ** — заменяет no-duplicated-logic. Фикс: `.mjs` → `.json` конфиг + скрипт + check-all                                                                                                                                                        |
| **eslint-plugin-functional-core/purity**   | установлен     | ✅ **АДОПТИРОВАТЬ** — заменяет no-impure-utils (132 файла в grandfather). Требует 8GB heap                                                                                                                                                                    |
| **knip 5.44.4**                            | установлен     | ⚠️ **НЕ РАБОТАЕТ в monorepo как есть**: 6183 "unused files" в root — entry points не описаны в `knip.json`. Нужна перенастройка per-workspace, иначе вывод бессмыслен                                                                                         |
| **eslint-plugin-project-structure 3.14.4** | установлен     | ⚠️ **АДОПТИРОВАТЬ ЧАСТИЧНО** — см. §9: wildcard `*` + рекурсия + `enforceExistence` выражают v2-шаблон feature одной rule. Но репо сейчас не в v2-layout → только warn+debt или scope на новые features. Semantic-проверки `no-misplaced-concern` не заменяет |
| **Oxlint (Oxc)**                           | не установлен  | ✅ **АДОПТИРОВАТЬ как быстрый слой** — 3.7s на backend (vs 11.6s ESLint), 800+ правил. Кастомные JS-правила не выполняет → не замена ESLint, а быстрый pre-слой (editor/watch)                                                                                |
| **Biome**                                  | не установлен  | ✅ **АДОПТИРОВАТЬ как быстрый слой + форматтер** — 485ms на 2788 файлов backend (24× быстрее ESLint), 4140 errors / 1246 warnings / 464 infos по дефолту. Линтер+форматтер+импорты в одном бинарнике. Кастомные правила тоже не выполняет                     |
| **fallow**                                 | не установлен  | ✅ **АДОПТИРОВАТЬ вместо knip+jscpd-части** — 7s на backend: **1696 dead code** (knip у нас сломан в monorepo), **145 clone groups** (≈ jscpd 130), **97 health-таргетов**, circular deps, maintainability 86.2. Один бинарник вместо трёх                    |
| typehunt / dslop / similarity-ts           | не установлены | ❌ не нужны — jscpd/fallow + RPG покрывают                                                                                                                                                                                                                    |

---

## 7. План действий (по приоритету)

1. 🔴 `connectors/vscode` — добавить eslint-конфиг (сейчас 9 let + 5 пустых catch невидимы всем инструментам)
2. 🔴 jscpd: `jscpd.config.mjs` → `jscpd.config.json`, скрипт `dup-check`, включить в `check-all`
3. 🟡 functional-core/purity в base.js + grandfather из 132 файлов, удалить `no-impure-utils` + debt
4. 🟡 `useToast.ts` — убрать из exemptions no-shadow-store (счётчик → в store)
5. 🟡 knip.json — перенастроить entry points per-workspace (сейчас 6183 ложных)
6. ⚪ `eslint-plugin-project-structure` — **не удалять** (вердикт пересмотрен, §9): включить `folder-structure` в warn-режиме на v2-шаблон feature + debt, либо scope только на новые features
7. ⚪ Скрипт dup-check:names для 120 дублей имён (warning-репорт)
8. ⚪ Удалить временные: `packages/config-eslint/purity-test.config.mjs`, `packages/config-eslint/ps-test.config.mjs`
9. ⚪ Oxlint или Biome — быстрый watch-слой в editor (не в CI вместо ESLint)
10. ⚪ fallow — заменить knip (сломан) + частично jscpd; прогнать на всём репо, а не только backend

---

## 8. Rust-инструменты: измеренные цифры (backend, 2026-09-26)

| Инструмент               | Время (backend)         | Находки                                                                                                         | Что заменяет                                                                |
| ------------------------ | ----------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **ESLint (текущий)**     | **11.6s**               | 26 ошибок кастомных правил (4 пакета)                                                                           | — (базовая линия)                                                           |
| **Oxlint** (recommended) | **3.7s**                | быстрый слой, 800+ правил (unicorn, eslint, typescript категории)                                               | часть generic-правил ESLint                                                 |
| **Biome** (default)      | **485ms / 2788 файлов** | 4140 errors + 1246 warnings + 464 infos                                                                         | generic ESLint + Prettier + organize-imports                                |
| **fallow**               | **7.0s** (включая npx)  | 1696 dead code, 145 clone groups, 97 health-таргетов, circular deps, maintainability 86.2 (6254 файла analyzed) | knip (dead code) + jscpd (dups) + dependency-cruiser (circular) + сложность |

### Чем заменить и по скорости, и по функционалу

**Полная замена ESLint невозможна** — ни Biome, ни Oxlint не выполняют наши 21 кастомное JS-правило (no-shadow-store, no-passthrough и т.д.). Рабочая архитектура:

1. **Biome** — самый быстрый (24×), один бинарник: lint + format + import-sort. Берёт на себя всё generic (no-unused-vars, no-explicit-any, style, импорты) + заменяет Prettier.
2. **ESLint** — остаётся только для кастомных правил + typescript-eslint type-aware (в CI).
3. **Oxlint** — альтернатива Biome, если важнее покрытие правил (800+) чем форматтер/импорты. На чистом lint чуть быстрее Biome.
4. **fallow** — cross-file анализ: dead code (knip у нас сломан — 6183 ложных), дубли (145 групп ≈ jscpd 130), циклы, health. Один инструмент вместо трёх.
5. **jscpd** — остаётся как опция, если fallow-отчёт неудобен для CI (у jscpd уже отлажен JSON-формат).

**Итог по скорости:** Biome 485ms < Oxlint 3.7s < fallow 7s < ESLint 11.6s. По функционалу: fallow > jscpd+knip (один бинарник, 4 вида анализа), Biome > Prettier+organize-imports (один бинарник).

---

## 9. Почему project-structure — пересмотренный вердикт

**Раньше я написал «отклонён (пер-фолдер, не паттерн)» — это было неправомерно.** Факты после разбора:

### Что плагин реально умеет (schema v3.14.4)

- `folder-structure`: явное дерево с **wildcard `*` в именах**, **рекурсией** (`children`), **`enforceExistence`** (обязательные файлы), `folderRecursionLimit`, regex-валидация имён папок/файлов
- `file-composition`: «`**/*.types.ts` — только interface/type», «`**/*.consts.ts` — только переменные» (AST-селекторы)
- `independent-modules`: запрет импортов между «независимыми» модулями

### Шаблон v2-плана выражается одной rule

```
features/*/
├── store.ts, index.ts, types.ts
├── events/{actions,handlers}/*.ts
├── actions/*.ts, handlers/*.ts
```

= `{ name: "features", children: [{ name: "*", children: [...] }] }` — **это паттерн, не per-folder**. Доктрина «generic, не per-folder» не нарушается.

### Почему всё же «не сейчас», а «частично + warn»

1. 🔴 **Репозиторий не в v2-layout** (идёт mega-refactoring). Включить error-режим = тысячи ошибок. Нужен: warn + debt-список, либо scope только на новые features (новые обязаны соответствовать шаблону, старые — долг).
2. `no-misplaced-concern` делает **semantic-проверки**, которые plugin не умеет: «экспортируемая function в `handlers/` должна звать `bus.registerIntentHandler`», reverse-check «имя файла требует директорию». Это содержимое, а не дерево.
3. Не-feature-зоны (`utils/`, `services/`, `api/`, `connectors/`) — v2-шаблон не применяется; для них отдельные rule (конфиг растёт, но это declarative, не кастомный код).

**Вердикт:** plugin **подходит** для структурной части (дерево + состав файлов + naming) и **дополняет** `no-misplaced-concern` (semantic-часть остаётся кастомной). Adoption: warn-режим, v2-шаблон на `features/*`, debt на текущее расхождение.

---

## 10. Триаж «тысяч ошибок Biome»: что реально исправимо

Замер на **копии** `backend/` (`biome check --write`, 2026-09-26). Исходно: 5850 замечаний (4140 errors + 1246 warnings + 464 infos) по дефолтному конфигу Biome.

**После `--write`: 1873 файла изменено, осталось 2626 замечаний (1648 errors + 586 warnings + 392 infos).**

| Группа                                                           | Было | После `--write` | Как чинится                                                                        |
| ---------------------------------------------------------------- | ---- | --------------- | ---------------------------------------------------------------------------------- |
| `format` (форматирование)                                        | 1873 | **0**           | одна команда, 0 решений                                                            |
| `lint/style/useImportType`                                       | 545  | **0**           | автофикс                                                                           |
| `assist/source/organizeImports`                                  | 901  | 282             | автофикс (часть — конфликты с cycle-импортами)                                     |
| `lint/style/useConst`, `useArrowFunction`, `useTemplate` и пр.   | ~120 | **0**           | автофикс                                                                           |
| `noSvgWithoutTitle` (a11y)                                       | 911  | 911             | **ручной**: добавить `<title>` в SVG (или выключить правило — backend не имеет UI) |
| `noAssignInExpressions`                                          | 255  | 255             | **ручной**: рефакторинг `x = f(x)` → `x = ...`                                     |
| `noCommaOperator`                                                | 188  | 188             | **ручной**                                                                         |
| `noNonNullAssertion`                                             | 181  | 181             | **ручной**: решение по nullability (не авто!)                                      |
| `useNodejsImportProtocol`                                        | 285  | 285             | спорно: `node:`-префикс — вопрос стиля, можно выключить                            |
| остальные (noUnusedFunctionParameters, noInnerDeclarations, ...) | ~500 | ~500            | **ручной**, по одному через debt                                                   |

**Вывод:** из 5850 — **3224 (55%) чинятся одной командой** (`biome check --write`), **911 (16%)** — механика a11y без смысла в backend (выключить правило), ~1700 (29%) — реальные рефакторинги, которые идут через debt-ledger как и кастомные правила. «Тысячи ошибок» на деле = 1 команда + 1 выключенное правило + ~1700 штучных долг-интемов.

⚠️ Важно: эти замечания **не входят** в текущий `pnpm lint` (26 ошибок). Их исправление — решение **принять Biome как слой**, а не «исправление игнорируемых ошибок». Перед принятием: прогнать `--write` на ветке, проверить `pnpm check-all`, и только потом коммитить (массовое форматирование = отдельный коммит, чтобы diff рефакторингов читался).

## 11. Итоговый ответ: «гибкость = главный критерий, что выбрать?»

| Критерий                              | **ESLint**                                                                                                 | Biome                                    | Oxlint                       |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------- |
| Свои правила на AST (JS)              | ✅ любой AST-проход, type-aware                                                                            | ❌ **нет механизма** (только встроенные) | ⚠️ только Rust-плагины (oxc) |
| Шаблоны папок/структуры               | ✅ plugin-project-structure (wildcards, рекурсия, enforceExistence) + file-composition (AST-состав файлов) | ❌                                       | ❌                           |
| Правила по контенту файлов (semantic) | ✅ (наши 21 кастомное)                                                                                     | ❌                                       | ❌                           |
| Type-aware (typescript-eslint)        | ✅                                                                                                         | ⚠️ ограниченно                           | ⚠️                           |
| Скорость                              | 11.6s                                                                                                      | 485ms                                    | 3.7s                         |
| Форматтер + импорты в одном           | ❌ (Prettier/organize-imports отдельно)                                                                    | ✅                                       | ⚠️ (oxfmt отдельно)          |

**При «гибкость = главный критерий» выбор однозначен: ESLint остаётся ядром.** Ни Biome, ни Oxlint не дают писать правила под AST и не умеют шаблоны папок — а это ровно 21 наше правило + v2-шаблон features. Biome/Oxlint полезны только как **быстрый watch-слой в редакторе** (485ms на весь backend), не заменяя CI-lint. Финальный стек: **ESLint (CI, кастомные + type-aware) + Biome (watch, формат/импорты/generic) + fallow (dead/dups/cycles)**.

## 12. Готовые инструменты для выражения 4 архитектурных планов в правилах чекеров

Поиск в интернете (GitHub/npm) по теме «выразить архитектурные правила в чекерах»: layer/folder boundaries, fitness functions, import rules, AST-анализаторы.

### 12.1 Ключевая находка: **javierbrea/eslint-plugin-boundaries** (992★, v7.2.0, активен, docs: jsboundaries.dev)

Единственный готовый инструмент, который **декларативно** выражает межслойные/межпапочные правила импорта прямо в ESLint (то есть работает в нашем `pnpm lint`, в CI, в редакторе):

```js
// settings
"boundaries/elements": [
  { type: "connector-backend", pattern: "connectors/*/backend/**" },
  { type: "connector-frontend", pattern: "connectors/*/frontend/**" },
  { type: "app-backend",  pattern: "backend/features/**" },
  { type: "chat-task-messages", pattern: "backend/features/chat/task/messages/**" }
]
// rules
"boundaries/dependencies": ["error", {
  default: "disallow",
  policies: [
    { from: { element: "app-backend" },  allow: { element: "app-backend" } },
    { from: { element: "connector-frontend" }, allow: { element: "connector-frontend" } },
    // v4 G6: ноль vscode в backend и app-level frontend
    { from: { element: "app-backend" }, disallow: { element: "connector-backend" } }
  ]
}]}
```

Три измерения одновременно: **elements** (тип папки), **files** (категории: test, config), **modules** (npm-пакеты, напр. запрет `"vscode"` вне connectors/vscode/backend). Это ровно то, что в v4-плане §8 purity rules (G6/G7) сейчас зашито в ESLint no-restricted-imports + `pnpm audit:platform`.

### 12.2 Сопоставление планов → инструменты

| Требование из планов                                                                                        | Лучший инструмент                                                                                                                         | Комментарий                                                                                                    |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **v4**: изоляция connectors (frontend↛backend, vscode только в connectors/vscode/backend)                   | **eslint-plugin-boundaries**                                                                                                              | декларативно, default:disallow + policies                                                                      |
| **v4**: purity G6/G7 (ноль vscode в backend/app-frontend)                                                   | **eslint-plugin-boundaries** (modules) **или** текущий no-restricted-imports + `audit:platform`                                           | boundaries делает это декларативно и читаемо                                                                   |
| **v2**: feature-шаблон (actions/handlers/events/messages, один файл на event)                               | **eslint-plugin-project-structure** (уже в стеке, warn-режим) + наши 21 кастомное правило                                                 | готовые шаблоны не умеют «один файл на event» — это удел `no-misplaced-concern`/`no-monolithic-registration`   |
| **v2**: «руки прочь от store — только getStore/getEnv/getParent»                                            | кастомное `no-direct-store-import` (**уже есть**) + boundaries (запрет импорта `@features/singleton` вне санкционированных путей)         | готовых инструментов на «как вызывается» нет — только свои правила                                             |
| **v2**: «весь стейт в MST, ноль module-level mutable»                                                       | кастомные `no-shadow-store`/`no-state-outside-mobx` (**уже есть**, но с пробелами — см. 12.3)                                             | готовых нет                                                                                                    |
| **v3/v4**: «логика в неправильной папке» (messaging.ts в window-manager вместо features/chat/task/messages) | **готовых НЕТ** — см. 12.4                                                                                                                | самый болезненный пункт, готовых детекторов «semantic misplacement» не существует                              |
| **v3**: один backend-инстанс на оба клиента                                                                 | не линт — это runtime-архитектура (WS-транспорт, single server)                                                                           | чекер может только запретить второй entry-point (boundaries: pattern `**/server.ts` → 1 файл)                  |
| Графы зависимостей / визуализация долга                                                                     | **dependency-cruiser** (7.2k★): path-правила from/to + **baseline mode** (`.dependency-cruiser-known-violations.json`) + dot/mermaid/html | baseline = готовый аналог наших debt-ledger'ов для импортов; fallow уже считает cycles/dead                    |
| Циклические зависимости                                                                                     | **madge** (10.2k★) — CLI + SVG-графы; fallow уже считает cycles                                                                           | madge — только детект, без правил                                                                              |
| Свои AST-проверки, когда готовых нет                                                                        | **ts-morph** (6.2k★, 240k dependents) — обёртка TS Compiler API                                                                           | писать свои «fitness functions» (misplacement, store-access) на нём быстрее, чем на raw ESLint API             |
| Compile-time enforcement (тяжёлый вариант)                                                                  | **TS Project References** (`composite` + `tsc -b`)                                                                                        | физически разбивает на проекты: импорт из чужого проекта = только .d.ts. Дорого: перестройка сборки pnpm+turbo |
| Nx enforce-module-boundaries (tags + depConstraints)                                                        | ❌ **не подходит**: привязан к Nx workspaces, у нас pnpm+turbo                                                                            | упомянут для полноты                                                                                           |

### 12.3 Пробелы наших кастомных правил (найдено при разборе жалоб)

1. **`__moduleState = { messageHandlers: new Map() }`** в `on-webview-message.ts` — module-level mutable **внутри объекта**, а не голое `let`. `no-shadow-store`/`no-state-outside-mobx` его пропускают (ищут только `let`/`var`/`const` с присваиванием в body). Нужно расширить: детектить `const X = { ... }` с мутабельными значениями (Map/Set/массив) на module-уровне.
2. **`createTaskVolatileState()`** в `task/store.ts` — фабрика plain-object со `messages: [] as Notification[]` и `apiConversationHistory: [] as ApiMessage[]`. Это **не** shadow store в классическом смысле: объект вешается через `.volatile()` на TaskModelBase, т.е. живёт ВНУТРИ MST-инстанса. Но это 20+ полей «метод-как-undefined-слот» — фактически класс Task, притворившийся mobx. Правило, которое это поймает: «volatile-фабрика больше N полей = красный флаг» — только кастомное (ts-morph или ESLint).
3. **`self.messages`** в `goals.ts` (57/68) — обращение к коллекции, которой **нет** в TaskModelBase (в модели есть только `notifications.items` и volatile `messages: Notification[]`). Либо `messages` объявляется в другом layers-файле, либо это latent bug (undefined.length → crash). Проверить в `lifecycle.ts`/расширениях модели.

### 12.4 «Логика размазана по неправильным папкам» — решение проблемы

Готовых детекторов **семантического** misplacement нет ни в ESLint-экосистеме, ни в dependency-cruiser, ни в Biome/Oxlint. Варианты, по убыванию практичности:

1. **Запретить размазывание импортными границами (boundaries/dependency-cruiser).** Если `foundation/**` запрещено импортировать `features/chat/**`, а `features/chat/**` — импортировать `foundation/window-manager/**` в обе стороны, то «message-логика в window-manager» становится невозможным: она либо в messages, либо не компилируется. **Это главное готовое решение** — оно не находит уже размазанное, но делает невозможным новое.
2. **Расширить `no-misplaced-concern` декларативной таблицей «concern → allowed paths».** Правило уже есть (concern-машина: action-creator → actions/, handler → handlers/ и т.д.). Добавить в таблицу: `messaging/postMessage` → только `features/chat/task/messages/**`; `handler-registry` → только `features/chat/task/messages/handlers/**`. Тогда перенос = 2 строки в конфиге правила, а не поиск по коду.
3. **ts-morph-скрипт «concern audit»** (вне lint, CI-step): по набору сигнатур (функция с аргументом `Notification`/`ApiMessage` + вызов `postMessage`) находит все файлы, где живёт message-логика, и сравнивает с whitelist. Полезно один раз, чтобы **найти** текущее расслоение (messaging.ts + on-webview-message.ts + store.ts volatile), а дальше держать границы п.1.
4. RPG (наш граф) — `search_node("post message to webview")` уже показывает, в скольких местах живёт эта логика; как CI-чекер не годится, как инструмент аудита — да.

### 12.5 Итоговая рекомендация

- **Добавить в стек: `eslint-plugin-boundaries`** — единственный готовый инструмент, покрывающий v4-purity + feature-изоляцию декларативно. Вписать в `packages/config-eslint/base.js`, debt через `severity: warn` + список исключений (аналог debt-ledger).
- **Добавить: dependency-cruiser** как CI-step с baseline-файлом (визуализация + импорт-долг в одном артефакте, mermaid-графы в PR).
- **Расширить свои правила**: `no-shadow-store` (мутабельные объекты на module-уровне), `no-misplaced-concern` (таблица concern→paths), новое «volatile-фабрика > N полей».
- **ts-morph** — только для разового «concern audit» скрипта, не в постоянный стек.
- madge / Nx / TS project references — не брать (дублирует fallow / чужой build-system / слишком дорого).

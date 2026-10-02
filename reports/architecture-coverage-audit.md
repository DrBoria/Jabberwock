# Аудит покрытия: кастомные чекеры vs 4 архитектурных плана

Дата: 2026-09-29. Ветка `mega-refactoring` (`e5e3b9e83`), рабочий tree — 21 правило + 4 debt-ledger.
Связано: `reports/lint-rules-comparison.md` (сравнение с инструментами, 2026-07-20), `scripts/arch-audit/arch.config.mjs`.

Цель аудита: ответить на вопрос «насколько текущий набор правил покрывает архитектуру из
`architectural-restructure-v2.md`, `architecture-restructure-v3-plan.md`,
`architecture-v4-connector-abstraction.md`, `architecture-v4-single-state.md`, и чего не хватает».

---

## 0. Итог одной таблицей

| Слой инвариантов                                                            | Движок                                                             | Покрытие сейчас                           |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------- |
| (a) внутрифайловые AST-инварианты (состояние, классы, именование, папки)    | ESLint (21 кастомное правило)                                      | **сильное** — ~85%                        |
| (b) межфайловые / графовые (слои, импорты, полнота 1:1, циклы, дубли)       | граф-движок (boundaries / dependency-cruiser) + генерируемые тесты | **почти ноль**                            |
| (c) runtime/поведенческие (один backend, паритет сторов, бюджет исключений) | acceptance/e2e тест                                                | **только smoke, без паритетных ассертов** |
| (d) целостность debt-ledger'ов (списки «только уменьшаются»)                | guard-скрипт                                                       | **отсутствует**                           |

Главный вывод: **проблема не в количестве правил, а в том, что класс (b) и (d) не покрыт вообще,
а два готовых чекера (`audit:arch`, `audit:platform`, jscpd) не подключены к гейту.**
Именно поэтому «модель упускает из вида» — то, что не ловится per-file правилом, не ловится ничем.

---

## 1. Что фактически проверено (evidence)

| Проверка                          | Команда / факт                                      | Результат                                                                                              |
| --------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Гейт зелёный                      | `turbo lint` (17 tasks)                             | ✅ 17/17, 32.8s                                                                                        |
| Состав гейта                      | `package.json`                                      | `check-all = lint && check-types && test`                                                              |
| CI                                | `.github/workflows/code-qa.yml`                     | translations, knip, lint, check-types, test                                                            |
| Кастомные правила                 | `ls packages/config-eslint/rules`                   | 21 файл                                                                                                |
| Debt-ledgers                      | `packages/config-eslint/debt/`                      | 4 файла (shadow-store, impure-utils, passthrough, empty-handlers)                                      |
| `connectors/vscode` lint          | `connectors/vscode/package.json`                    | `echo 'skeleton (Phase A1), no sources yet'` — **49 TS-файлов, 5856 строк НЕ линтятся**                |
| `connectors/vscode` eslint config | `file_search eslint.config.mjs`                     | **отсутствует**                                                                                        |
| arch-audit (ts-morph)             | `reports/arch-audit.json`                           | `total: 0, errors: 0` — и **не в гейте**                                                               |
| audit:platform (v4 G6/G7)         | `package.json`                                      | скрипт есть, **в check-all и CI не вызывается**                                                        |
| jscpd                             | `package.json`                                      | dependency есть, **скрипта нет** (комментарий в `jscpd.config.mjs` «part of check-all» — **неправда**) |
| Циклы зависимостей                | grep по `no-cycle` / `madge` / `dependency-cruiser` | **ни одного чекера**                                                                                   |
| `ban-ts-comment`                  | `backend/eslint.config.mjs:65`                      | `"off"` → `@ts-ignore` разрешён, вопреки `AGENTS.md`                                                   |
| Неограниченный disable            | grep `no-unlimited-disable`                         | не настроен → `/* eslint-disable */` глушит **всё**, включая все local-правила                         |
| `zod` в `@jabberwock/types`       | `packages/types/package.json:25`                    | `zod: 3.25.76` — v3-B6 **не выполнен**, правила-запрета нет                                            |
| frontend: запрет `vscode`         | grep по `frontend/eslint.config.mjs`                | **нет**                                                                                                |
| Мёртвые devDeps                   | grep `functional-core` / `project-structure`        | установлены, **не используются нигде**                                                                 |

⚠️ Замечание по процессу: во время аудита рабочий tree дважды ревертнулся к HEAD
(`stash@{0}: lint-staged automatic backup`) — husky/lint-staged автобэкапил незакоммиченное.
Стейт восстановлен (21 правило на месте, stash пуст). Если работа идёт параллельно в нескольких
сессиях — это источник «исчезающих» файлов.

---

## 2. Матрица покрытия

### 2.1 v2 — 28 core principles (`architectural-restructure-v2.md`)

| #            | Принцип                                               | Чем покрыт                                                              | Статус                                    |
| ------------ | ----------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------- |
| 4            | ALL state in MST, ноль module-level                   | `no-shadow-store`, `no-state-outside-mobx`                              | ✅                                        |
| 10           | Регистрация не монолитная                             | `no-monolithic-registration`                                            | ✅                                        |
| 11           | Один action creator на Event constant                 | `feature-naming`, `actions-purity`                                      | ⚠️ именование — да, **полнота 1:1 — нет** |
| 12           | Один handler на Event/Intent                          | `no-misplaced-concern`, `no-monolithic-registration`                    | ⚠️ то же                                  |
| 15–17        | `events/` у каждой фичи, именование, PascalCase/kebab | `feature-naming`, `no-complex-folder-structure`, `no-logic-in-index`    | ✅ (15 — только если папка есть)          |
| 18           | Импорт из барреля                                     | `no-deep-feature-import`                                                | ✅                                        |
| 19           | Handlers без классов                                  | `no-classes`, `no-shadow-store`                                         | ✅                                        |
| 23           | Регистрация без дублей                                | `no-monolithic-registration`                                            | ⚠️ частично                               |
| 1–3          | EventBridge — единственный IPC, через action creators | `no-direct-ipc` (только `postMessageToWebview`), `no-misplaced-concern` | ⚠️ один канал из многих                   |
| **14**       | **Streaming — ЕДИНСТВЕННОЕ исключение**               | —                                                                       | ❌ **нет бюджета исключений**             |
| **6**        | **Priority buckets, `INTENT_PRIORITY`**               | —                                                                       | ❌ нет проверки полноты карты             |
| **9**        | **Intents строго per-side**                           | —                                                                       | ❌ нет запрета cross-side импорта         |
| **21**       | **Notification только `"ask"`**                       | —                                                                       | ❌ `type: "say"` не запрещён              |
| **22**       | **Discriminated union сообщений**                     | —                                                                       | ❌                                        |
| **24**       | StreamingStore — non-MST                              | —                                                                       | ❌                                        |
| **25**       | Reaction — только observation                         | —                                                                       | ❌                                        |
| **26**       | MST snapshots на dispatch/suspend/resume              | —                                                                       | ❌                                        |
| **27**       | Priority как бакеты, не числа                         | —                                                                       | ❌ числовые литералы разрешены            |
| **7, 8, 28** | yield points, no sync bypass, yield-safety            | —                                                                       | ❌ (статически дорого)                    |

### 2.2 v3 — план правил и реорганизации

| Пункт                                                                | Статус                                                                                                                                           |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rule 1 `no-complex-folder-structure` (A–K)                           | ✅ реализовано и расширено                                                                                                                       |
| Rule 2 `no-dynamic-imports`                                          | ✅                                                                                                                                               |
| Rule 3 `no-root-level-split-store`                                   | ⚠️ отсутствует под этим именем; смысл поглощён `no-store-outside-store` (`storeWordInFilename`, `externalVolatileFactory`, `duplicateModelName`) |
| Rule 4 `no-store-outside-store` + `modelFolderMismatch`              | ✅                                                                                                                                               |
| B3/B4 (merge store split, `messages-model.ts` → `messages/store.ts`) | ✅                                                                                                                                               |
| B7 `buildApi()` EventEmitter                                         | ✅ (`eventEmitterState`)                                                                                                                         |
| B8 динамические импорты                                              | ✅                                                                                                                                               |
| B9 `providers/`                                                      | ⚠️ структурно да (Rule 1), семантически (dynamic-провайдеры ≠ хардкод) — нет                                                                     |
| **B6 убрать zod из `@jabberwock/types`**                             | ❌ **не сделано и не запрещено**                                                                                                                 |
| **B10 дублирующиеся объявления типов**                               | ❌ нет детектора                                                                                                                                 |
| **WHITELIST RULE** («файлов вне структуры быть не должно»)           | ❌ нет проверки                                                                                                                                  |

### 2.3 v4 — connector abstraction

| Требование                                                                                                  | Механизм                                                                                | Статус                                  |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------- |
| G6: ноль `vscode` в `backend/**`                                                                            | ESLint `no-restricted-imports` + allowlist, выведенный из `reports/audit-platform.json` | ⚠️ **две дыры** (см. ниже)              |
| G6: динамический `require("vscode")`                                                                        | `audit:platform`                                                                        | ⚠️ **не в гейте**                       |
| G7: ноль raw `window.addEventListener("message")` / `postMessage` / `acquireVsCodeApi` в app-level frontend | `audit:platform`                                                                        | ❌ **не в гейте, ESLint-правила нет**   |
| G7: запрет импорта `"vscode"` во frontend                                                                   | —                                                                                       | ❌ нет                                  |
| Стороны коннектора не знают друг друга (`frontend` ↛ `backend`)                                             | `arch.config.mjs` ROLES                                                                 | ❌ только в негейтнутом ts-morph аудите |
| `backend/**` ↛ `connectors/**`; providers ≠ connectors                                                      | `arch.config.mjs` LAYERS                                                                | ❌ то же                                |
| **`connectors/vscode/**`(единственное место с`vscode`)\*\*                                                  | —                                                                                       | ❌ **линта нет вообще**                 |
| §3.2 протокол живёт в `packages/types/src/protocol`                                                         | —                                                                                       | ❌                                      |
| §6.1 «не дублировать WS-протокол»                                                                           | —                                                                                       | ❌                                      |
| §8.2 механизмы: ESLint + audit + esbuild без vscode-external                                                | 2 из 3                                                                                  | ⚠️ третий требует отдельной проверки    |

**Две дыры G6:**

1. `loadVscodeAllowlist()` в `backend/eslint.config.mjs` читает allowlist **из артефакта на диске**.
   Комментарий говорит «only shrinks», но **ничто это не проверяет**: перегенерировав
   `reports/audit-platform.json`, можно молча расширить allowlist и остаться зелёным.
2. Сам `audit:platform` (который ловит динамический `require("vscode")`, невидимый для ESLint)
   не вызывается ни в `check-all`, ни в CI.

### 2.4 v4 — single-state

Инварианты §7 (один backend, `hello → state`, reconnect, broadcast, 100% паритет сторов)
— **runtime/поведенческие**, статическим правилом не выражаются. Нужен acceptance-тест.
Сейчас есть `tests/smoke_test.ts` + скилл `smoke-test`, но **паритетных ассертов
(web ↔ vscode ↔ backend по `history.items`, `settings.apiConfig`, `chat.*`) нет.**
Два статических инварианта при этом проверяемы и не проверяются:
(а) одна точка `startBackend()` / один серверный entrypoint;
(б) обе поверхности используют **одну** реализацию WS-протокола.

### 2.5 Доктрина `AGENTS.md`

| Требование                            | Статус                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| `any` запрещён                        | ✅ `no-explicit-any: error`                                                     |
| `as unknown` запрещён                 | ✅ `no-restricted-syntax` (TSAsExpression→TSUnknownKeyword), backend            |
| `ts-ignore` запрещён                  | ❌ `ban-ts-comment: off`                                                        |
| `eslint-disable` запрещён             | ⚠️ запрещён по списку, но `/* eslint-disable */` (unlimited) **не блокируется** |
| «Файлов вне структуры быть не должно» | ❌ нет проверки                                                                 |

---

## 3. Дыры по приоритету

### P0 — дыры, обесценивающие остальное

1. **`connectors/vscode` не линтится**: 49 файлов / 5856 строк, `lint = echo`, нет `eslint.config.mjs`.
   Это ровно тот код, где живёт `import * as vscode` — единственное разрешённое место (G6).
2. **`/* eslint-disable */` (unlimited) не запрещён** → весь набор правил (включая local-\*) гасится одной строкой.
3. **`ban-ts-comment: off`** в backend — прямое противоречие `AGENTS.md`.
4. **Не подключены 3 готовых чекера**: `audit:arch` (ts-morph, 29 типов нарушений),
   `audit:platform` (G6/G7 + динамический require), jscpd (config есть, скрипта нет).
5. **Нет guard'а монотонности** для 4 debt-ledger'ов + `BASELINE_DUPLICATES` + `audit-platform.json`.
6. **Корневой `pnpm lint` без `--continue`** (в отличие от `check-types`/`test`) → падение
   первой пачки скрывает состояние остальных 16.

### P1 — архитектурные инварианты без единого чекера

7. **Полнота 1:1**: `EventConstant` ↔ ровно один `events/actions/send<Name>.ts` и ровно один `events/handlers/on-<name>-received.ts`.
8. **Бюджет исключений (v2 #14)**: `no-direct-ipc` разрешает **что угодно** внутри `/events/actions/` —
   ничто не мешает появиться второму исключению рядом с `sendStreamChunk.ts`.
9. **`INTENT_PRIORITY`**: нет проверки, что карта покрывает все `IntentConstants` (в памяти репо — карта дублирована ×3 → разъедется).
10. **Per-side intents (v2 #9)**: нет запрета импорта frontend-констант интентов в backend и наоборот.
11. **`type: "say"` (v2 #21)** не запрещён.
12. **G7 во frontend**: нет `no-restricted-imports: ["vscode"]`, нет `no-restricted-globals` на `acquireVsCodeApi`,
    нет запрета raw message-listener'ов вне connector'а.
13. **Изоляция коннекторов и слоёв** (стороны, `connectors` ↔ `backend`, providers ↔ connectors) — не выражена нигде, кроме негейтнутого ts-morph.
14. **Нет проверки на циклы зависимостей** вообще.
15. **zod в `@jabberwock/types`** (v3 B6) — ни правила, ни факта.
16. **Дубли имён экспортов** (~120 по прошлому отчёту) — нет детектора.
17. **«Файлов вне структуры нет»** — нет whitelist-проверки.
18. `knip --include files` проверяет только файлы; неиспользуемые экспорты/зависимости не проверяются.

### P2 — гигиена

19. **Мёртвые devDeps**: `eslint-plugin-functional-core`, `eslint-plugin-project-structure` установлены и не подключены.
20. jscpd-конфиг рассинхронизирован с реальностью (комментарий врёт, скрипта нет) — мёртвый код.
21. Нет быстрого слоя для редактора/watch (ESLint 32.8s на гейт).

---

## 4. Что добавить (по движкам)

### 4.1 ESLint — закрыть дыры в существующем стеке (дёшево, без новых зависимостей)

```js
// packages/config-eslint/base.js
"eslint-comments/no-unlimited-disable": "error",
"eslint-comments/no-unused-disable": "error",
"eslint-comments/no-aggregating-enable": "error",

// backend/eslint.config.mjs — вернуть доктрину
"@typescript-eslint/ban-ts-comment": ["error", { "ts-expect-error": "allow-with-description" }],

// frontend/eslint.config.mjs — G7 в гейт
"no-restricted-imports": ["error", { paths: [{ name: "vscode", message: "v4 G7: frontend не импортирует vscode; host-доступ — только через IFrontendConnector." }] }],
"no-restricted-globals": ["error", { name: "acquireVsCodeApi", message: "Только внутри реализации connector'а (§7.3)." }],
"no-restricted-syntax": ["error",
  { selector: "CallExpression[callee.property.name='addEventListener'][arguments.0.value='message']",
    message: "G7: raw window message-listener запрещён вне connector'а — используй IConnectorEventBus." }]
```

```js
// packages/types/eslint.config.mjs — v3 B6
"no-restricted-imports": ["error", { paths: [{ name: "zod", message: "v3 B6: @jabberwock/types не зависит от zod." }] }]
```

### 4.2 Графовый слой — готовые инструменты (то, чего нет совсем)

| Инструмент                            | Версия / популярность  | Что закрывает                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`eslint-plugin-boundaries`**        | 7.2.0, 1.57M/нед, 992★ | Единственный инструмент, выражающий **слои декларативно внутри ESLint**: три измерения (`element` / `file` / `module`), `default: "disallow"` + `policies`. Закрывает P1-13 полностью: стороны коннектора, `backend↛connectors`, `providers↛connectors`, `vscode` только в `connectors/vscode/backend`.                                                                                                                                                                                                                        |
| **`eslint-plugin-project-structure`** | 3.14.4, 65k/нед        | `folder-structure` (wildcard `*` + рекурсия + `enforceExistence`) выражает **WHITELIST RULE** v2 и шаблон фичи одной rule; `independent-modules` — изоляцию; `file-composition` — «`*.types.ts` содержит только типы», «один главный компонент на файл». **Уже установлен — надо только подключить.**                                                                                                                                                                                                                          |
| **`dependency-cruiser`**              | 18.4.0, 7.2k★          | Вне-ESLint CI-шаг: `forbidden`-правила по путям + **`--baseline` с `.dependency-cruiser-known-violations.json`** — нативная семантика «долг только уменьшается» (ровно то, что сейчас руками имитируют 4 ledger'а). Плюс mermaid/dot/html-графы артефактами в PR. Дополнительно ловит type-only и динамические импорты.                                                                                                                                                                                                        |
| **`archunit` (ArchUnitTS)**           | 2.5.4, 496★            | Архитектура как **тесты** в существующем vitest: `projectFiles()...shouldNot().dependOnFiles()`, `haveNoCycles()`, `projectSlices().adhereToDiagram(plantuml)` — можно валидировать **диаграмму топологии v4 напрямую** (§1.1 single-state). Метрики: LCOM, instability, distance-from-main-sequence. Ключевое: **empty-test detection** — тест падает, если паттерн не совпал ни с одним файлом (страховка от «правило есть, а оно ни на что не смотрит» — ровно наш класс ошибок). Требует `globals: true` в vitest-конфиге. |
| **`eslint-plugin-import-x`**          | 4.17.1, 6.3M/нед       | `no-cycle` (дыра P1-14), `no-restricted-paths`, `no-relative-parent-imports`, `no-extraneous-dependencies`, `max-dependencies`. Резолвер быстрее `eslint-plugin-import`.                                                                                                                                                                                                                                                                                                                                                       |
| **`sherif`**                          | 1.13.0, Rust, 440k/нед | Гигиена монорепо: синхронность версий зависимостей across `connectors/*` + `packages/*`, `unordered-dependencies`, root-поля. Дёшево, почти zero-config.                                                                                                                                                                                                                                                                                                                                                                       |

### 4.3 Тестовый слой — то, что правилом выражается плохо

Полноту (P1-7, P1-9) и паритет (2.4) **дешевле и надёжнее** закрыть генерируемыми тестами,
чем ESLint-правилами — они уже в гейте (`pnpm test`):

```ts
// tests/architecture/event-constant-coverage.spec.ts
// 1) каждый EventConstant → ровно один send<Name>.ts
// 2) каждый EventConstant → ровно один on-<name>-received.ts
// 3) каждый IntentConstant → запись в INTENT_PRIORITY (и карта ровно одна)
// 4) ровно один вызов старта backend'а; ровно одна реализация WS-протокола
```

И acceptance-тест паритета из `architecture-v4-single-state.md` §7: снять snapshot
`history.items` / `settings.apiConfig` / `chat.*` с web, vscode и backend, сравнить попарно,
плюс сценарий reconnect. Это и есть критерии готовности того плана, которых сейчас нет ни в одном чекере.

### 4.4 Guard целостности долга (P0-5)

`scripts/check-ledgers.mjs`: читает 4 debt-ledger'а + `BASELINE_DUPLICATES` + `audit-platform.json`,
сравнивает с закоммиченным снимком счётчиков и падает при **росте**. Без него любые allowlist'ы
(включая автогенерируемый vscode-allowlist из §2.3) — фикция.

### 4.5 Быстрый слой (P2-21)

Biome (`check --write`, ~485ms на backend) или Oxlint — только как **watch/editor pre-layer**.
Ядром остаётся ESLint: ни один из них не исполняет кастомные JS-правила (21 шт.) и не умеет
шаблоны папок. Ускорение итерации, не замена гейта.

---

## 5. Рекомендуемый порядок внедрения

1. **P0-1** `connectors/vscode/eslint.config.mjs` + реальный `lint`-скрипт (закрывает 5856 невидимых строк).
2. **P0-4** подключить `audit:platform` + `audit:arch` + jscpd в `check-all` (или отдельный `check-arch` шаг CI).
3. **P0-2/3/6** `no-unlimited-disable` + `ban-ts-comment` + `--continue` — 3 строки конфига.
4. **P0-5** `check-ledgers.mjs` — делает все списки долга честными.
5. **P1-12** G7-правила во frontend → переносит `audit:platform` из «иногда руками» в гейт.
6. **P1-13** `eslint-plugin-boundaries` — декларативные слои v4 + изоляция коннекторов.
7. **P1-7/9 + паритет** архитектурные тесты (vitest) — полнота 1:1, INTENT_PRIORITY, бюджет исключений, паритет сторов.
8. **P1-14** `import-x/no-cycle` или dependency-cruiser с baseline.
9. **P1-15/16/17** zod-запрет, дубли экспортов, whitelist-структура (`project-structure`).
10. **P2** sherif, Biome/Oxlint как watch-слой, удалить мёртвые devDeps или подключить их.

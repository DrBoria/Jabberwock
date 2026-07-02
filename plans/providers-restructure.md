# План: Реструктуризация `src/api/providers/` (строгий)

## ⚠️ ЖЁСТКИЕ ПРАВИЛА

1. **После реструктуризации в `src/api/providers/` должны существовать ТОЛЬКО те файлы/папки, что указаны в этом плане.** Всё остальное должно быть либо перемещено, либо удалено.
2. **Никаких относительных импортов `../`** — запрещено ESLint правилом `no-restricted-imports`. Только `./` для соседних файлов и `@api/providers/...` для кросс-провайдерных импортов.
3. **Никаких классов в shared utilities** — только функции.
4. **Максимум 7 файлов в папке** — если больше, нужно разбить на подпапки.
5. **Каждый провайдер получает свою папку** — даже однофайловые, для консистентности.
6. **Именование внутри папки:** `handler.ts` (основной), `stream.ts` (стриминг), `types.ts` (типы), `utils.ts` (утилиты), `index.ts` (реэкспорт).

---

## ТЕКУЩЕЕ СОСТОЯНИЕ (90+ файлов, до реструктуризации)

```
src/api/providers/
│
├── (УЖЕ В ПАПКАХ — 12 папок, 65 файлов)
│   ├── anthropic/                          ← УЖЕ создано
│   ├── base-openai-compatible-provider/    ← НЕ ТРОГАТЬ
│   ├── bedrock-errors/                     ← Переместить в bedrock/errors/
│   ├── bedrock-stream/                     ← Переместить в bedrock/stream/
│   ├── fetchers/                           ← НЕ ТРОГАТЬ
│   ├── minimax/                            ← УЖЕ стандартизировано
│   ├── mistral/                            ← УЖЕ стандартизировано
│   ├── openai-native-stream/               ← Переместить в openai-native/stream/
│   ├── qwen-code/                          ← УЖЕ стандартизировано
│   ├── requesty/                           ← УЖЕ стандартизировано
│   ├── unbound/                            ← УЖЕ стандартизировано
│   └── utils/                              ← УЖЕ создано (shared utilities)
│
├── (ПЛОСКИЕ ФАЙЛЫ — 57 штук)
│   ├── anthropic-vertex.helpers.ts
│   ├── anthropic-vertex.ts
│   ├── anthropic-vertex.types.ts
│   ├── base-provider.ts               ← ОСТАВИТЬ
│   ├── baseten.ts
│   ├── bedrock-cache.ts
│   ├── bedrock-complete.ts
│   ├── bedrock-models.ts
│   ├── bedrock-payload.ts
│   ├── bedrock-resolve.ts
│   ├── bedrock-tools.ts
│   ├── bedrock-types.ts
│   ├── bedrock.ts
│   ├── constants.ts                   ← ОСТАВИТЬ
│   ├── deepseek.ts
│   ├── fake-ai.ts
│   ├── fireworks.ts
│   ├── gemini-error.ts
│   ├── gemini-stream.ts
│   ├── gemini-tools.ts
│   ├── gemini-types.ts
│   ├── gemini-utils.ts
│   ├── gemini.ts
│   ├── index.ts                       ← ОСТАВИТЬ (обновить)
│   ├── jabberwock-reasoning.ts
│   ├── jabberwock-types.ts
│   ├── jabberwock-utils.ts
│   ├── jabberwock.ts
│   ├── lite-llm.helpers.ts
│   ├── lite-llm.ts
│   ├── lite-llm.types.ts
│   ├── lm-studio.ts
│   ├── moonshot.ts
│   ├── native-ollama.messages.ts
│   ├── native-ollama.stream.ts
│   ├── native-ollama.ts
│   ├── native-ollama.types.ts
│   ├── native-ollama.utils.ts
│   ├── openai-codex-complete.ts
│   ├── openai-codex-error.ts
│   ├── openai-codex-format.ts
│   ├── openai-codex-stream-events.ts
│   ├── openai-codex-stream-output.ts
│   ├── openai-codex-stream-process.ts
│   ├── openai-codex-stream-routing.ts
│   ├── openai-codex-stream.ts
│   ├── openai-codex-tools.ts
│   ├── openai-codex-types.ts
│   ├── openai-codex-usage.ts
│   ├── openai-codex-utils.ts
│   ├── openai-codex.ts
│   ├── openai-compatible.ts
│   ├── openai-models.ts
│   ├── openai-native-complete.ts
│   ├── openai-native-fetch.ts
│   ├── openai-native-format.ts
│   ├── openai-native-request.ts
│   ├── openai-native-types.ts
│   ├── openai-native-usage.ts
│   ├── openai-native.ts
│   ├── openai-o3.ts
│   ├── openai-stream-request.ts
│   ├── openai-stream.ts
│   ├── openai-utils.ts
│   ├── openai.ts
│   ├── openrouter-complete.ts
│   ├── openrouter-helpers.ts
│   ├── openrouter-stream.ts
│   ├── openrouter-types.ts
│   ├── openrouter.ts
│   ├── router-provider.ts             ← ОСТАВИТЬ
│   ├── sambanova.ts
│   ├── vercel-ai-gateway.ts
│   ├── vertex.ts
│   ├── vscode-lm-stream.ts
│   ├── vscode-lm-token-count.ts
│   ├── vscode-lm-tools.ts
│   ├── vscode-lm.ts
│   ├── xai.ts
│   └── zai.ts
```

---

## ЦЕЛЕВОЕ СОСТОЯНИЕ (после реструктуризации)

```
src/api/providers/
├── (ROOT — ОСТАЁТСЯ)
│   ├── base-provider.ts
│   ├── router-provider.ts
│   ├── constants.ts
│   ├── index.ts                              ← обновить пути экспортов
│   └── utils/                                ← уже есть
│       ├── cache-tracking.ts
│       ├── error-handler.ts
│       ├── image-generation/
│       ├── openai-stream-helpers.ts
│       ├── provider-error.ts
│       ├── router-tool-preferences.ts
│       ├── timeout-config.ts
│       └── tool-call-utils.ts
│
├── (ОСТАЁТСЯ КАК ЕСТЬ)
│   ├── base-openai-compatible-provider/      ← не трогать
│   └── fetchers/                             ← не трогать
│
├── (МНОГОФАЙЛОВЫЕ ПРОВАЙДЕРЫ → ПАПКИ)
│   ├── anthropic/                            ← уже создано
│   ├── anthropic-vertex/                     ← СОЗДАТЬ
│   ├── bedrock/                              ← СОЗДАТЬ (включая errors/ + stream/)
│   ├── gemini/                               ← СОЗДАТЬ
│   ├── jabberwock/                           ← СОЗДАТЬ
│   ├── lite-llm/                             ← СОЗДАТЬ
│   ├── native-ollama/                        ← СОЗДАТЬ
│   ├── openai/                               ← СОЗДАТЬ (включая openai-compatible)
│   ├── openai-codex/                         ← СОЗДАТЬ
│   ├── openai-native/                        ← СОЗДАТЬ (включая stream/)
│   ├── openrouter/                           ← СОЗДАТЬ
│   └── vscode-lm/                            ← СОЗДАТЬ
│
└── (ОДНОФАЙЛОВЫЕ ПРОВАЙДЕРЫ → ПАПКИ)
    ├── baseten/
    ├── deepseek/
    ├── fake-ai/
    ├── fireworks/
    ├── lm-studio/
    ├── moonshot/
    ├── sambanova/
    ├── vercel-ai-gateway/
    ├── vertex/
    ├── xai/
    └── zai/
```

---

## ПОФАЙЛОВЫЙ ПЛАН ДЕЙСТВИЙ

### 🟢 STAY (остаются как есть — 4 файла + 4 папки)

| Файл/Папка                         | Действие                               |
| ---------------------------------- | -------------------------------------- |
| `base-provider.ts`                 | Оставить                               |
| `router-provider.ts`               | Оставить                               |
| `constants.ts`                     | Оставить                               |
| `index.ts`                         | Оставить, обновить пути в export-ах    |
| `utils/`                           | Оставить, уже содержит Phase 0 утилиты |
| `base-openai-compatible-provider/` | Оставить как есть                      |
| `fetchers/`                        | Оставить как есть                      |
| `minimax/`                         | Уже стандартизирован (Phase 1) ✅      |
| `mistral/`                         | Уже стандартизирован (Phase 1) ✅      |
| `qwen-code/`                       | Уже стандартизирован (Phase 1) ✅      |
| `requesty/`                        | Уже стандартизирован (Phase 1) ✅      |
| `unbound/`                         | Уже стандартизирован (Phase 1) ✅      |

### 🟡 MOVE (переместить в папки — с переименованием)

#### 1. `anthropic/` (УЖЕ В ПАПКЕ — создано в Phase 2 prelim)

| Откуда                        | Куда                          | Статус                                                                                        |
| ----------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------- |
| `anthropic.ts`                | `anthropic/handler.ts`        | ✅ Сделано                                                                                    |
| `anthropic-stream.ts`         | `anthropic/stream.ts`         | ✅ Сделано                                                                                    |
| `anthropic-stream-helpers.ts` | `anthropic/stream-helpers.ts` | ✅ Сделано                                                                                    |
| `anthropic-stream-events.ts`  | `anthropic/stream-events.ts`  | ✅ Сделано                                                                                    |
| —                             | `anthropic/index.ts`          | ❓ Нужен ли? (index.ts уже разрешает `"./anthropic"` → `anthropic/index.ts`, но его пока нет) |

#### 2. `anthropic-vertex/` (3 файла → папка)

| Откуда                        | Куда                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------- |
| `anthropic-vertex.ts`         | `anthropic-vertex/handler.ts`                                                               |
| `anthropic-vertex.helpers.ts` | `anthropic-vertex/helpers.ts`                                                               |
| `anthropic-vertex.types.ts`   | `anthropic-vertex/types.ts`                                                                 |
| —                             | `anthropic-vertex/index.ts` (создать: `export { AnthropicVertexHandler } from "./handler"`) |

**Импорты в handler.ts:** `"./anthropic-vertex.helpers"` → `"./helpers"`, `"./anthropic-vertex.types"` → `"./types"`

#### 3. `bedrock/` (8 файлов + 2 подпапки → папка)

| Откуда                | Куда                                                                          |
| --------------------- | ----------------------------------------------------------------------------- |
| `bedrock.ts`          | `bedrock/handler.ts`                                                          |
| `bedrock-cache.ts`    | `bedrock/cache.ts`                                                            |
| `bedrock-complete.ts` | `bedrock/complete.ts`                                                         |
| `bedrock-models.ts`   | `bedrock/models.ts`                                                           |
| `bedrock-payload.ts`  | `bedrock/payload.ts`                                                          |
| `bedrock-resolve.ts`  | `bedrock/resolve.ts`                                                          |
| `bedrock-tools.ts`    | `bedrock/tools.ts`                                                            |
| `bedrock-types.ts`    | `bedrock/types.ts`                                                            |
| `bedrock-errors/`     | `bedrock/errors/` (целиком)                                                   |
| `bedrock-stream/`     | `bedrock/stream/` (целиком)                                                   |
| —                     | `bedrock/index.ts` (создать: `export { AwsBedrockHandler } from "./handler"`) |

**Импорты в handler.ts:** префиксы `bedrock-` → убрать везде:

- `"./bedrock-types"` → `"./types"`
- `"./bedrock-stream"` → `"./stream"`
- `"./bedrock-cache"` → `"./cache"`
- и т.д.

**Импорты в bedrock/errors/:** `@api/providers/bedrock-types` → `@api/providers/bedrock/types`
**Импорты в bedrock/stream/:** `@api/providers/bedrock-types` → `@api/providers/bedrock/types`

#### 4. `gemini/` (6 файлов → папка)

| Откуда             | Куда                                                                     |
| ------------------ | ------------------------------------------------------------------------ |
| `gemini.ts`        | `gemini/handler.ts`                                                      |
| `gemini-error.ts`  | `gemini/error.ts`                                                        |
| `gemini-stream.ts` | `gemini/stream.ts`                                                       |
| `gemini-tools.ts`  | `gemini/tools.ts`                                                        |
| `gemini-types.ts`  | `gemini/types.ts`                                                        |
| `gemini-utils.ts`  | `gemini/utils.ts`                                                        |
| —                  | `gemini/index.ts` (создать: `export { GeminiHandler } from "./handler"`) |

**Импорты в handler.ts:** префикс `gemini-` → убрать:

- `"./gemini-stream"` → `"./stream"`
- `"./gemini-error"` → `"./error"`
- `"./gemini-utils"` → `"./utils"`
- `"./gemini-tools"` → `"./tools"`
- `"./gemini-types"` → `"./types"`
- `"./base-provider"` → `"@api/providers/base-provider"` (это root-level)
- `"./constants"` → `"@api/providers/constants"` (это root-level)

#### 5. `openai/` (7 файлов → папка, включая openai-compatible)

| Откуда                     | Куда                                                          |
| -------------------------- | ------------------------------------------------------------- |
| `openai.ts`                | `openai/handler.ts`                                           |
| `openai-compatible.ts`     | `openai/compatible.ts`                                        |
| `openai-models.ts`         | `openai/models.ts`                                            |
| `openai-o3.ts`             | `openai/o3.ts`                                                |
| `openai-stream.ts`         | `openai/stream.ts`                                            |
| `openai-stream-request.ts` | `openai/stream-request.ts`                                    |
| `openai-utils.ts`          | `openai/utils.ts`                                             |
| —                          | `openai/index.ts` (создать: реэкспорт всех хендлеров и типов) |

**Импорты в handler.ts:** префикс `openai-` → убрать:

- `"./openai-stream"` → `"./stream"`
- `"./openai-o3"` → `"./o3"`
- `"./openai-utils"` → `"./utils"`
- `"./openai-stream-request"` → `"./stream-request"`
- `"./openai-compatible"` → `"./compatible"`
- `"./base-provider"` → `"@api/providers/base-provider"`
- `"./constants"` → `"@api/providers/constants"`

#### 6. `openai-native/` (7 файлов + 1 подпапка → папка)

| Откуда                      | Куда                               |
| --------------------------- | ---------------------------------- |
| `openai-native.ts`          | `openai-native/handler.ts`         |
| `openai-native-complete.ts` | `openai-native/complete.ts`        |
| `openai-native-fetch.ts`    | `openai-native/fetch.ts`           |
| `openai-native-format.ts`   | `openai-native/format.ts`          |
| `openai-native-request.ts`  | `openai-native/request.ts`         |
| `openai-native-types.ts`    | `openai-native/types.ts`           |
| `openai-native-usage.ts`    | `openai-native/usage.ts`           |
| `openai-native-stream/`     | `openai-native/stream/` (целиком)  |
| —                           | `openai-native/index.ts` (создать) |

**Импорты в handler.ts:** префикс `openai-native-` → убрать.
**Импорты в openai-native/stream/:** `@api/providers/openai-native-types` → `@api/providers/openai-native/types`, `@api/providers/openai-native-usage` → `@api/providers/openai-native/usage`

#### 7. `openai-codex/` (13 файлов → папка)

| Откуда                           | Куда                              |
| -------------------------------- | --------------------------------- |
| `openai-codex.ts`                | `openai-codex/handler.ts`         |
| `openai-codex-complete.ts`       | `openai-codex/complete.ts`        |
| `openai-codex-error.ts`          | `openai-codex/error.ts`           |
| `openai-codex-format.ts`         | `openai-codex/format.ts`          |
| `openai-codex-stream.ts`         | `openai-codex/stream.ts`          |
| `openai-codex-stream-events.ts`  | `openai-codex/stream-events.ts`   |
| `openai-codex-stream-output.ts`  | `openai-codex/stream-output.ts`   |
| `openai-codex-stream-process.ts` | `openai-codex/stream-process.ts`  |
| `openai-codex-stream-routing.ts` | `openai-codex/stream-routing.ts`  |
| `openai-codex-tools.ts`          | `openai-codex/tools.ts`           |
| `openai-codex-types.ts`          | `openai-codex/types.ts`           |
| `openai-codex-usage.ts`          | `openai-codex/usage.ts`           |
| `openai-codex-utils.ts`          | `openai-codex/utils.ts`           |
| —                                | `openai-codex/index.ts` (создать) |

**Импорты в handler.ts:** префикс `openai-codex-` → убрать.

#### 8. `openrouter/` (5 файлов → папка)

| Откуда                   | Куда                            |
| ------------------------ | ------------------------------- |
| `openrouter.ts`          | `openrouter/handler.ts`         |
| `openrouter-complete.ts` | `openrouter/complete.ts`        |
| `openrouter-helpers.ts`  | `openrouter/helpers.ts`         |
| `openrouter-stream.ts`   | `openrouter/stream.ts`          |
| `openrouter-types.ts`    | `openrouter/types.ts`           |
| —                        | `openrouter/index.ts` (создать) |

**Импорты:** префикс `openrouter-` → убрать.

#### 9. `jabberwock/` (4 файла → папка)

| Откуда                    | Куда                            |
| ------------------------- | ------------------------------- |
| `jabberwock.ts`           | `jabberwock/handler.ts`         |
| `jabberwock-reasoning.ts` | `jabberwock/reasoning.ts`       |
| `jabberwock-types.ts`     | `jabberwock/types.ts`           |
| `jabberwock-utils.ts`     | `jabberwock/utils.ts`           |
| —                         | `jabberwock/index.ts` (создать) |

**Импорты:** префикс `jabberwock-` → убрать.

#### 10. `vscode-lm/` (4 файла → папка)

| Откуда                     | Куда                           |
| -------------------------- | ------------------------------ |
| `vscode-lm.ts`             | `vscode-lm/handler.ts`         |
| `vscode-lm-stream.ts`      | `vscode-lm/stream.ts`          |
| `vscode-lm-token-count.ts` | `vscode-lm/token-count.ts`     |
| `vscode-lm-tools.ts`       | `vscode-lm/tools.ts`           |
| —                          | `vscode-lm/index.ts` (создать) |

**Импорты:** префикс `vscode-lm-` → убрать.

#### 11. `native-ollama/` (5 файлов → папка)

| Откуда                      | Куда                               |
| --------------------------- | ---------------------------------- |
| `native-ollama.ts`          | `native-ollama/handler.ts`         |
| `native-ollama.messages.ts` | `native-ollama/messages.ts`        |
| `native-ollama.stream.ts`   | `native-ollama/stream.ts`          |
| `native-ollama.types.ts`    | `native-ollama/types.ts`           |
| `native-ollama.utils.ts`    | `native-ollama/utils.ts`           |
| —                           | `native-ollama/index.ts` (создать) |

**Импорты:** префикс `native-ollama.` → убрать.

#### 12. `lite-llm/` (3 файла → папка)

| Откуда                | Куда                          |
| --------------------- | ----------------------------- |
| `lite-llm.ts`         | `lite-llm/handler.ts`         |
| `lite-llm.helpers.ts` | `lite-llm/helpers.ts`         |
| `lite-llm.types.ts`   | `lite-llm/types.ts`           |
| —                     | `lite-llm/index.ts` (создать) |

**Импорты:** префикс `lite-llm.` → убрать.

#### 13-23. Однофайловые провайдеры (11 штук)

Каждый получает папку: `{name}/` с `handler.ts` и `index.ts`.

| Откуда                 | Куда                                                          |
| ---------------------- | ------------------------------------------------------------- |
| `baseten.ts`           | `baseten/handler.ts` + `baseten/index.ts`                     |
| `deepseek.ts`          | `deepseek/handler.ts` + `deepseek/index.ts`                   |
| `fake-ai.ts`           | `fake-ai/handler.ts` + `fake-ai/index.ts`                     |
| `fireworks.ts`         | `fireworks/handler.ts` + `fireworks/index.ts`                 |
| `lm-studio.ts`         | `lm-studio/handler.ts` + `lm-studio/index.ts`                 |
| `moonshot.ts`          | `moonshot/handler.ts` + `moonshot/index.ts`                   |
| `sambanova.ts`         | `sambanova/handler.ts` + `sambanova/index.ts`                 |
| `vercel-ai-gateway.ts` | `vercel-ai-gateway/handler.ts` + `vercel-ai-gateway/index.ts` |
| `vertex.ts`            | `vertex/handler.ts` + `vertex/index.ts`                       |
| `xai.ts`               | `xai/handler.ts` + `xai/index.ts`                             |
| `zai.ts`               | `zai/handler.ts` + `zai/index.ts`                             |

### 🔴 DELETE (ничего не удаляется — всё перемещается)

Ни один файл не удаляется. Все существующие файлы либо остаются, либо перемещаются.

---

## ПОРЯДОК ВЫПОЛНЕНИЯ (граф зависимостей)

### Phase 0 ✅ Выполнено

Созданы: `utils/cache-tracking.ts`, `utils/tool-call-utils.ts`, `utils/provider-error.ts`, `utils/openai-stream-helpers.ts`

### Phase 1 ✅ Выполнено

Стандартизированы: `minimax/`, `mistral/`, `qwen-code/`, `requesty/`, `unbound/`

### Phase 2: Многофайловые провайдеры (в порядке сложности)

| Шаг  | Провайдер           | Действие                                   |
| ---- | ------------------- | ------------------------------------------ |
| 2.0  | `anthropic/`        | ✅ Уже создан. Нужен только `index.ts`     |
| 2.1  | `lite-llm/`         | 3 файла, самый простой                     |
| 2.2  | `anthropic-vertex/` | 3 файла                                    |
| 2.3  | `vscode-lm/`        | 4 файла                                    |
| 2.4  | `jabberwock/`       | 4 файла                                    |
| 2.5  | `native-ollama/`    | 5 файлов                                   |
| 2.6  | `openrouter/`       | 5 файлов                                   |
| 2.7  | `gemini/`           | 6 файлов, нужны кросс-провайдерные импорты |
| 2.8  | `openai/`           | 7 файлов + openai-compatible               |
| 2.9  | `openai-native/`    | 7 файлов + подпапка stream/                |
| 2.10 | `openai-codex/`     | 13 файлов                                  |
| 2.11 | `bedrock/`          | 8 файлов + 2 подпапки, самый сложный       |

### Phase 3: Однофайловые провайдеры (все сразу)

11 провайдеров — все одинаковые, можно батчем.

### Phase 4: Кросс-проектные импорты

Обновить эти файлы (если они импортируют старые пути):

- `src/features/settings/handlers/on-settings-models.ts` — может импортировать `@api/providers/openai-models`

### Phase 5: Верификация

```bash
npx tsc --noEmit --pretty -p packages/core/tsconfig.json
npx eslint --config src/eslint.config.mjs src/api/providers/
```

---

## ИМПОРТ СТРАТЕГИЯ

### Правила импортов в перемещённых файлах

После перемещения файла `/providers/<name>.ts` → `/providers/<name>/handler.ts`:

1. **Sibling-импорты** (были `./<name>-foo` → становятся `./foo`):

    - Было: `import { X } from "./bedrock-types"`
    - Стало: `import { X } from "./types"`
    - Механизм: просто удаляем префикс `bedrock-` (или `openai-`, `gemini-` и т.д.)

2. **Root-level импорты** (были `./base-provider` → становятся `@api/providers/base-provider`):

    - Было: `import { BaseProvider } from "./base-provider"`
    - Стало: `import { BaseProvider } from "@api/providers/base-provider"`
    - Это нужно для: `base-provider.ts`, `router-provider.ts`, `constants.ts`

3. **Кросс-провайдерные импорты** (если есть) — оставить как есть, они уже используют `@api/providers/...`

4. **Внешние импорты** (`@jabberwock/*`, `@api/*`, `@shared/*`, `@features/*`, `@anthropic-ai/*`, `openai`) — не меняются.

### index.ts (главный реэкспорт)

Текущие 29 export-ов НЕ МЕНЯЮТ писем:

```
export { AnthropicHandler } from "./anthropic"         // ← работает и с папкой anthropic/
export { AwsBedrockHandler } from "./bedrock"           // ← работает и с папкой bedrock/
```

Путь `"./anthropic"` TypeScript автоматически резолвит в `anthropic/index.ts`.

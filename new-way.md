# Архитектура нелинейного управления контекстом: Изоляция и параллельное выполнение задач в многоагентных системах разработки

## Введение в проблематику управления состоянием ИИ-агентов

Эволюция автономных ИИ-агентов, интегрированных непосредственно в среды разработки (IDE), таких как Roo Code и оригинальный Cline, открыла новые горизонты в парадигмах разработки программного обеспечения. Однако по мере того как амбиции пользователей растут, базовая архитектура управления состоянием этих расширений сталкивается с непреодолимыми физическими и логическими ограничениями.

Традиционный подход к управлению памятью агента предполагает, что все взаимодействия помещаются в единое, постоянно растущее окно контекста в виде плоского массива сообщений. Эта линейная архитектура неизбежно приводит к «логическому отравлению контекста». Особую остроту проблема приобретает при реализации подхода «сначала задачи» (todo-first). Попытки заменить контекст агента после генерации списка задач приводят к потере мета-осознанности оркестратора, а сохранение всей предшествующей логики перегружает модель и ведет к семантическому дрифту.

Данный документ описывает переход от плоских массивов сообщений к сложным, управляемым потокам данных на базе MobX-State-Tree (MST) — Архитектуре Деревьев Бесед (Conversation Tree Architecture). Вторая часть документа представляет собой гранулированный план миграции, разработанный специально для пошагового исполнения ИИ-кодером (например, Trae, Cursor или агентом в консоли).

## Парадигма древовидных бесед (Conversation Tree Architecture)

CTA — это иерархический фреймворк, который организует беседы с LLM в виде дерева дискретных, контекстно-изолированных узлов. Вместо одного бесконечного окна, система поддерживает множество локальных окон контекста. Каждая задача (todo) инициирует создание нового узла (branch).

Система формализуется через абстракции, аналогичные Git, но оптимизированные для семантики LLM:

- **Контрольная точка (Checkpoint):** Иммутабельный снимок состояния беседы.
- **Ветвь (Branch):** Изолированная среда для решения конкретной задачи. Логи компилятора или промежуточные ошибки остаются внутри ветви.
- **Переключение (Switch):** Подмена активного массива сообщений в памяти агента без переноса лишнего контекста.
- **Слияние (Squash & Merge):** Синтез результатов ветви через вызов LLM в лаконичный отчет и его инъекция в родительский узел.

## Мастер-План Миграции (Инструкция для ИИ-разработчика)

Данный раздел представляет собой пошаговый алгоритм для миграции кодовой базы. План разбит на 9 фаз. Каждая фаза содержит цель, объяснение логики, пример кода и инструкции по тестированию.

**Правила для ИИ-агента:**

- Выполняй строго одну фазу за раз.
- Не переходи к следующей фазе, пока не напишешь изолированный Node.js скрипт для проверки работоспособности текущей фазы в консоли.
- Копируй предложенную архитектуру и адаптируй её под существующие типы проекта.

### Стартовый промпт для агента

> "Привет. Мы проводим масштабный рефакторинг архитектуры управления состоянием ИИ-агента. Наша цель — мигрировать на графовую архитектуру MobX-State-Tree, внедрить виртуальную файловую систему, перевести хардкодных агентов в глобальный стейт, реализовать роутинг инструментов (Think Tool) и добавить продвинутые DevTools с Time-Travel и семантическим откатом (diff3).
> Я буду выдавать тебе задачи по фазам. Твоя задача: писать код только для текущей фазы и создавать mock-тест для каждой. Готов начать с Фазы 1?"

---

## Фаза 1: Интеграция графового менеджера состояний (MST)

**Цель:** Создать базовую иерархию дерева задач и сообщений на базе MobX-State-Tree.

**Объяснение:** Плоский массив сообщений не позволяет ветвить историю. Мы создаем древовидную структуру TaskNode, где каждая задача имеет свои messages и ссылки на дочерние подзадачи. MST обеспечит нам реактивность и возможность делать JSON-снимки (снапшоты) всего состояния одним вызовом.

**Промпт для исполнения:**
"Установи `npm install mobx mobx-state-tree`. Создай `src/core/state/ChatTreeStore.ts`. Реализуй модели: `Message`, `TaskNode` (с рекурсивным массивом `children`) и `ChatStore`. Реализуй метод `createBranch`."

**Пример реализации (ChatTreeStore.ts):**

```typescript
import { types, getSnapshot, Instance } from "mobx-state-tree"

export const Message = types.model("Message", {
	id: types.identifier,
	role: types.enumeration(["system", "user", "assistant"]),
	content: types.string,
	timestamp: types.optional(types.Date, () => new Date()),
})

export const TaskNode = types
	.model("TaskNode", {
		id: types.identifier,
		title: types.string,
		status: types.optional(types.enumeration(["pending", "in_progress", "completed", "failed"]), "pending"),
		messages: types.array(Message),
		// Используем late для рекурсивной ссылки на самого себя
		children: types.array(types.late(() => types.reference(TaskNode))),
		parentId: types.maybe(types.string),
	})
	.actions((self) => ({
		addMessage(role: "system" | "user" | "assistant", content: string) {
			self.messages.push(Message.create({ id: Math.random().toString(), role, content }))
		},
		setStatus(newStatus: "pending" | "in_progress" | "completed" | "failed") {
			self.status = newStatus
		},
	}))

export const ChatStore = types
	.model("ChatStore", {
		nodes: types.map(TaskNode),
		activeNodeId: types.maybe(types.reference(TaskNode)),
	})
	.actions((self) => ({
		createBranch(parentId: string | undefined, title: string, id: string) {
			const node = TaskNode.create({ id, title, parentId })
			self.nodes.put(node)
			// Если есть родитель, добавляем ссылку на новую ветку в его children
			if (parentId && self.nodes.has(parentId)) {
				self.nodes.get(parentId)!.children.push(node.id)
			}
			self.activeNodeId = node
			return node
		},
		switchContext(nodeId: string) {
			if (self.nodes.has(nodeId)) {
				self.activeNodeId = self.nodes.get(nodeId)
			}
		},
	}))

export type IChatStore = Instance<typeof ChatStore>
```

**Как тестировать агенту:**

1. Создать файл `test-phase1.ts`.
2. Инициализировать `ChatStore.create({ nodes: {} })`.
3. Вызвать `createBranch` для создания корневой задачи (Root).
4. Добавить в нее `Message`.
5. Затем вызвать `createBranch` с ID корневой задачи для создания ветки.
6. Убедиться через `console.log(JSON.stringify(getSnapshot(store), null, 2))`, что структура нормализована (nodes хранятся в map, а children хранят только ID).

---

## Фаза 2: Унификация агентов и управление инструментами (RBAC)

**Цель:** Сделать стандартных агентов (Ask, Debug, Code, Architect) редактируемыми глобальными сущностями.

**Объяснение:** Жестко захардкоженные промпты агентов трудно расширять. Вынося их в стейт, пользователь сможет редактировать роли агентов через настройки (Settings UI) и включать/выключать им определенные инструменты (Tools) через систему разрешений.

**Промпт для исполнения:**
"Создай `src/core/state/AgentStore.ts`. Опиши модели `ToolConfig` и `AgentProfile`. Заполни дефолтными агентами в хуке `afterCreate`. Добавь метод `.canUseTool(toolId)`."

**Пример реализации (AgentStore.ts):**

```typescript
import { types } from "mobx-state-tree"

export const ToolConfig = types
	.model("ToolConfig", {
		id: types.identifier,
		name: types.string,
		isEnabled: types.boolean,
	})
	.actions((self) => ({
		toggle() {
			self.isEnabled = !self.isEnabled
		},
	}))

export const AgentProfile = types
	.model("AgentProfile", {
		id: types.identifier,
		name: types.string,
		role: types.string,
		systemPrompt: types.string,
		allowedTools: types.array(types.reference(ToolConfig)), // Ссылки на инструменты
	})
	.views((self) => ({
		// Проверка прав доступа агента к инструменту
		canUseTool(toolId: string): boolean {
			const tool = self.allowedTools.find((t) => t.id === toolId)
			return tool ? tool.isEnabled : false
		},
	}))

export const AgentStore = types
	.model("AgentStore", {
		tools: types.map(ToolConfig),
		agents: types.map(AgentProfile),
	})
	.actions((self) => ({
		afterCreate() {
			// Регистрируем глобальные инструменты
			self.tools.put({ id: "edit_file", name: "Edit File", isEnabled: true })
			self.tools.put({ id: "analyze_image", name: "Analyze Image", isEnabled: true })
			self.tools.put({ id: "run_terminal", name: "Run Terminal", isEnabled: true })

			// Создаем профили агентов
			self.agents.put({
				id: "architect",
				name: "Architect",
				role: "Planner",
				systemPrompt: "You are an architect. Focus on high-level design...",
				// Архитектор не может изменять файлы
				allowedTools: ["analyze_image"],
			})

			self.agents.put({
				id: "coder",
				name: "Coder",
				role: "Developer",
				systemPrompt: "You are a coder. Implement the provided spec...",
				allowedTools: ["edit_file", "run_terminal"],
			})
		},
	}))
```

**Как тестировать агенту:**

1. Создать `test-phase2.ts`.
2. Инициализировать `AgentStore.create({ tools: {}, agents: {} })`.
3. Получить агента "architect" и агента "coder".
4. Сделать `console.assert(coder.canUseTool("edit_file") === true)` и `console.assert(architect.canUseTool("edit_file") === false)`.
5. Вызвать `toggle()` у `edit_file` и проверить, что доступ у coder пропал.

---

## Фаза 3: Инструмент "Think", Маршрутизация Моделей и DevTools

**Цель:** Добавить логику маршрутизации моделей (Model Routing) для конкретных инструментов и замер производительности.

**Объяснение:** Инструмент "Think" должен использовать специализированные reasoning-модели (например, DeepSeek-R1). Мы добавляем `toolModelRouting`, чтобы юзер мог в UI назначить: "Для Analyze Image использовать GPT-4o, для Think использовать DeepSeek". Также мы оборачиваем инструменты в `DevToolsLogger` для трекинга времени и стоимости.

**Промпт для исполнения:**
"1. В AgentStore добавь мапу `toolModelRouting` и метод `resolveModelForTool`. 2. Создай `DevToolsLogger.ts` с замером времени. 3. Напиши логику вызова `ThinkTool` с пробросом параметров DeepSeek (thinking: { type: 'enabled' })."

**Пример реализации (ToolRouter и ThinkTool.ts):**

```typescript
// --- 1. Дополнения в AgentStore ---
// Внутри AgentStore.props:
// toolModelRouting: types.map(types.string) // ключ - toolId, значение - modelId

// Внутри AgentStore.views:
resolveModelForTool(toolId: string, fallbackModelId: string): string {
    if (self.toolModelRouting.has(toolId)) {
        return self.toolModelRouting.get(toolId)!;
    }
    return fallbackModelId;
}

// --- 2. DevToolsLogger.ts ---
export class DevToolsLogger {
    static async track<T>(toolName: string, agentId: string, executeFn: () => Promise<T>): Promise<T> {
        const startTime = performance.now();
        try {
            const result = await executeFn();
            const durationMs = performance.now() - startTime;

            // В реальном приложении отправляем событие в UI DevTools панели
            console.log(` 🛠️ Tool: ${toolName} | 🤖 Agent: ${agentId} | ⏱️ ${durationMs.toFixed(2)}ms`);
            return result;
        } catch (error) {
            console.error(` ❌ Tool ${toolName} failed:`, error);
            throw error;
        }
    }
}

// --- 3. ThinkTool.ts ---
export async function executeThinkTool(prompt: string, agentStore: any, defaultModel: string) {
    const modelId = agentStore.resolveModelForTool("think_tool", defaultModel);

    return DevToolsLogger.track("think_tool", "orchestrator", async () => {
        // Логика API вызова (например, к OpenAI-совместимому API DeepSeek)
        const payload = {
            model: modelId,
            messages: [{ role: "user", content: prompt }],
            // Специфичный параметр для включения Chain-of-Thought
            extra_body: { thinking: { type: "enabled" } }
        };

        // Имитация ответа от API
        await new Promise(r => setTimeout(r, 500));
        return "Reasoning: We should use a proxy pattern here...\nResult: done.";
    });
}
```

**Как тестировать агенту:**

1. Создать `test-phase3.ts`.
2. Добавить маршрут: `agentStore.toolModelRouting.put("think_tool", "deepseek-r1")`.
3. Вызвать `executeThinkTool`.
4. Убедиться, что в консоль вывелся лог DevTools с временем выполнения, а возвращенный `modelId` соответствует настроенному в роутере.

---

## Фаза 4: Виртуальная изоляция файлов (VFS)

**Цель:** Дать агентам изолированную файловую систему (песочницу) без использования git worktree.

**Объяснение:** Мы хотим, чтобы агент, выполняя подзадачу, мог создавать и удалять файлы без риска сломать основной проект. Используем паттерн "Copy-on-Write" на базе пакетов `memfs` (виртуальный диск) и `unionfs` (склеивание реального диска и виртуального). Чтение идет откуда угодно, запись — строго в память.

**Промпт для исполнения:**
"Установи `memfs` и `unionfs`. Создай `src/core/fs/VirtualWorkspace.ts`. Инициализируй `Volume`. Объедини его с реальным `fs`. Напиши методы `readFile` (из union) и `writeFile` (только в memfs). Добавь `rollback()` и `commitToDisk()`."

**Пример реализации (VirtualWorkspace.ts):**

```typescript
import { Volume, createFsFromVolume } from "memfs"
import { ufs } from "unionfs"
import * as fs from "fs"
import * as path from "path"

export class VirtualWorkspace {
	public vol: InstanceType<typeof Volume>
	public overlayFs: typeof ufs

	constructor() {
		this.vol = new Volume()
		const virtualFs = createFsFromVolume(this.vol)

		// Объединяем реальную ФС и виртуальную
		this.overlayFs = ufs.use(fs).use(virtualFs as any)
	}

	// Запись происходит ТОЛЬКО в оперативную память (песочницу)
	async writeFile(filePath: string, content: string): Promise<void> {
		return new Promise((resolve, reject) => {
			this.vol.mkdirpSync(path.dirname(filePath))
			this.vol.writeFile(filePath, content, (err) => (err ? reject(err) : resolve()))
		})
	}

	// Чтение берет файл из памяти (если изменен) или с жесткого диска
	async readFile(filePath: string): Promise<string> {
		return new Promise((resolve, reject) => {
			this.overlayFs.readFile(filePath, "utf8", (err, data) => {
				if (err) reject(err)
				else resolve(data as string)
			})
		})
	}

	// Откат всех изменений агента в ветке
	rollback() {
		this.vol.reset() // Очищает memfs
	}

	// Фиксация изменений из памяти на реальный диск (Squash)
	async commitToDisk(basePath: string) {
		const jsonExport = this.vol.toJSON()
		for (const [virtualPath, content] of Object.entries(jsonExport)) {
			if (content) {
				const absolutePath = path.join(basePath, virtualPath)
				fs.writeFileSync(absolutePath, content)
			}
		}
		this.vol.reset()
	}
}
```

**Как тестировать агенту:**

1. Создать `test-phase4.ts`.
2. Создать `new VirtualWorkspace()`.
3. Вызвать `writeFile('/virtual-test.js', 'console.log("AI")')`.
4. Прочитать файл через `readFile` и вывести в консоль (должен вернуть контент).
5. Проверить реальную файловую систему через стандартный `fs.existsSync('/virtual-test.js')` — должно вернуть `false`.
6. Вызвать `rollback()`.
7. Прочитать файл через `readFile` — должна быть ошибка (файл не найден).

---

## Фаза 5: Маршрутизация контекста и MCP Инъекции

**Цель:** Передача скрытых системных переменных в MCP-приложения и алгоритмическое сжатие ветки (Squash & Merge).

**Объяснение:** Внешние MCP-серверы (например, `md-todo-mcp`) нуждаются в контексте (имя агента, путь к проекту). Передавать это в текстовом промпте — трата токенов и риск галлюцинаций. Мы перехватываем вызов инструмента до отправки и инжектируем метаданные в служебное поле `_meta` спецификации JSON-RPC.

**Промпт для исполнения:**
"1. Создай перехватчик для MCP. Добавь скрытый объект `_meta` с параметрами сессии в `callTool`. 2. В ChatStore добавь метод `squashAndMerge(branchId, targetParentId)`, который берет сообщения ветки, делает мок-запрос к LLM на суммаризацию, добавляет 1 результирующее сообщение в `targetParentId` и удаляет старую ветку."

**Пример реализации (McpInterceptor и Слияние):**

```typescript
// --- 1. Инъекция MCP Meta ---
export async function executeMcpToolSafe(client: any, toolName: string, args: any, sessionData: any) {
    // Внедряем скрытый контекст в JSON-RPC запрос через _meta
    const payload = {
       ...args
    };

    const requestOptions = {
        meta: {
            workspacePath: sessionData.path,
            activeAgentRole: sessionData.agentRole,
            taskId: sessionData.taskId
        }
    };

    // Отправляем на сервер. MCP сервер извлечет _meta, а LLM его не увидит.
    return await client.callTool(toolName, payload, requestOptions);
}

// --- 2. Squash and Merge (в ChatStore) ---
// ... внутри actions(self => ({
async squashAndMerge(branchId: string, targetParentId: string, llmApi: any) {
    const branch = self.nodes.get(branchId);
    const parent = self.nodes.get(targetParentId);
    if (!branch || !parent) return;

    const branchHistory = branch.messages.map(m => `${m.role}: ${m.content}`).join('\n');

    // Скрытый запрос к LLM для семантического сжатия
    const summary = await llmApi.summarize(`
        Extract key insights, file changes, and unsolved issues from this sub-agent run:
        ${branchHistory}
    `);

    // Инъекция результата в родительскую ветку
    parent.addMessage("system", `\nSummary:\n${summary}`);

    // Переключаемся обратно и удаляем мусор
    self.activeNodeId = parent;
    self.nodes.delete(branchId);
}
```

**Как тестировать агенту:**

1. Создать `test-phase5.ts`.
2. Сделать мок-объект `client` с методом `callTool`, который просто `console.log` аргументы и опции.
3. Вызвать `executeMcpToolSafe` и убедиться, что `_meta` корректно пробрасывается в опции запроса, не смешиваясь с бизнес-аргументами `args`.

---

## Фаза 6: Транзакционная память (Human-in-the-loop)

**Цель:** Позволить пользователю редактировать планы (TODO) агента без разрушения его "мета-осознанности".

**Объяснение:** Если оркестратор написал плохой список задач в ответе, юзер может поправить его в UI. Чтобы модель не узнала о вмешательстве, мы напрямую патчим её ответ в дереве MST.

**Промпт для исполнения:**
"Добавь экшен `rewriteAssistantMessage` в `TaskNode`. Он находит сообщение по ID и просто заменяет `content`. Благодаря реактивности MST это создаст консистентный JSON Patch."

**Пример реализации (дополнение к TaskNode):**

```typescript
// Внутри TaskNode.actions(self => ({
rewriteAssistantMessage(messageId: string, newContent: string) {
    const targetMsg = self.messages.find(m => m.id === messageId);
    if (!targetMsg) throw new Error("Message not found");
    if (targetMsg.role !== "assistant") throw new Error("Can only rewrite assistant messages");

    // Перезаписываем историю. При следующем обращении LLM будет уверена,
    // что именно она сгенерировала этот идеальный план.
    targetMsg.content = newContent;
}
```

**Как тестировать агенту:**

1. Создать `test-phase6.ts`.
2. Добавить сообщение ассистента со сломанным TODO.
3. Вызвать `rewriteAssistantMessage`.
4. Сделать `getSnapshot(store)` и убедиться, что контент успешно заменен на нужный.

---

## Фаза 7: Timeline (Time-Travel) для чата и файлов

**Цель:** Создать синхронный таймлайн, фиксирующий и чат, и файловую систему на каждом шаге.

**Объяснение:** Чтобы ползунок истории работал корректно, нам нужны комбинированные кадры (Frames). В кадре сохраняется JSON стейта чата и JSON виртуальной ФС. Перемотка назад восстанавливает оба стейта.

**Промпт для исполнения:**
"Создай `TimelineStore.ts`. Определи `Frame` (chatState, fsState). Добавь метод `captureFrame(chatStore, vfs)`. Реализуй `rewindTo(index)` с вызовом `applySnapshot` для чата и `fromJSON` для VFS."

**Пример реализации (TimelineStore.ts):**

```typescript
import { types, applySnapshot, getSnapshot } from "mobx-state-tree"
import { VirtualWorkspace } from "./VirtualWorkspace" // из Фазы 4

const Frame = types.model("Frame", {
	id: types.identifier,
	chatState: types.frozen(),
	fsState: types.frozen(),
})

export const TimelineStore = types
	.model("TimelineStore", {
		frames: types.array(Frame),
		currentIndex: types.number,
	})
	.actions((self) => ({
		captureFrame(chatStore: any, vfs: VirtualWorkspace) {
			self.frames.push({
				id: Math.random().toString(),
				chatState: getSnapshot(chatStore),
				fsState: vfs.vol.toJSON(),
			})
			self.currentIndex = self.frames.length - 1
		},

		rewindTo(index: number, chatStore: any, vfs: VirtualWorkspace) {
			if (index < 0 || index >= self.frames.length) return

			const frame = self.frames[index]
			// Синхронный откат
			applySnapshot(chatStore, frame.chatState)
			vfs.vol.reset()
			vfs.vol.fromJSON(frame.fsState)

			self.currentIndex = index
			// Мы НЕ удаляем будущее (срез массива), чтобы можно было сделать Fast-Forward
		},
	}))
```

**Как тестировать агенту:**

1. Создать `test-phase7.ts`. Инициализировать `chatStore`, `vfs` и `timelineStore`.
2. Шаг 1: добавить сообщение, записать файл "A", сделать `captureFrame`.
3. Шаг 2: добавить сообщение, записать файл "B", сделать `captureFrame`.
4. Сделать `rewindTo(0)`. Проверить, что файл "B" исчез из `vfs`, а в чате только 1 сообщение.
5. Сделать `rewindTo(1)` (Fast-forward). Проверить, что файл "B" вернулся.

---

## Фаза 8: Точечный откат изменений (Selective Revert) и разрешение конфликтов

**Цель:** Отменить правки конкретного старого сообщения (например, 9-го), сохранив новые (10-го и 12-го) с помощью 3-way merge.

**Объяснение:** Откат старого файла через простые патчи не сработает, если строки съехали. Мы используем `diff-match-patch` для создания инвертированного патча (меняем удаления на добавления и наоборот), и применяем его к текущему файлу. Если возникает конфликт, генерируем маркеры diff3 и просим ИИ починить их.

**Промпт для исполнения:**
"Установи `diff-match-patch`. Создай `SelectiveRevertService.ts`. Реализуй методы `getInvertedPatch` (инверсия операций), `applyRevert` (применение и детекция false в массиве результатов). Если конфликт — возвращай строку с маркерами `<<<<<<< HEAD`. Добавь `fixWithAI`."

**Пример реализации (SelectiveRevertService.ts):**

```typescript
import DiffMatchPatch from "diff-match-patch"

export class SelectiveRevertService {
	private dmp = new DiffMatchPatch()

	// 1. Вычисление дельты между "ДО" и "ПОСЛЕ" 9-го сообщения и её инверсия
	public getInvertedPatch(textBefore: string, textAfter: string) {
		const diffs = this.dmp.diff_main(textBefore, textAfter)
		this.dmp.diff_cleanupSemantic(diffs)

		// Инвертируем операции: то, что добавилось - удаляем, то, что удалилось - возвращаем
		const invertedDiffs = diffs.map((diff) => {
			if (diff[0] === 1) return [-1, diff[1]] as [number, string] // INSERT -> DELETE
			if (diff[0] === -1) return [1, diff[1]] as [number, string] // DELETE -> INSERT
			return diff // EQUAL (0) остается как есть
		})

		return this.dmp.patch_make(textAfter, invertedDiffs)
	}

	// 2. Наложение инвертированного патча на ТЕКУЩЕЕ состояние (сообщения 10, 12)
	public applyRevert(invertedPatches: any, currentText: string, textBefore: string, textAfter: string) {
		const [patchedText, results] = this.dmp.patch_apply(invertedPatches, currentText)

		// patch_apply возвращает массив boolean для каждого чанка. Если есть false - это конфликт
		const hasConflicts = results.some((res) => res === false)
		if (hasConflicts) {
			// Генерируем diff3 для LLM-резолвера
			const conflictMarker = `<<<<<<< HEAD (Current State with recent changes)
${currentText}

||||||| BASE (State after msg 9)
${textAfter}
=======
${textBefore}
>>>>>>> REVERT_TARGET (State before msg 9 - What we want)`

			return { success: false, content: conflictMarker }
		}

		return { success: true, content: patchedText as string }
	}

	// 3. Автоматическое разрешение конфликта с помощью AI
	public async fixWithAI(conflictText: string, llmApi: any) {
		const prompt = `
        You are an expert at resolving Git merge conflicts. The user is selectively reverting an old change, but it conflicts with recent work.
        Resolve the conflict semantically:
        1. Remove the logic introduced in REVERT_TARGET.
        2. KEEP and ADAPT the new logic from HEAD.
        Return ONLY the final clean code without markers or markdown backticks.
        
        Conflict snippet:
        ${conflictText}
        `
		return await llmApi.query(prompt)
	}
}
```

**Как тестировать агенту:**

1. Создать `test-phase8.ts`.
2. Написать `textBefore = "function A() { return 1; }"`, `textAfter = "function A() { return 2; }"` (это было 9-е сообщение).
3. Написать `currentText = "function A() { return 2; }\nfunction B() { return 3; }"` (это 10-е сообщение добавило B).
4. Пропустить через `getInvertedPatch` и `applyRevert`.
5. Проверить, что `patchedText` равен `"function A() { return 1; }\nfunction B() { return 3; }"` (откатили А, но сохранили B).

---

## Фаза 9: Agent-Driven Time Travel и Мультивселенная Таймлайнов

**Цель:** Дать агенту инструменты для осознанного перемещения во времени и управлять ветками истории.

**Объяснение:** Когда агент ломает билд, он должен иметь возможность вызвать инструмент `time_travel(-5)`. Это откатит файлы, но НЕ чат (агент запомнит свою ошибку). Если он начнет писать новый код из прошлого, мы создаем "ветку реальности" (TimelineBranch).

**Промпт для исполнения:**
"1. В `TimelineStore.ts` замени массив `frames` на `mainTimeline` и мапу `alternateBranches`. Добавь логику создания ветки при записи в прошлом. 2. Создай инструмент для агента `timeTravelTool`. 3. Добавь метод `switchTimeline` для переключения между экспериментами."

**Пример реализации (TimeTravel & Branching):**

```typescript
import { types, applySnapshot } from "mobx-state-tree"

// Дополнение в TimelineStore (из Фазы 7)
export const TimelineTreeStore = types
	.model("TimelineTreeStore", {
		mainTimeline: types.array(Frame),
		alternateBranches: types.map(types.array(Frame)),
		activeBranchId: types.optional(types.string, "main"),
		currentIndex: types.number,
	})
	.actions((self) => ({
		// Вызывается перед любой операцией записи файла
		onFileWrite() {
			const activeFrames =
				self.activeBranchId === "main" ? self.mainTimeline : self.alternateBranches.get(self.activeBranchId)!

			// Если мы в прошлом и пытаемся писать -> Форк мультивселенной
			if (self.currentIndex < activeFrames.length - 1) {
				const newBranchId = `branch_${Date.now()}`
				const forkedHistory = activeFrames.slice(0, self.currentIndex + 1)
				self.alternateBranches.put(newBranchId, forkedHistory)
				self.activeBranchId = newBranchId
			}
		},

		// Инструмент для LLM: Переключение в любую ветку (например, возврат в main)
		switchTimeline(branchId: string, chatStore: any, vfs: any) {
			if (branchId !== "main" && !self.alternateBranches.has(branchId)) throw new Error("Branch not found")

			self.activeBranchId = branchId
			const targetBranch = branchId === "main" ? self.mainTimeline : self.alternateBranches.get(branchId)!
			self.currentIndex = targetBranch.length - 1

			// Полное 100% восстановление реальности (и чата, и файлов)
			const frame = targetBranch[self.currentIndex]
			applySnapshot(chatStore, frame.chatState)
			vfs.vol.reset()
			vfs.vol.fromJSON(frame.fsState)

			return `Switched to timeline: ${branchId}`
		},
	}))

// Инструмент, пробрасываемый агенту (System Prompt Tool)
export async function timeTravelTool(offset: number, timelineStore: any, vfs: any) {
	const newIndex = timelineStore.currentIndex + offset
	const targetBranch =
		timelineStore.activeBranchId === "main"
			? timelineStore.mainTimeline
			: timelineStore.alternateBranches.get(timelineStore.activeBranchId)

	if (newIndex < 0 || newIndex >= targetBranch.length) return "Invalid offset"

	// ОТКАТ ТОЛЬКО ФАЙЛОВ. Чат агента продолжается, чтобы он помнил ошибку!
	const frame = targetBranch[newIndex]
	vfs.vol.reset()
	vfs.vol.fromJSON(frame.fsState)
	timelineStore.currentIndex = newIndex

	return `Time travel successful. Files reverted by ${offset} steps. Analyze the issue and try a new approach.`
}
```

**Как тестировать агенту:**

1. Создать `test-phase9.ts`.
2. Сделать 5 фреймов в `mainTimeline`.
3. Вызвать `timeTravelTool(-3)` (мы на шаге 2).
4. Вызвать `onFileWrite()`. Проверить, что создалась новая ветка `branch_XXX` и мы теперь в ней.
5. Вызвать `switchTimeline("main")`. Убедиться, что `currentIndex` вернулся на 4 (вершина main), а файлы восстановились.

---

Следуя этому гранулированному и насыщенному кодом плану, вы сможете последовательно реализовать надежную, масштабируемую и прозрачную архитектуру деревьев состояния, не прибегая к тяжеловесным системным утилитам, и обеспечив максимальный контроль ИИ-агента над собственным мыслительным процессом.

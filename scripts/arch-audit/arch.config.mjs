/**
 * arch.config.mjs — ЕДИНАЯ спецификация архитектуры v2.
 *
 * Читается всеми слоями проверки (ESLint-подмножество, ts-morph аудитор,
 * dependency-cruiser). Правка правил = правка этого файла, а не кода проверок.
 *
 * ПРИНЦИП: whitelist, а не blacklist.
 *   - путь не попал ни в один слот        → NO_SLOT
 *   - поведение не сходится с ролью слота → <ROLE>-MISMATCH
 *   - тип описывает то, чего нет в модели → SHADOW-STATE
 * Всё, что не влезает в архитектуру, — плохо.
 */

/** Роли и их канонические места. `home` — то, что печатается в колонке «КУДА». */
export const ROLES = {
	barrel: {
		title: "barrel (index.ts)",
		home: "<feature>/index.ts",
		may: ["реэкспорт публичного API фичи"],
		mayNot: ["логика", "побочные эффекты", "импорт глубоких путей соседних фич"],
	},
	"mst-model": {
		title: "MST-модель",
		home: "<feature>/store.ts",
		may: ["types.model", "actions", "views (computed)"],
		mayNot: ["свободные экспортируемые функции", "интерфейсы, описывающие другие сторы"],
	},
	"event-action": {
		title: "event action creator",
		home: "<feature>/events/actions/send<Name>.ts",
		may: ["создать Intent", "отправить Event через единственный канал", "читать стор"],
		mayNot: ["синглтоны", "await IO", "сборка state из нескольких источников"],
	},
	"event-handler": {
		title: "event handler",
		home: "<feature>/events/handlers/on-<event>-received.ts",
		may: ["принять Event", "создать Intent"],
		mayNot: ["прямой IPC (должен создавать Intent)"],
	},
	"intent-action": {
		title: "intent action creator",
		home: "<feature>/actions/<IntentName>.ts",
		may: ["создать Intent", "чистая подготовка payload"],
		mayNot: ["синглтоны", "IPC", "async IO"],
	},
	"intent-handler": {
		title: "intent handler",
		home: "<feature>/handlers/on-<intent>.ts",
		may: ["side effects", "мутация MST-стора", "IPC через event action creator"],
		mayNot: ["прямой IPC"],
	},
	"state-view": {
		title: "производное состояние (computed view)",
		home: "<feature>/store.ts → views (computed на модели)",
		may: ["читать стор", "чистое вычисление"],
		mayNot: ["синглтоны", "await IO", "побочные эффекты"],
	},
	util: {
		title: "чистая утилита",
		home: "<feature>/utils/<name>.ts",
		may: ["чистое вычисление из аргументов"],
		mayNot: ["синглтоны", "IPC", "module-level state", "await IO"],
	},
	tool: {
		title: "реализация инструмента агента",
		home: "<feature>/tools/<Name>Tool/ (по одному домену на тулзу)",
		may: ["описание тулзы", "схема аргументов", "execute()"],
		mayNot: ["module-level state", "регистрация чужих тулз", "алфавитные корзины вместо домена"],
	},
	types: {
		title: "типы фичи",
		home: "<feature>/types.ts",
		may: ["type/interface"],
		mayNot: ["index-signature мешки на IPC-границе", "описание состояния, которого нет в модели"],
	},
	constants: {
		title: "константы фичи",
		home: "<feature>/constants.ts",
		may: ["as const значения"],
		mayNot: ["EventConstants / IntentConstants (они в @jabberwock/types)"],
	},
	"intent-bus": {
		title: "IntentBus (fiber scheduler)",
		home: "<feature>/intents/bus.ts",
		may: ["очередь приоритетов", "шедулер", "внутреннее состояние планировщика"],
		mayNot: ["доменные данные фичи"],
	},
	"intent-context": {
		title: "IntentHandlerContext",
		home: "<feature>/intents/context.ts",
		may: ["тип контекста"],
		mayNot: ["логика", "состояние"],
	},
	channel: {
		title: "ipc-bridge (ремень, НЕ транспорт)",
		home: "connectors/<host>/backend/connector.ts — транспорт у коннектора (v4 §4.2)",
		may: ["лог исходящих", "передать вызов в коннектор"],
		mayNot: ["быть единственной точкой IPC (v4: канал — коннектор)", "доменная логика"],
	},
	"connector-backend": {
		title: "коннектор, backend-сторона (Node runtime)",
		home: "connectors/<host>/backend/**",
		may: ["транспорт", "импорт хост-специфичных API (vscode и т.п.)"],
		mayNot: ["импорт из ../frontend (стороны не знают друг друга)"],
	},
	"connector-frontend": {
		title: "коннектор, frontend-сторона (browser-safe)",
		home: "connectors/<host>/frontend/**",
		may: ["транспорт в браузере", "IConnectorEventBus"],
		mayNot: ["import vscode", "импорт из ../backend"],
	},
	"model-provider": {
		title: "LLM model provider (НЕ коннектор, v4 §1.3a)",
		home: "backend/api/providers/<name>/",
		may: ["общение с LLM API", "свой stream-парсер"],
		mayNot: ["импорт из connectors/** (провайдер ≠ коннектор)"],
	},
	capability: {
		title: "DI capability (v4 §DI container)",
		home: "features/foundation/capabilities/<name>.ts",
		may: ["регистрация capability в DI container", "инициализация"],
		mayNot: ["доменная логика фичи"],
	},
	service: {
		title: "сервис (v4 §services)",
		home: "features/<name>/services/<name>.ts",
		may: ["бизнес-логика", "IO", "интеграции"],
		mayNot: ["MST-модель (должна быть в store.ts)"],
	},
	"feature-internal": {
		title: "внутренний файл фичи (v4 §sub-features)",
		home: "features/<name>/<subdir>/<file>.ts",
		may: ["внутренняя логика фичи", "подкаталоги с произвольной структурой"],
		mayNot: ["публичный API фичи (должен быть в index.ts)"],
	},
}

/**
 * Слоты по пути. ПЕРВОЕ совпадение выигрывает — порядок значим.
 * Применяются только внутри featureRoots; вне них слоты не проверяются.
 */
export const SLOTS = [
	{ match: /^connectors\/[^/]+\/backend\//, role: "connector-backend" },
	{ match: /^connectors\/[^/]+\/frontend\//, role: "connector-frontend" },
	{ match: /\/api\/providers\//, role: "model-provider" },
	{ match: /\/webview\/EventBridge\.ts$/, role: "channel" },
	{ match: /IntentConstants\.ts$/, role: "constants" },
	{ match: /\/intents\/bus\.ts$/, role: "intent-bus" },
	{ match: /\/intents\/context\.ts$/, role: "intent-context" },
	{ match: /\/index\.ts$/, role: "barrel" },
	{ match: /\/store\.ts$/, role: "mst-model" },
	{ match: /\/types\.ts$/, role: "types" },
	{ match: /\/constants\.ts$/, role: "constants" },
	{ match: /\/views\//, role: "state-view" },
	{ match: /\/events\/actions\//, role: "event-action" },
	{ match: /\/events\/handlers\//, role: "event-handler" },
	{ match: /\/actions\//, role: "intent-action" },
	{ match: /\/handlers\//, role: "intent-handler" },
	{ match: /\/utils\//, role: "util" },
	{ match: /\/tools\//, role: "tool" },
	{ match: /\/capabilities\//, role: "capability" },
	{ match: /\/services\//, role: "service" },
	// Catch-all: любой .ts в features/, не попавший в слот выше (v4: фичи могут
	// иметь произвольную внутреннюю структуру — sub-features, strategies, sections).
	{ match: /\/features\//, role: "feature-internal" },
]

/** Где действует whitelist слотов (v2 WHITELIST RULE). Вне этих корней слоты не проверяем. */
export const FEATURE_ROOTS = [/\/features\//]

/** Папки, которых нет в whitelist v2 — самодельные слоты. Даём подсказку по переносу. */
export const KNOWN_INVENTED_DIRS = [
	{ match: /-service\.ts$/, hint: "*-service.ts — сервис без роли → features/<name>/services/ (v4 §services)" },
	{ match: /\.manager\.ts$/, hint: "*.manager.ts — класс-менеджер → MST-модель (store.ts)" },
]

/** Доступ к синглтонам вне composition root = нарушение v2 #20. */
export const SINGLETONS = new Set([
	"getStore",
	"getEnv",
	"getParent",
	"getProvider",
	"getConnector",
	"hasConnector",
	"getConnectorBus",
	"getEventBridge",
	"getBackendRootStore",
	"getRootStore",
	"getWebviewState",
	"getWindowManagerState",
	"getMstState",
	"getProviderSettingsManager",
	"getSettingsAccess",
	"getHostEnvironment",
	"getContextWindowMeta",
	"getTelemetryService",
])

/**
 * Action creators ОБЯЗАНЫ знать про intentStore (v2 #5: action creators — единственный мост
 * к IPC; без доступа к стору они не создадут Intent). Поэтому этот доступ — НЕ нарушение.
 *
 * Легитимная инфраструктурная инфраструктура для action creators (НЕ бизнес-зависимости):
 *  - `getStore` / `getMstState` — канонические аксессоры корня стора; через них action creators
 *    достают `intentStore` (`getStore().intentStore.createIntent(...)`) и читают модель
 *    для сборки payload'а Intent. Ровно тот доступ, который предписывает v2 #5.
 *  - `getProvider` — транспорт-таргет (активный webview provider). Event-action creators —
 *    «единственный мост к IPC» (v2 #5), и чтобы отправить событие в webview им нужен provider.
 *    Это часть их роли, а не «бизнес-зависимость».
 *  - `getTelemetryService` — кросс-каutting observability (логирование телеметрии).
 *    Допустимо в action creators как поперечная забота, а не бизнес-логика.
 *  - `getHostEnvironment` — чтение host-state (workspace/global state). Иногда необходимо
 *    для сборки payload'а Intent (например, lockApiConfigAcrossModes).
 */
export const INTENT_ACCESS = new Set([
	"getIntentStore",
	"getStore",
	"getMstState",
	"getProvider",
	"getTelemetryService",
	"getHostEnvironment",
	"createIntent",
	"dispatchIntent",
	"scheduleIntent",
	"intentStore",
])

/**
 * v4: транспорт = коннектор. web — только WS.
 * send  — отправить наружу (EventBridge / connector / legacy webview)
 * publish — IConnectorEventBus (frontend app-level шина)
 */
export const CHANNEL_SEND = new Set([
	"postMessageToWebview",
	"postStateToWebview",
	"postStateToWebviewWithoutMessages",
	"postStateToWebviewWithoutTaskHistory",
	"sendOutbound",
	"sendViaView",
	"postMessage",
	"publish",
])
export const CHANNEL_PUBLISH = new Set(["publish"])

/** Слоты, которым разрешено трогать канал напрямую. */
export const CHANNEL_ALLOWED_ROLES = new Set(["event-action", "channel", "connector-backend", "intent-bus"])

/**
 * Максимальная глубина под-фичи: features/chat/task/messages = 3 сегмента (решение пользователя).
 * Всё, что глубже, — уже не под-фича, а файл/слот внутри неё.
 */
export const MAX_FEATURE_DEPTH = 3

/** Слотам данных нечего делать в транспорте. */
export const CHANNEL_FORBIDDEN_ROLES = new Set([
	"mst-model",
	"types",
	"constants",
	"util",
	"state-view",
	"barrel",
	"intent-context",
])

/** L1: запрещённые импорты (from → forbid). Почему — обязательное поле. */
export const LAYERS = [
	{
		from: /^(?!connectors\/|scripts\/).*(backend|frontend)\/.*\.tsx?$/,
		forbid: [/^vscode$/, /^@vscode\//],
		why: "v4 G6/G7 (purity): ноль vscode вне connectors/<host>/backend",
	},
	{
		from: /\/api\/providers\/.*\.tsx?$/,
		forbid: [/^@?connectors\//, /^@?@jabberwock\/connector-/],
		why: "v4 §1.3(a): model provider ≠ connector — провайдер не знает про хост",
	},
	{
		from: /^connectors\/[^/]+\/backend\//,
		forbid: [/\/frontend\//],
		why: "v4 §3.1: стороны коннектора не импортируют друг друга",
	},
	{
		from: /^connectors\/[^/]+\/frontend\//,
		forbid: [/\/backend\//, /^vscode$/],
		why: "v4 §3.1: frontend-сторона браузеро-безопасна и не знает про backend-сторону",
	},
]

/** Прямой IPC. Разрешён только из event action creator (+ задокументированное исключение). */
export const IPC_CALLS = new Set([
	"postMessageToWebview",
	"postStateToWebview",
	"postStateToWebviewWithoutMessages",
	"postStateToWebviewWithoutTaskHistory",
	"sendOutbound",
	"sendViaView",
	"postMessage",
])

/** State-broadcast: синхронизация webview с состоянием store. Разрешён из handler'а напрямую (завершающая операция после изменения состояния). */
export const IPC_STATE_BROADCAST = new Set([
	"postStateToWebview",
	"postStateToWebviewWithoutMessages",
	"postStateToWebviewWithoutTaskHistory",
])

export const INTENT_CALLS = new Set(["createIntent", "dispatchIntent", "scheduleIntent"])

/**
 * Задокументированные исключения. Всегда path + правило + НЕПУСТАЯ причина.
 * Никаких глобальных выключений правил.
 */
export const EXCEPTIONS = [
	{
		path: /\/api\/events\/actions\/sendStreamChunk\.ts$/,
		rules: ["event-action", "IPC-DIRECT"],
		reason:
			"Streaming EXCEPTION (v2 §Streaming Architecture): чанки по 1-5 байт не создают Intent, чтобы не спамить MST снапшотами. Единственное задокументированное исключение.",
	},
	{
		path: /\/intents\/bus\.ts$/,
		rules: ["intent-bus", "DISGUISED-CLASS", "MODULE-STATE"],
		reason:
			"v2 §Phase 0: IntentBus с fiber-шедулером — намеренно stateful инфраструктура вне MST (очередь приоритетов + микротаск-петля).",
	},
	{
		path: /\/api\/streaming\//,
		rules: ["DISGUISED-CLASS", "MODULE-STATE"],
		reason:
			"v2 #24: StreamingStore — намеренно non-MST reactive store, живёт только во время активного стрима и собирается GC.",
	},
	{
		path: /\/features\/store\.ts$/,
		rules: ["MODULE-STATE"],
		reason:
			"_actionBuffer — ограниченный диагностический ring-buffer (cap 100) для отладки intent-потока; не shadow state, не используется бизнес-логикой.",
	},
	{
		path: /\/i18n\/setup\.ts$/,
		rules: ["MODULE-STATE"],
		reason:
			"translations — i18n-каталог, заполняется один раз при загрузке модуля и читается только; не shadow state.",
	},
]

/** Файлы, которые не проверяем вообще. */
/** Имена функций, которые DUPLICATE-LOGIC не считает дублями (паттерны, не список).
 *  — `*Handler` — реализации интерфейса ApiHandler: параллельная форма обязательна по контракту;
 *  — `send*` в `events/actions/` — канонические event-action creators
 *    (`export const sendX = () => provider.sendX(...)`): их «дубликатность» — это паттерн,
 *    а не скопированная логика. */
export const DUPLICATE_SKIP_NAMES = [
	{ name: /Handler$/ },
	{ name: /^send[A-Z]/, path: /events\/actions\// },
]

export const SKIP = [
	/\/node_modules\//,
	/\/dist\//,
	/\/build\//,
	/\/\.turbo\//,
	/\.d\.ts$/,
	/__mocks__/,
	/\.test\.ts$/,
	/\.spec\.ts$/,
	/\.test\.tsx$/,
	/\.spec\.tsx$/,
]

export default { ROLES, SLOTS, FEATURE_ROOTS, KNOWN_INVENTED_DIRS, SINGLETONS, INTENT_ACCESS, IPC_CALLS, IPC_STATE_BROADCAST, INTENT_CALLS, CHANNEL_SEND, CHANNEL_PUBLISH, CHANNEL_ALLOWED_ROLES, CHANNEL_FORBIDDEN_ROLES, MAX_FEATURE_DEPTH, LAYERS, EXCEPTIONS, SKIP }

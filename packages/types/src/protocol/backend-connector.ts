/**
 * Backend-side connector contract for the v4 connector abstraction (plan §4.2–§4.3).
 *
 * The backend connector is the host adapter that gives the backend a uniform way
 * to talk to any frontend (vscode webview, web client, …). It is DI'd into the
 * backend together with the `BackendCapabilities` capability slots, so the
 * backend code never imports host-specific modules directly.
 *
 * Бэкенд-контракт коннектора для коннектор-абстракции v4 (план §4.2–§4.3).
 * Backend-коннектор — это host-адаптер, дающий бэкенду единый способ общения с
 * любым фронтендом (vscode webview, web-клиент, …). Он внедряется в бэкенд вместе
 * со слотами возможностей `BackendCapabilities`, поэтому бэкенд-код не импортирует
 * host-специфичные модули напрямую.
 */

import type { WebviewMessage } from '../webview/message.ts'

/**
 * Closed union of known connector ids. No string fallback: adding a connector
 * requires an explicit widening of this union (D-5 design decision).
 *
 * Замкнутое объединение известных id коннекторов. Без строкового fallback:
 * добавление нового коннектора требует явного расширения этого объединения
 * (дизайн-решение D-5).
 */
export type ConnectorId = 'vscode' | 'web'

/**
 * Describes who should receive an outbound message.
 * Описывает, кто должен получить исходящее сообщение.
 */
export type ClientTarget =
	| { kind: 'broadcast' }
	| { kind: 'client'; clientId: string }

/**
 * Minimal structural disposable contract shared by connector resources.
 * It is intentionally a plain `{ dispose(): void }` interface so that host
 * resources (vscode disposables, socket handles, timers, …) satisfy it without
 * importing any host types into this package.
 *
 * Минимальный структурный контракт на освобождение ресурсов, общий для
 * компонентов коннектора. Намеренно простой интерфейс `{ dispose(): void }`,
 * чтобы host-ресурсы (vscode disposables, socket-хэндлы, таймеры, …)
 * удовлетворяли ему без импорта host-типов в этот пакет.
 */
export interface DisposableLike {
	dispose(): void
}

/**
 * Capability slot: a key/value in-memory store with optional prefix-key listing.
 * Слот возможностей: key/value in-memory хранилище с опциональным перечислением
 * ключей по префиксу.
 */
export interface IHashmapMemory {
	get<T>(key: string): Promise<T | undefined>
	set(key: string, value: unknown): Promise<void>
	delete(key: string): Promise<void>
	keys(prefix?: string): Promise<string[]>
}

/**
 * Capability slot: a FIFO queue of inbound connector items.
 * Слот возможностей: FIFO-очередь входящих элементов коннектора.
 */
export interface IMessageQueue {
	push(item: InboundItem): void
	drain(): AsyncIterable<InboundItem>
}

/**
 * Capability slot: a pub/sub topic bus.
 * Слот возможностей: pub/sub шина по темам.
 */
export interface IPubSub {
	publish(topic: string, payload: unknown): void
	subscribe(topic: string, handler: (payload: unknown) => void): DisposableLike
}

/**
 * Capability slot: a factory for file-system watchers.
 * Слот возможностей: фабрика наблюдателей за файловой системой.
 */
export interface IFileWatcherFactory {
	watch(patterns: string[], opts?: { cwd?: string }): Promise<IFileWatcher>
}

/**
 * Companion minimal file-system watcher. Deliberately free of vscode types —
 * the factory is expected to adapt host watch APIs into these plain callbacks.
 *
 * Сопутствующий минимальный наблюдатель за файловой системой. Намеренно без
 * vscode-типов — фабрика должна адаптировать host watch API в эти простые
 * колбэки.
 */
export interface IFileWatcher {
	onCreate?(handler: (path: string) => void): DisposableLike
	onChange?(handler: (path: string) => void): DisposableLike
	onDelete?(handler: (path: string) => void): DisposableLike
	close(): void
	dispose(): void
}

/**
 * Capability slot: a minimal secret store.
 * Слот возможностей: минимальное хранилище секретов.
 */
export interface ISecretStore {
	get(key: string): Promise<string | undefined>
	store(key: string, value: string): Promise<void>
	delete(key: string): Promise<boolean>
}

/**
 * Host-provided context describing the runtime environment of the connector.
 * Only host-agnostic values live here; anything vscode-specific must be adapted
 * by the connector into these plain fields.
 *
 * Host-контекст, описывающий окружение выполнения коннектора. Здесь живут только
 * host-агностичные значения; всё vscode-специфичное должно адаптироваться
 * коннектором в эти простые поля.
 */
export interface IHostContext {
	readonly storageDir: string
	readonly workspaceRoot: string
	disposables?: DisposableLike[]
	secrets?: ISecretStore
	hostCommands?: {
		reloadWindow?(): void
		openExternal?(url: string): void
	}
	env?: Record<string, string | undefined>
}

/**
 * A single item received from a client, ready to be queued/processed.
 * Один элемент, полученный от клиента, готовый к постановке в очередь/обработке.
 */
export interface InboundItem {
	clientId: string
	body: WebviewMessage
	receivedAt: number
}

/**
 * DI container of host capabilities handed to `IBackendConnector.start()`.
 * The required slots (hashmapMemory, queue, pubsub, hostContext) mirror the vscode
 * audit findings; `fileWatchers`/`logger` are optional extensions.
 *
 * DI-контейнер host-возможностей, передаваемых в `IBackendConnector.start()`.
 * Обязательные слоты (hashmapMemory, queue, pubsub, hostContext) повторяют
 * результаты vscode-аудита; `fileWatchers`/`logger` — опциональные расширения.
 */
export interface BackendCapabilities {
	hashmapMemory: IHashmapMemory
	queue: IMessageQueue
	pubsub: IPubSub
	fileWatchers?: IFileWatcherFactory
	hostContext: IHostContext
	logger?: {
		info(...args: unknown[]): void
		warn(...args: unknown[]): void
	}
}

/**
 * Backend-side connector contract (plan §4.2).
 *
 * `sendOutbound` accepts the plan's `WebviewOutboundMessage | { type: string; [k: string]: unknown }`
 * union. Since the concrete outbound union in the backend ends with the catch-all
 * `{ type: string; [key: string]: unknown }` member, this structurally-identical
 * catch-all is used here so the package stays free of backend imports (the backend
 * depends on `@jabberwock/types`, never the other way round).
 *
 * Бэкенд-контракт коннектора (план §4.2).
 *
 * `sendOutbound` принимает объединение плана `WebviewOutboundMessage | { type: string; [k: string]: unknown }`.
 * Поскольку конкретное исходящее объединение в бэкенде завершается catch-all
 * членом `{ type: string; [key: string]: unknown }`, здесь используется этот
 * структурно идентичный catch-all, чтобы пакет оставался свободным от импортов
 * бэкенда (бэкенд зависит от `@jabberwock/types`, но не наоборот).
 */
export interface IBackendConnector {
	readonly id: ConnectorId

	start(deps: BackendCapabilities, opts?: Record<string, unknown>): Promise<void>
	stop(): Promise<void>

	sendOutbound(
		message: { type: string; [key: string]: unknown },
		target?: ClientTarget
	): void

	onInbound(handler: (clientId: string, body: WebviewMessage) => void): DisposableLike
}

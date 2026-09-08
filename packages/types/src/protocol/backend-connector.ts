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

import type { WebviewMessage } from "../webview/message.ts"
import type { RooTerminal, RooTerminalProvider } from "../execution/terminal.ts"

/**
 * Closed union of known connector ids. No string fallback: adding a connector
 * requires an explicit widening of this union (D-5 design decision).
 *
 * Замкнутое объединение известных id коннекторов. Без строкового fallback:
 * добавление нового коннектора требует явного расширения этого объединения
 * (дизайн-решение D-5).
 */
export type ConnectorId = "vscode" | "web"

/**
 * Describes who should receive an outbound message.
 * Описывает, кто должен получить исходящее сообщение.
 */
export type ClientTarget = { kind: "broadcast" } | { kind: "client"; clientId: string }

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
 * Capability slot: synchronous read / asynchronous write access to host configuration (D4b, plan §3.2 Strategy B).
 *
 * Mirrors the synchronous read surface of `vscode.workspace.getConfiguration(section).get(key, default)`.
 * Extension mode backs it with the host configuration API; server mode backs it with a pure-Node source
 * (JSON file under `--data-dir` + env overrides). The read path is synchronous because consumers
 * (provider constructors, ripgrep option builders) call it from synchronous contexts.
 */
export interface IConfiguration {
	/**
	 * Synchronously read a configuration value from the given section.
	 * Returns `defaultValue` when the key is unset, or `undefined` if no default is given.
	 */
	get<T>(section: string, key: string, defaultValue?: T): T | undefined
	/** Asynchronously write a configuration value. No-op in server mode (no host configuration to persist). */
	update(section: string, key: string, value: unknown): Promise<void>
}

/**
 * Capability slot: a minimal, host-neutral view of a file-system URI.
 *
 * Mirrors the `vscode.Uri` surface that dialog consumers actually use (the `fsPath` accessor).
 * Extension mode backs it with the real `vscode.Uri`; server mode never constructs one (dialogs are
 * unavailable headless, so `showOpenDialog` returns `undefined` before any URI is produced).
 */
export interface IUri {
	/** Absolute file-system path (the `vscode.Uri.fsPath` accessor). */
	fsPath: string
}

/**
 * Capability slot: a host-neutral view of a single language-service diagnostic (D4g-2 batch 3).
 *
 * Mirrors the `vscode.Diagnostic` surface the shared diagnostics formatter reads (severity, range,
 * message, source). Structurally compatible with `vscode.Diagnostic` (a vscode diagnostic is
 * assignable to this), so callers that already hold vscode diagnostics can pass them through
 * unchanged. The host connector maps `vscode.languages.getDiagnostics()` into this shape.
 */
export interface IDiagnostic {
	/** Diagnostic severity (0 = Error, 1 = Warning, 2 = Information, 3 = Hint). */
	severity: number
	/** The diagnostic range (only the start line is read by the formatter). */
	range: { start: { line: number; character: number }; end: { line: number; character: number } }
	/** The human-readable diagnostic message. */
	message: string
	/** The diagnostic source (e.g. the language-service name), if any. */
	source?: string
}

/**
 * Capability slot: host UI dialogs (D4c, plan §3.2 Strategy C).
 *
 * Mirrors the `vscode.window.show*` surface that the shared backend actually calls. Extension mode
 * backs it with the real `vscode.window` dialog APIs; server mode backs it with a pure-Node no-op
 * that logs the call and returns the "user cancelled / no input" equivalent (dialogs are unavailable
 * in headless server mode).
 */
export interface IUiDialogs {
	/**
	 * Open a file-selection dialog. Returns the selected URIs, or `undefined` when the user cancels
	 * (and always `undefined` in server mode, where no dialog can be shown).
	 */
	showOpenDialog(options?: {
		filters?: Record<string, string[]>
		canSelectMany?: boolean
		/** Restrict the picker to files (D4g-2 batch 3). Forwarded to the host; defaults to the host default. */
		canSelectFiles?: boolean
		/** Restrict the picker to folders (D4g-2 batch 3, e.g. the worktree location browse). */
		canSelectFolders?: boolean
		/** Label of the confirm button (D4g-2 batch 3). Cosmetic; forwarded to the host. */
		openLabel?: string
		/** Dialog title (D4g-2 batch 3). Cosmetic; forwarded to the host. */
		title?: string
		defaultUri?: IUri
	}): PromiseLike<IUri[] | undefined>
	/**
	 * Open an input box. Returns the entered value, or `undefined` when the user cancels (and always
	 * `undefined` in server mode).
	 */
	showInputBox(options?: {
		value?: string
		placeHolder?: string
		prompt?: string
		validateInput?: (input: string) => string | null | undefined
	}): PromiseLike<string | undefined>
	/** Show an informational toast. Resolves to the clicked button label, or `undefined` (server mode). */
	showInformationMessage(message: string): PromiseLike<string | undefined>
	/**
	 * Show a warning toast. Resolves to the clicked button label, or `undefined` (server mode).
	 * Optional `buttons` are rendered as clickable actions (extension mode); server mode ignores them.
	 */
	showWarningMessage(message: string, buttons?: readonly string[]): PromiseLike<string | undefined>
	/**
	 * Open a save-file dialog. Returns the chosen URI, or `undefined` when the user cancels (and
	 * always `undefined` in server mode, where no dialog can be shown).
	 */
	showSaveDialog(options?: {
		filters?: Record<string, string[]>
		/** Dialog title (D4g-2 batch 3). Cosmetic; forwarded to the host. */
		title?: string
		defaultUri?: IUri
	}): PromiseLike<IUri | undefined>
	/**
	 * Show a confirmation dialog (optionally modal). Resolves to the clicked button label, or
	 * `undefined` when the user dismisses (and always `undefined` in server mode).
	 */
	showConfirmDialog(options: {
		message: string
		modal?: boolean
		buttons?: string[]
	}): PromiseLike<string | undefined>
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
 * Capability slot: a single open text-document tab (D4e, plan §3.2 Strategy E).
 * Mirrors the `vscode.TabInputText` surface the workspace tracker reads (label, active flag, path).
 */
export interface ITab {
	/** The tab label shown in the host UI. */
	label: string
	/** Whether this tab is the active tab in its group. */
	isActive: boolean
	/** Absolute file-system path of the open text document. */
	path: string
}

/**
 * Capability slot: a minimal, host-neutral view of an open editor tab group (D4e, plan §3.2 Strategy E).
 *
 * Mirrors the `vscode.EditableTabGroup` surface the workspace tracker reads. Extension mode backs it
 * with the real `vscode.window.tabGroups` (filtered to text-document tabs); server mode never provides
 * one (tab groups are a host UI concept), so consumers degrade to an empty list.
 */
export interface ITabGroup {
	/** The open text-document tabs in this group, in host order. */
	tabs: readonly ITab[]
}

/**
 * Capability slot: the host's open editor tab groups (D4e, plan §3.2 Strategy E).
 *
 * Extension mode backs it with `vscode.window.tabGroups`; server mode omits the slot entirely (tab
 * groups are a host UI concept with no headless equivalent), so consumers degrade to an empty list.
 */
export interface ITabGroups {
	/** All open tab groups, in host order. */
	all(): readonly ITabGroup[]
	/** Subscribe to tab-group changes. Returns a disposable that unsubscribes. */
	onDidChange(handler: () => void): DisposableLike
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
 * A single file entry in a checkpoint diff (D4g-2 batch 2). Host-neutral view of the backend
 * `CheckpointDiff` shape; the host adapter (vscode connector) maps it to the `vscode.changes`
 * command URI tuples. The shared backend never constructs host URIs for the diff view.
 */
export interface ICheckpointDiffEntry {
	paths: { relative: string; absolute: string }
	content: { before: string; after: string }
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
/**
 * Minimal structural memento view (key/value state store). Host mementos satisfy it structurally;
 * server mode adapts the hashmap-memory slot into this shape. Kept separate from `IHashmapMemory`
 * because host mementos use synchronous reads + Thenable updates while the memory slot is fully async.
 */
export interface IMementoLike {
	keys(): readonly string[]
	get<T = unknown>(key: string): T | undefined
	update(key: string, value: unknown): PromiseLike<void>
}

/**
 * Host-provided context describing the runtime environment of the connector.
 * Only host-agnostic values live here; anything vscode-specific must be adapted
 * by the connector into these plain fields.
 */
export interface IHostContext {
	readonly storageDir: string
	readonly workspaceRoot: string
	disposables?: DisposableLike[]
	secrets?: ISecretStore
	hostCommands?: {
		reloadWindow?(): void
		openExternal?(url: string): void
		/**
		 * Execute a host command by id (D4g-2 batch 3). Extension mode backs this with
		 * `vscode.commands.executeCommand`; server mode omits it (no host command palette), so
		 * callers degrade to a no-op. Used for host-specific actions (reveal-in-explorer, open
		 * keybindings, markdown preview, terminal focus, ...).
		 */
		executeCommand?(command: string, ...args: unknown[]): void
		/**
		 * Open a file in the host editor (D4g-2 batch 3). Extension mode backs this with
		 * `vscode.workspace.openTextDocument` + `vscode.window.showTextDocument`; server mode omits
		 * it (no host editor), so callers degrade to a no-op.
		 */
		openFileInEditor?(filePath: string, options?: { preview?: boolean; line?: number }): void
		/**
		 * Open a markdown file in the host rendered-preview (D4g-2 batch 3). Extension mode backs this
		 * with `vscode.commands.executeCommand("markdown.showPreview", vscode.Uri.file(filePath))`;
		 * server mode omits it (no host preview), so callers degrade to a no-op.
		 */
		openMarkdownPreview?(filePath: string): void
		/**
		 * Open a folder in the host (D4g-2 batch 3). Extension mode backs this with
		 * `vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(path), options)`;
		 * server mode omits it (no host window), so callers degrade to a no-op.
		 */
		openFolder?(path: string, options?: { forceNewWindow?: boolean }): void
		/**
		 * Open a file with the host's default handler (D4g-2 batch 3). Extension mode backs this with
		 * `vscode.commands.executeCommand("vscode.open", vscode.Uri.file(path))` (e.g. an image
		 * preview); server mode omits it (no host), so callers degrade to a no-op. Distinct from
		 * `openFileInEditor`, which forces a text-document view.
		 */
		openWithDefaultHandler?(path: string): void
		/**
		 * Reveal a path in the host file explorer (D4g-2 batch 3). Extension mode backs this with
		 * `vscode.commands.executeCommand("revealInExplorer", vscode.Uri.file(path))`; server mode
		 * omits it (no host explorer), so callers degrade to a no-op.
		 */
		revealInExplorer?(path: string): void
		/**
		 * Close a duplicate open tab for a path (D4g-2 batch 3). Extension mode backs this with the
		 * host tab-group close logic (only when the tab is in a different column and not dirty);
		 * server mode omits it (no host tabs), so callers degrade to a no-op.
		 */
		closeDuplicateTab?(path: string): void
		/**
		 * Capture the latest terminal output (D4g-2 batch 3). Extension mode backs this with the
		 * host clipboard-based terminal capture (select-all, copy, clear, read, restore) performed
		 * atomically with proper ordering; server mode omits it (no host terminal), so callers
		 * degrade to empty output.
		 */
		getTerminalOutput?: () => PromiseLike<string>
		/**
		 * Open a checkpoint diff in the host diff view (D4g-2 batch 2). Extension mode backs this with
		 * the `vscode.changes` command (multi-file diff view); server mode omits it (no host diff view),
		 * so callers degrade to a no-op.
		 */
		showCheckpointDiff?(title: string, entries: readonly ICheckpointDiffEntry[]): void
	}
	env?: Record<string, string | undefined>
	/** Host extension version (`context.extension.packageJSON.version` in vscode mode); absent in server mode. */
	extensionVersion?: string
	/**
	 * Optional host event: the workspace folder set changed. Extension mode adapts this from the
	 * host's onDidChangeWorkspaceFolders; absent in server mode — consumers skip dependent behavior.
	 * Audit-driven slot extension (plan §2.3 L6 / C-5 zero-host-API invariant, Phase B2).
	 */
	onWorkspaceFoldersChanged?: (handler: () => void) => DisposableLike
	/** Key/value state store (host memento in extension mode; hashmap-memory adapter in server mode). */
	memento?: IMementoLike
	/** Workspace folder roots as plain paths. Extension mode = workspace folders of the host window. */
	workspaceFolders?: readonly string[]
	/**
	 * Application root path (D4e, plan §3.2 Strategy E). Extension mode = `vscode.env.appRoot` (the host
	 * installation directory, used to locate the bundled ripgrep binary); server mode = the server's own
	 * install directory (the ripgrep lookup falls back to the system `rg` when the bundled binary is absent).
	 */
	appRoot?: string
	/**
	 * Host language (D4g, plan §3.2 Strategy G). Extension mode = `vscode.env.language`; server mode =
	 * a configured/derived language or "en". Replaces the `vscode.env.language` read in telemetry.
	 */
	language?: string
	/** Stable host machine identifier (vscode mode = `vscode.env.machineId`); absent in server mode. */
	machineId?: string
	/** The host's global telemetry level (vscode mode = `telemetry.telemetryLevel`); absent in server mode. */
	getTelemetryLevel?: () => string
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
/**
 * Capability slot: a single host-provided model (D4g-2 batch 3, locked orchestrator decision Q1 option a).
 *
 * Host-neutral view of a model exposed by the host's language-model API (vscode mode =
 * `vscode.LanguageModelChat`). The shared backend never imports host model types; the host adapter
 * maps its native model objects into this plain shape. Server mode has no host models, so the
 * `getModels` slot returns an empty list.
 */
export interface IHostModel {
	/** Model identifier (e.g. "claude-3.5-sonnet"). */
	id?: string
	/** Model vendor (e.g. "anthropic"). */
	vendor?: string
	/** Model family (e.g. "claude"). */
	family?: string
	/** Model version (e.g. "3.5"). */
	version?: string
}

/**
 * Capability slot: a host-neutral provider handle for a newly opened webview tab (D4g-2 batch 4).
 *
 * Mirrors the `ProviderHandle` surface the shared task-start action uses after opening a new tab
 * (post messages to the webview + read the global storage path). The vscode connector backs the
 * `openInNewTab` slot with the real `openClineInNewTab` (which returns a
 * `VscodeWebviewBackendConnector` that satisfies this structurally); server mode omits the slot
 * (no host webview), so callers degrade to an error / no-op.
 */
export interface INewTabProvider {
	postMessageToWebview(message: Record<string, unknown>, target?: ClientTarget): Promise<boolean>
	context: { globalStorageUri: { fsPath: string } }
}

/**
 * Host theme service (D4g-2 batch 4). Extension mode backs this with the vscode connector's
 * `getTheme` (which reads `vscode.extensions.all` and `vscode.extensions.getExtension`); server
 * mode omits it (no host themes), so the shared webview-launched handler degrades to no theme.
 */
export interface IHostThemeService {
	getTheme(): Promise<Record<string, unknown> | undefined>
}

/**
 * Host-neutral diff-view-provider surface (D4g-2 batch 4). The vscode connector's `DiffViewProvider`
 * satisfies this structurally. The shared task graph accesses the diff view through this interface
 * instead of importing the vscode connector's concrete class (C-2 purity).
 *
 * The `pushToolWriteResult` method takes `taskId: string` (not the backend `ITaskModel`) so this
 * interface stays in `packages/types` (the lowest layer, no backend imports).
 */
export interface IDiffViewProvider {
	newProblemsMessage?: string
	userEdits?: string
	editType?: "create" | "modify"
	isEditing: boolean
	originalContent: string | undefined
	relPath?: string
	newContent?: string
	cwd: string
	open(relPath: string): Promise<void>
	isFullyInitialized(): boolean
	update(accumulatedContent: string, isFinal: boolean): Promise<void>
	scrollToFirstDiff(): void
	saveChanges(
		diagnosticsEnabled?: boolean,
		writeDelayMs?: number,
	): Promise<{
		newProblemsMessage: string | undefined
		userEdits: string | undefined
		finalContent: string | undefined
	}>
	pushToolWriteResult(task: { taskId: string }, cwd: string, isNewFile: boolean): Promise<string>
	revertChanges(): Promise<void>
	reset(): Promise<void>
	saveDirectly(
		relPath: string,
		newContent: string,
		isNewFile: boolean,
		diagnosticsEnabled?: boolean,
		writeDelayMs?: number,
	): Promise<void>
}

/**
 * Host editor service (D4g-2 batch 4). Extension mode backs this with the vscode connector's
 * `DiffViewProvider` factory; server mode omits it (no host editor), so the shared task-start
 * action degrades to an error when a diff view is requested headless.
 */
export interface IHostEditorService {
	createDiffViewProvider(cwd: string): IDiffViewProvider
}

/**
 * Host terminal service (D4g-2 batch 4). Extension mode backs this with the vscode connector's
 * `TerminalRegistry` (vscode terminals + shell integration); server mode omits it (no host
 * terminals), so the shared execute-command tool degrades to the execa fallback and the
 * condense-context terminal section degrades to empty.
 *
 * The surface is the exact call surface the shared backend task graph uses:
 *   - `getOrCreateTerminal` — the execute-command tool creates/reuses a terminal per task+cwd
 *   - `getTerminals` / `getBackgroundTerminals` / `getUnretrievedOutput` — the condense-context
 *     helper builds the "Actively Running Terminals" section
 *   - `releaseTerminalsForTask` — task cleanup releases task-scoped terminals
 *   - `compressTerminalOutput` — output compression (static on the host `Terminal` class)
 */
export interface IHostTerminalService {
	getOrCreateTerminal(cwd: string, taskId?: string, provider?: RooTerminalProvider): Promise<RooTerminal>
	getTerminals(busy: boolean, taskId?: string): RooTerminal[]
	getBackgroundTerminals(busy?: boolean): RooTerminal[]
	getUnretrievedOutput(id: number): string
	releaseTerminalsForTask(taskId: string): void
	compressTerminalOutput(input: string): string
	/**
	 * Bring a terminal to the foreground (vscode: `terminal.show(true)`). No-op for non-host
	 * terminals (execa). The caller passes the terminal it obtained from `getOrCreateTerminal`.
	 */
	showTerminal(terminal: RooTerminal): void
}

export interface BackendCapabilities {
	hashmapMemory: IHashmapMemory
	queue: IMessageQueue
	pubsub: IPubSub
	fileWatchers?: IFileWatcherFactory
	/**
	 * Open editor tab groups (D4e, plan §3.2 Strategy E). Extension mode = `vscode.window.tabGroups`;
	 * absent in server mode (tab groups are a host UI concept) — consumers degrade to an empty list.
	 */
	tabGroups?: ITabGroups
	/** Configuration access (D4b, plan §3.2 Strategy B); absent only in pre-D4b test fixtures. */
	config: IConfiguration
	/** UI dialog access (D4c, plan §3.2 Strategy C); absent only in pre-D4c test fixtures. */
	uiDialogs: IUiDialogs
	hostContext: IHostContext
	/**
	 * Logger access (D4f, plan §3.2 Strategy F). Extension mode = `vscode.OutputChannel`-backed
	 * (info/warn/appendLine); server mode = pure-Node console. `appendLine` mirrors the host
	 * `OutputChannel.appendLine` surface the settings/logger modules use.
	 */
	logger: {
		info(...args: unknown[]): void
		warn(...args: unknown[]): void
		appendLine(line: string): void
	}
	/**
	 * Host model listing (D4g-2 batch 3, locked orchestrator decision Q1 option a). Extension mode
	 * backs this with the host language-model API (`vscode.lm.selectChatModels`); server mode returns
	 * an empty list (no host models exist headless). The shared settings handler calls this instead of
	 * importing the vscode connector's `getVsCodeLmModels` directly.
	 */
	getModels?: (provider: string) => PromiseLike<readonly IHostModel[]>
	/**
	 * Host clipboard access (D4g-2 batch 3). Extension mode backs this with `vscode.env.clipboard`;
	 * server mode omits it (no host clipboard), so callers degrade to a no-op.
	 */
	clipboard?: {
		readText(): PromiseLike<string>
		writeText(text: string): PromiseLike<void>
	}
	/**
	 * Host language-service diagnostics (D4g-2 batch 3). Extension mode backs this with
	 * `vscode.languages.getDiagnostics()` (mapped to the host-neutral `IDiagnostic` shape); server
	 * mode omits it (no host language services), so callers degrade to "no problems detected".
	 */
	diagnostics?: {
		getAll(): [IUri, IDiagnostic[]][]
	}
	/**
	 * Open a new webview tab and return its provider handle (D4g-2 batch 4). Extension mode backs
	 * this with the vscode connector's `openClineInNewTab`; server mode omits it (no host webview),
	 * so the shared task-start action degrades to an error when `newTab` is requested headless.
	 */
	openInNewTab?: () => PromiseLike<INewTabProvider>
	/**
	 * Host theme service (D4g-2 batch 4). Extension mode backs this with the vscode connector's
	 * `getTheme`; server mode omits it (no host themes), so the shared webview-launched handler
	 * degrades to no theme.
	 */
	hostThemeService?: IHostThemeService
	/**
	 * Host editor service (D4g-2 batch 4). Extension mode backs this with the vscode connector's
	 * `DiffViewProvider` factory; server mode omits it (no host editor), so the shared task-start
	 * action degrades to an error when a diff view is requested headless.
	 */
	hostEditorService?: IHostEditorService
	/**
	 * Host terminal service (D4g-2 batch 4). Extension mode backs this with the vscode connector's
	 * `TerminalRegistry`; server mode omits it (no host terminals), so the shared execute-command
	 * tool degrades to the execa fallback and the condense-context terminal section degrades to
	 * empty.
	 */
	hostTerminalService?: IHostTerminalService
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

	sendOutbound(message: { type: string; [key: string]: unknown }, target?: ClientTarget): void

	onInbound(handler: (clientId: string, body: WebviewMessage) => void): DisposableLike
}

import type {
	BackendCapabilities,
	DisposableLike,
	IConfiguration,
	IFileWatcherFactory,
	IHostContext,
	IHostEditorService,
	IHostModel,
	IHostTerminalService,
	IHostThemeService,
	INewTabProvider,
	ISecretStore,
	IMementoLike,
	ITabGroups,
	IUiDialogs,
} from "@jabberwock/types"

import { setBackendLogger } from "./backend-logger"
import { EventBusPubSub } from "./pubsub"
import { InMemoryMessageQueue } from "./in-memory-queue"
import { MementoBackedMemory } from "./memory/memento-hashmap-memory"
import { setHostContext } from "@features/foundation/host-context/context"

/** Structural secret-store view (host SecretStorage satisfies it; Thenable returns). */
export interface ISecretStoreLike {
	get(key: string): PromiseLike<string | undefined>
	store(key: string, value: string): PromiseLike<void>
	delete(key: string): PromiseLike<unknown>
}

/** Structural append-only log sink (host OutputChannel satisfies it via `.appendLine`). */
export interface ILogSink {
	appendLine(line: string): void
}

/**
 * Inputs for installing extension-mode capabilities. All values are plain/structural —
 * this module never imports the host; activation code reads them from its own context and passes them in.
 */
export interface ExtensionCapabilityInput {
	/** Host globalState memento (the persistent state backend of extension mode). */
	globalMemento: IMementoLike
	/** Absolute storage directory (`context.globalStorageUri.fsPath`). */
	storageDir: string
	/** Workspace folder roots as plain paths, in host order. Empty when no workspace is open. */
	workspaceRoots?: readonly string[]
	/** Host secret store (optional — absent in some hosts). */
	secrets?: ISecretStoreLike | undefined
	/** Log sink for the module-level backend logger slot (L8); console fallback when omitted. */
	logSink?: ILogSink | undefined
	/** Workspace-folder change event adapter from the host (plan §2.3 L6; C-5 zero-host-API). Absent in server mode. */
	onWorkspaceFoldersChanged?: ((handler: () => void) => DisposableLike) | undefined
	/** Host extension version (`context.extension.packageJSON.version`); absent in server mode. */
	extensionVersion?: string
	/**
	 * Host language (D4g, plan §3.2 Strategy G). The host adapter (vscode connector) backs this with
	 * `vscode.env.language`; the shared bootstrap never imports the host itself. Absent in server mode.
	 */
	language?: string
	/**
	 * Host command adapters (D4g-2 batch 1). The host adapter (vscode connector) backs these with
	 * `vscode.commands.executeCommand` / `vscode.env.openExternal`; the shared bootstrap never
	 * imports the host itself. Absent in server mode.
	 */
	hostCommands?: {
		reloadWindow?: () => void
		openExternal?: (url: string) => void
		/**
		 * Execute a host command by id (D4g-2 batch 3). The host adapter (vscode connector) backs this
		 * with `vscode.commands.executeCommand`; absent in server mode.
		 */
		executeCommand?: (command: string, ...args: unknown[]) => void
		/**
		 * Open a file in the host editor (D4g-2 batch 3). The host adapter (vscode connector) backs this
		 * with `vscode.workspace.openTextDocument` + `vscode.window.showTextDocument`; absent in server mode.
		 */
		openFileInEditor?: (filePath: string, options?: { preview?: boolean; line?: number }) => void
	}
	/**
	 * Application root path (D4e, plan §3.2 Strategy E). The host adapter (vscode connector) backs this
	 * with `vscode.env.appRoot`; the shared bootstrap never imports the host itself.
	 */
	appRoot?: string
	/**
	 * Configuration access (D4b, plan §3.2 Strategy B). The host adapter (vscode connector) backs this
	 * with `vscode.workspace.getConfiguration`; the shared bootstrap never imports the host itself.
	 */
	config: IConfiguration
	/**
	 * UI dialog access (D4c, plan §3.2 Strategy C). The host adapter (vscode connector) backs this
	 * with `vscode.window.show*`; the shared bootstrap never imports the host itself.
	 */
	uiDialogs: IUiDialogs
	/**
	 * Open editor tab groups (D4e, plan §3.2 Strategy E). The host adapter (vscode connector) backs this
	 * with `vscode.window.tabGroups`; absent in server mode (tab groups are a host UI concept).
	 */
	tabGroups?: ITabGroups
	/**
	 * File-system watcher factory (D4e, plan §3.2 Strategy E). The host adapter (vscode connector) backs
	 * this with `vscode.workspace.createFileSystemWatcher`; server mode backs it with chokidar.
	 */
	fileWatchers?: IFileWatcherFactory
	/**
	 * Host model listing (D4g-2 batch 3, locked orchestrator decision Q1 option a). The host adapter
	 * (vscode connector) backs this with the host language-model API; absent in server mode, where the
	 * settings models handler degrades to an empty model list.
	 */
	getModels?: (provider: string) => PromiseLike<readonly IHostModel[]>
	/**
	 * Host clipboard access (D4g-2 batch 3). The host adapter (vscode connector) backs this with
	 * `vscode.env.clipboard`; absent in server mode, so callers degrade to a no-op.
	 */
	clipboard?: NonNullable<BackendCapabilities["clipboard"]>
	/**
	 * Host language-service diagnostics (D4g-2 batch 3). The host adapter (vscode connector) backs
	 * this with `vscode.languages.getDiagnostics()`; absent in server mode, so callers degrade to
	 * "no problems detected".
	 */
	diagnostics?: NonNullable<BackendCapabilities["diagnostics"]>
	/**
	 * Open a new webview tab and return its provider handle (D4g-2 batch 4). The host adapter
	 * (vscode connector) backs this with the real `openClineInNewTab`; absent in server mode, so the
	 * shared task-start action degrades to an error when `newTab` is requested headless.
	 */
	openInNewTab?: () => PromiseLike<INewTabProvider>
	/**
	 * Host theme service (D4g-2 batch 4). The host adapter (vscode connector) backs this with the
	 * real `getTheme`; absent in server mode, so the shared webview-launched handler degrades to
	 * no theme.
	 */
	hostThemeService?: IHostThemeService
	/**
	 * Host editor service (D4g-2 batch 4). The host adapter (vscode connector) backs this with the
	 * real `DiffViewProvider` factory; absent in server mode, so the shared task-start action
	 * degrades to an error when a diff view is requested headless.
	 */
	hostEditorService?: IHostEditorService
	/**
	 * Host terminal service (D4g-2 batch 4). The host adapter (vscode connector) backs this with
	 * the real `TerminalRegistry`; absent in server mode, so the shared execute-command tool
	 * degrades to the execa fallback and the condense-context terminal section degrades to empty.
	 */
	hostTerminalService?: IHostTerminalService
}

function formatArgs(args: unknown[]): string {
	return args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")
}

/** Wrap the host secret store into protocol `ISecretStore` shape (Promise-based). */
function toProtocolSecrets(store: ISecretStoreLike): ISecretStore {
	return {
		get(key) {
			return Promise.resolve(store.get(key)) as Promise<string | undefined>
		},
		store(key, value) {
			return Promise.resolve(store.store(key, value)) as Promise<void>
		},
		delete(key) {
			return Promise.resolve(store.delete(key)) as Promise<boolean>
		},
	}
}

/**
 * Install the process-wide backend capabilities for extension mode (plan §7.1 bootstrap sketch — B2 slice).
 *
 * - `hashmapMemory` routes through the host globalState memento so legacy facade reads and capability
 *   consumers see ONE store (no split-brain); server mode swaps in FileHashmapMemory instead (§4.3).
 * - `queue`/`pubsub` are the v1 in-memory implementations; transports consume them from B3 onward.
 * - `config` is the D4b configuration slot (plan §3.2 Strategy B), backed by the host configuration API.
 * - `hostContext` carries storageDir/workspaceRoot/memento/secrets for L3–L7 DI slots.
 * - The module-level logger slot (L8) is installed here so all backend logging flows through one sink.
 */
export function installExtensionCapabilities(input: ExtensionCapabilityInput): BackendCapabilities {
	const hashmapMemory = new MementoBackedMemory(input.globalMemento)
	const queue = new InMemoryMessageQueue()
	const pubsub = new EventBusPubSub()

	const hostContext: IHostContext = {
		storageDir: input.storageDir,
		workspaceRoot: (input.workspaceRoots && input.workspaceRoots[0]) || "",
		memento: input.globalMemento,
		workspaceFolders: [...(input.workspaceRoots ?? [])],
		secrets: input.secrets ? toProtocolSecrets(input.secrets) : undefined,
		// v4 B2 (L11): shared disposables sink — host resources registered here are disposed with the extension.
		disposables: [],
		onWorkspaceFoldersChanged: input.onWorkspaceFoldersChanged,
		extensionVersion: input.extensionVersion,
		appRoot: input.appRoot,
		// D4g (plan §3.2 Strategy G): host language — the host editor language the telemetry service
		// reports (replaces the `vscode.env.language` read in the shared backend).
		language: input.language,
		// D4g-2 (batch 1): host command adapters — the cloud OAuth flow opens external URLs through
		// this slot instead of importing "vscode" (plan §3.2 Strategy G).
		hostCommands: input.hostCommands,
	}

	// D4f (plan §3.2 Strategy F): the logger capability slot — backed by the host log sink
	// (vscode OutputChannel) when provided, console otherwise. The same object also backs the
	// module-level L8 logger so all backend logging flows through one sink.
	const sink = input.logSink
	const logger: NonNullable<BackendCapabilities["logger"]> = sink
		? {
				info(...args) {
					sink.appendLine(`[jabberwock] ${formatArgs(args)}`)
				},
				warn(...args) {
					sink.appendLine(`[jabberwock][warn] ${formatArgs(args)}`)
				},
				appendLine(line) {
					sink.appendLine(line)
				},
			}
		: {
				info: (...args) => console.log("[jabberwock]", ...args),
				warn: (...args) => console.warn("[jabberwock]", ...args),
				appendLine: (line) => console.log(line),
			}

	const capabilities: BackendCapabilities = {
		hashmapMemory,
		queue,
		pubsub,
		fileWatchers: input.fileWatchers,
		config: input.config,
		uiDialogs: input.uiDialogs,
		tabGroups: input.tabGroups,
		hostContext,
		logger,
		// D4g-2 (batch 3): host model listing — the settings models handler reads host language-model
		// models through this slot instead of importing the vscode connector (locked decision Q1 option a).
		getModels: input.getModels,
		// D4g-2 (batch 3): host clipboard — the shared settings handlers copy text (system prompt,
		// image paths) through this slot instead of importing "vscode" (plan §3.2 Strategy G).
		clipboard: input.clipboard,
		// D4g-2 (batch 3): host language-service diagnostics — the shared diagnostics formatter and
		// the "problems" mention read the host diagnostics through this slot (plan §3.2 Strategy G).
		diagnostics: input.diagnostics,
		// D4g-2 (batch 4): open a new webview tab — the shared task-start action opens a new tab
		// through this slot instead of importing the vscode connector's openClineInNewTab.
		openInNewTab: input.openInNewTab,
		// D4g-2 (batch 4): host theme service — the shared webview-launched handler reads the host
		// theme through this slot instead of importing the vscode connector's getTheme.
		hostThemeService: input.hostThemeService,
		// D4g-2 (batch 4): host editor service — the shared task-start action creates the diff view
		// through this slot instead of importing the vscode connector's DiffViewProvider.
		hostEditorService: input.hostEditorService,
		// D4g-2 (batch 4): host terminal service — the shared execute-command tool and the
		// condense-context terminal section use the host terminals through this slot instead of
		// importing the vscode connector's TerminalRegistry.
		hostTerminalService: input.hostTerminalService,
	}

	setHostContext(hostContext)

	setBackendLogger(logger)

	return capabilities
}

import * as fs from "node:fs"
import * as path from "node:path"
import type {
	BackendCapabilities,
	IDiffViewProvider,
	IHostContext,
	IMessageQueue,
	IPubSub,
	ISecretStore,
} from "../../../packages/types/src/protocol/backend-connector.ts"
import { FileBackedHashmapMemory } from "./memory/hashmap-memory.ts"
import { MementoAdapter } from "./memory/memento.ts"
import { InMemoryMessageQueue } from "./queue/message-queue.ts"
import { TopicPubSub } from "./pubsub/topic-pubsub.ts"
import { ChokidarFileWatcherFactory } from "./watchers/chokidar-file-watcher.ts"
import { FileSecretStore } from "./security/file-secret-store.ts"
import { ServerConfiguration } from "./configuration/server-configuration.ts"

export interface ServerCapabilitiesOptions {
	/** Directory for persistent state (`--data-dir`); created if missing. */
	dataDir: string
	/** Workspace root the server operates on (`--workspace`). */
	workspaceRoot: string
	/** Machine-level env overrides (proxy URL, secrets); server mode = `process.env`. */
	env?: Record<string, string | undefined>
	logger?: BackendCapabilities["logger"]
	queue?: IMessageQueue
	pubsub?: IPubSub
	secrets?: ISecretStore
}

/**
 * v4 Phase C1 (§4.3): builds the default `BackendCapabilities` for standalone server mode.
 *
 * Fills every capability slot with a Node-based implementation:
 *   - hashmapMemory: file-backed JSON under `--data-dir` (vscode mode: globalState)
 *   - queue: bounded in-memory queue (vscode mode: same, fed by webview.onDidReceiveMessage)
 *   - pubsub: in-process topic pub/sub (vscode mode: EventBridge)
 *   - fileWatchers: chokidar factory (vscode mode: createFileSystemWatcher)
 *   - config: JSON file under `--data-dir` (vscode mode: `workspace.getConfiguration`)
 *   - hostContext: storageDir/workspaceRoot from CLI args, no-op host commands
 */
export async function createServerCapabilities(options: ServerCapabilitiesOptions): Promise<BackendCapabilities> {
	const dataDir = path.resolve(options.dataDir)
	const workspaceRoot = path.resolve(options.workspaceRoot)
	fs.mkdirSync(dataDir, { recursive: true })

	const hashmapMemory = new FileBackedHashmapMemory(dataDir)
	const memento = new MementoAdapter(hashmapMemory)
	await memento.hydrate()

	const secrets = options.secrets ?? new FileSecretStore(dataDir, options.env)
	const hostContext: IHostContext = {
		storageDir: dataDir,
		workspaceRoot,
		env: options.env,
		secrets,
		memento,
		workspaceFolders: [workspaceRoot],
		// D4e (plan §3.2 Strategy E): application root path — the server's own install directory (the
		// directory of the running bundle). The ripgrep lookup checks bundled paths under this root and
		// falls back to the system `rg` when none exist (the standalone server ships no bundled ripgrep).
		appRoot: __dirname,
		// D4g (plan §3.2 Strategy G): host language — server mode has no host editor language, so it
		// reports the default "en" (the telemetry service reads this instead of `vscode.env.language`).
		language: "en",
		hostCommands: {
			reloadWindow: () => {
				// no-op: there is no host window to reload in server mode
			},
			openExternal: () => {
				// no-op: browsers already handle their own external navigation
			},
		},
	}

	return {
		hashmapMemory,
		queue: options.queue ?? new InMemoryMessageQueue(),
		pubsub: options.pubsub ?? new TopicPubSub(),
		fileWatchers: new ChokidarFileWatcherFactory(),
		// D4b (plan §3.2 Strategy B): pure-Node config source — JSON file under `--data-dir`.
		config: new ServerConfiguration(dataDir),
		// D4c (plan §3.2 Strategy C): UI dialogs are unavailable in headless server mode — log the
		// call and return the "user cancelled / no input" equivalent (undefined) for every dialog.
		uiDialogs: {
			showOpenDialog: () => {
				console.warn("[jabberwock][server] showOpenDialog unavailable in server mode — returning undefined")
				return Promise.resolve(undefined)
			},
			showInputBox: () => {
				console.warn("[jabberwock][server] showInputBox unavailable in server mode — returning undefined")
				return Promise.resolve(undefined)
			},
			showInformationMessage: (message: string) => {
				console.warn(`[jabberwock][server] showInformationMessage unavailable in server mode: ${message}`)
				return Promise.resolve(undefined)
			},
			// D4g-2 (batch 2): optional buttons are ignored headless (no clickable actions in server mode).
			showWarningMessage: (message: string, _buttons?: readonly string[]) => {
				console.warn(`[jabberwock][server] showWarningMessage unavailable in server mode: ${message}`)
				return Promise.resolve(undefined)
			},
			// D4g-2 (batch 1): save-file dialog is unavailable headless — return the "user cancelled"
			// equivalent (undefined) so callers degrade to their no-selection path.
			showSaveDialog: () => {
				console.warn("[jabberwock][server] showSaveDialog unavailable in server mode — returning undefined")
				return Promise.resolve(undefined)
			},
			// D4g-2 (batch 1): confirmation dialog is unavailable headless — return the "user
			// dismissed" equivalent (undefined) so callers degrade to their cancel path.
			showConfirmDialog: (options: { message: string }) => {
				console.warn(`[jabberwock][server] showConfirmDialog unavailable in server mode: ${options.message}`)
				return Promise.resolve(undefined)
			},
		},
		hostContext,
		// D4f (plan §3.2 Strategy F): pure-Node logger — console-backed by default (overridable via
		// `options.logger`). `appendLine` mirrors the host OutputChannel surface the settings/logger
		// modules use, so the shared backend logs identically in server mode.
		logger: options.logger ?? {
			info: (...args: unknown[]) => console.log("[jabberwock-server]", ...args),
			warn: (...args: unknown[]) => console.warn("[jabberwock-server]", ...args),
			appendLine: (line: string) => console.log(line),
		},
		// D4g-2 (batch 3): host model listing — server mode has no host language-model API, so the
		// settings models handler degrades to an empty model list (locked orchestrator decision Q1
		// option a: the web backing returns an empty list / no-op).
		getModels: async () => [],
		// D4g-2 (batch 3): host clipboard — server mode has no host clipboard; the read returns an
		// empty string and the write is a no-op so callers degrade gracefully.
		clipboard: {
			readText: () => Promise.resolve(""),
			writeText: () => Promise.resolve(),
		},
		// D4g-2 (batch 4): host editor service — server mode has no host editor, so the diff view
		// is a no-op. The shared task graph calls getDiffViewProvider().reset() during streaming
		// (streamExecutor) and getDiffViewProvider().open/update/saveChanges when a tool edits a
		// file; all degrade to no-ops in server mode.
		hostEditorService: {
			createDiffViewProvider: (_cwd: string): IDiffViewProvider => ({
				isEditing: false,
				originalContent: undefined,
				cwd: "",
				open: async () => {},
				isFullyInitialized: () => false,
				update: async () => {},
				scrollToFirstDiff: () => {},
				saveChanges: async () => ({
					newProblemsMessage: undefined,
					userEdits: undefined,
					finalContent: undefined,
				}),
				pushToolWriteResult: async () => "",
				revertChanges: async () => {},
				reset: async () => {},
				saveDirectly: async () => {},
			}),
		},
	}
}

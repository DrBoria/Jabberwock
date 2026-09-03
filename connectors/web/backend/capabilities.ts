import * as fs from "node:fs"
import * as path from "node:path"
import type {
	BackendCapabilities,
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
		hostContext,
		logger: options.logger,
	}
}

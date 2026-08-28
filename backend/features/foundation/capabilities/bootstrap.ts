import type { BackendCapabilities, DisposableLike, IHostContext, ISecretStore, IMementoLike } from "@jabberwock/types"

import { setBackendLogger } from "./backend-logger"
import { EventBusPubSub } from "./pubsub"
import { InMemoryMessageQueue } from "./in-memory-queue"
import { MementoBackedMemory } from "./memory/memento-hashmap-memory"
import { setHostContext } from "@features/foundation/vscode/context"

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
	}

	const capabilities: BackendCapabilities = { hashmapMemory, queue, pubsub, hostContext }

	setHostContext(hostContext)

	if (input.logSink) {
		const sink = input.logSink
		setBackendLogger({
			info(...args) {
				sink.appendLine(`[jabberwock] ${formatArgs(args)}`)
			},
			warn(...args) {
				sink.appendLine(`[jabberwock][warn] ${formatArgs(args)}`)
			},
		})
	}

	return capabilities
}

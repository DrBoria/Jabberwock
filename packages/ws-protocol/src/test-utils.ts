import type {
	BackendCapabilities,
	IConfiguration,
	IHashmapMemory,
	IMessageQueue,
	IPubSub,
	IUiDialogs,
	DisposableLike,
} from "@jabberwock/types"

/**
 * Minimal `BackendCapabilities` stub for unit tests. Only `pubsub` is exercised by
 * `WsServerCore`; the other slots are present to satisfy the interface.
 */
export function createTestCapabilities(): BackendCapabilities {
	const store = new Map<string, unknown>()

	const hashmapMemory: IHashmapMemory = {
		async get<T>(key: string): Promise<T | undefined> {
			return store.get(key) as T | undefined
		},
		async set(key: string, value: unknown): Promise<void> {
			store.set(key, value)
		},
		async delete(key: string): Promise<void> {
			store.delete(key)
		},
		async keys(prefix?: string): Promise<string[]> {
			return [...store.keys()].filter((key) => (prefix === undefined ? true : key.startsWith(prefix)))
		},
	}

	const queue: IMessageQueue = {
		push(): void {},
		drain(): AsyncIterable<never> {
			return (async function* () {})()
		},
	}

	const pubsub: IPubSub = {
		publish(): void {},
		subscribe(): DisposableLike {
			return { dispose(): void {} }
		},
	}

	const config: IConfiguration = {
		get<T>(_section: string, _key: string, defaultValue?: T): T | undefined {
			return defaultValue
		},
		async update(): Promise<void> {},
	}

	const uiDialogs: IUiDialogs = {
		async showOpenDialog() {
			return undefined
		},
		async showInputBox() {
			return undefined
		},
		async showInformationMessage() {
			return undefined
		},
		async showWarningMessage() {
			return undefined
		},
		async showSaveDialog() {
			return undefined
		},
		async showConfirmDialog() {
			return undefined
		},
	}

	return {
		hashmapMemory,
		queue,
		pubsub,
		config,
		uiDialogs,
		hostContext: { storageDir: "", workspaceRoot: "" },
		logger: {
			info(): void {},
			warn(): void {},
			appendLine(): void {},
		},
	}
}

import { SECRET_STATE_KEYS, GLOBAL_SECRET_KEYS } from "@jabberwock/types"
import type { DisposableLike, IHostContext, IHashmapMemory, IMementoLike, ISecretStore } from "@jabberwock/types"

export const PASS_THROUGH_STATE_KEYS = ["taskHistory"]

/**
 * IDE-agnostic host environment facade over DI slots (v4 plan §2.3 L3). No host module is imported here — every
 * structural type below is declared locally, so the same contract serves any connector adapter: VS Code today,
 * WebStorm / Visual Studio later; each installs its own slot implementations at bootstrap and consumers read
 * through `getHostEnvironment()` unchanged (`env.globalStorageUri.fsPath`, `ctx.extensionContext.globalState.update(...)`, etc.).
 */

// ─── Structural host views (no host import) ──────────────────────────────

/** Minimal structural URI — only the members backend code actually reads. Host URIs satisfy it structurally. */
export interface IHostUri {
	readonly fsPath: string
}

/** Key/value state store view (host memento in extension mode; file-backed memory slot in server mode). */
export interface IMementoView {
	keys(): readonly string[]
	get<T = unknown>(key: string): T | undefined
	update(key: string, value: unknown): Thenable<void>
}

/** Secret storage view. PromiseLike returns so both host secret stores (Thenable) and native-Promise slots satisfy it. */
export interface ISecretsView {
	get(key: string): PromiseLike<string | undefined>
	store(key: string, value: string): PromiseLike<void>
	delete(key: string): PromiseLike<unknown>
}

/** Structural extension-context surface used by the facade and its consumers. Host contexts satisfy it structurally. */
export interface IExtensionContextView {
	readonly globalState: IMementoView
	readonly workspaceState: IMementoView
	/** Structural host URI view; consumers read `.fsPath`. Always provided — real host contexts carry a full `Uri`, the facade synthesizes one from slots. */
	readonly globalStorageUri: IHostUri
	/** Optional workspace-scoped storage location (host context's `storageUri`); absent in server mode and for synthesized views. Consumers must degrade to `globalStorageUri`. */
	readonly storageUri?: IHostUri | undefined
	readonly secrets?: ISecretsView | undefined
	subscriptions?: Array<{ dispose(): void }>
}

/** Legacy host-context view still accepted by installBackendState for existing activation call sites; real host contexts satisfy it structurally. */
export interface LegacyHostContextView extends IExtensionContextView {
	readonly extensionUri: IHostUri
	readonly globalStorageUri: IHostUri
	/** Numeric host extension mode; compare against the host enum values at call sites. */
	readonly extensionMode: number
}

// ─── IHostEnvironment — IDE-agnostic access surface returned by getHostEnvironment() ─────────

export interface IHostEnvironment {
	extensionContext: IExtensionContextView
	extensionUri: IHostUri
	globalStorageUri: IHostUri
	/** Numeric host extension mode; compare against the host enum values at call sites. */
	readonly extensionMode: number
	getGlobalState<T = unknown>(key: string): T | undefined
	updateGlobalState(key: string, value: unknown): Thenable<void>
	getSecret(key: string): string | undefined
	storeSecret(key: string, value: string | undefined): Promise<void>
	refreshSecrets(): Promise<void>
}

// ─── Module State (DI slots — installed once during activation) ──────────

export interface BackendStateSlots {
	global?: IMementoView
	workspace?: IMementoView
	secrets?: ISecretStore
	hashmapMemory?: IHashmapMemory
	legacySecrets?: ISecretsView | undefined
	extensionRootPath: string
	globalStoragePath: string
	isDevelopmentMode: boolean
}

let _slots: BackendStateSlots | undefined
/** v4 B2 (L3/L4): host context slot installed from `BackendCapabilities.hostContext` at bootstrap. */
let _hostContext: IHostContext | undefined
/** Sync-read cache for the async hashmap-memory slot (server mode). Extension-mode reads go straight to the memento view. */
const _asyncReadCache = new Map<string, unknown>()
const _secretsCache = new Map<string, string | undefined>()

// ─── Host context accessors (v4 B2 — L3/L4 DI slots) ──────────────────────

/** Install the host-context capability slot. Called once during bootstrap from `BackendCapabilities`. */
export function setHostContext(hostContext: IHostContext): void {
	_hostContext = hostContext
}

/** The installed host context, or undefined before bootstrap (callers must degrade gracefully). */
export function getHostContext(): IHostContext | undefined {
	return _hostContext
}

/** Workspace folder roots as plain paths. Extension mode: from the capability slot; fallback empty list. */
export function getWorkspaceRoots(): string[] {
	const folders = _hostContext?.workspaceFolders ?? []
	if (folders.length > 0) return [...folders]
	// Fallback for early startup before bootstrap installed host context with workspace info.
	return []
}

/** First workspace root or empty string — the canonical "current workspace" path used by L4 consumers. */
export function getWorkspaceRoot(): string {
	const folders = _hostContext?.workspaceFolders ?? []
	if (folders.length > 0) return folders[0]
	return _hostContext?.workspaceRoot ?? ""
}

/** Memento view from the host context slot, or undefined when not installed. */
export function getHostMemento(): IMementoLike | undefined {
	return _hostContext?.memento
}

// ─── Host-context DI accessors (v4 B2 — L6/L7/C-5 zero-host-API) ──────────────

/** Subscribe to workspace-folder changes via the host context slot; no-op when absent. */
export function onWorkspaceFoldersChanged(handler: () => void): DisposableLike {
	return _hostContext?.onWorkspaceFoldersChanged?.(handler) ?? { dispose() {} }
}

const ABSENT = "__absent__" as const
const WORKSPACE_KEY_PREFIX = "workspace:"

// ─── installBackendState — one-time backend state slot installation at activation ─────────────

function isLegacyHostContextView(arg: BackendStateSlots | LegacyHostContextView): arg is LegacyHostContextView {
	return "extensionUri" in arg && !("extensionRootPath" in arg)
}

/**
 * Install backend state slots once during activation. In extension mode the host passes its memento/secret views;
 * in server mode bootstrap passes file-backed implementations of the same structural interfaces. The legacy overload
 * (raw host context) is kept so existing call sites compile unchanged until E+.
 */
export function installBackendState(slotsOrLegacy: BackendStateSlots | LegacyHostContextView): void {
	if (!isLegacyHostContextView(slotsOrLegacy)) {
		_slots = slotsOrLegacy
		return
	}
	const legacy = slotsOrLegacy
	_slots = {
		global: legacy.globalState,
		workspace: legacy.workspaceState,
		secrets: undefined,
		hashmapMemory: undefined,
		legacySecrets: legacy.secrets,
		extensionRootPath: legacy.extensionUri.fsPath,
		globalStoragePath: legacy.globalStorageUri.fsPath,
		isDevelopmentMode: legacy.extensionMode === 1, // host enum value Development = 1
	}
}

// ─── getHostEnvironment ──────────────────────────────────────────────

function requireSlots(): BackendStateSlots {
	if (!_slots) {
		throw new Error("Backend state not initialized. Call installBackendState() first.")
	}
	return _slots
}

/** Sync read: memento view when present (extension mode), otherwise the async-slot cache (server mode). */
function syncRead(view: IMementoView | undefined, key: string): unknown {
	if (view) return view.get(key) ?? ABSENT
	const cached = _asyncReadCache.get(key)
	return cached === undefined ? ABSENT : cached
}

/** Async memento over the hashmap-memory slot; used when no host memento view is installed. */
function asyncMemento(slots: BackendStateSlots, prefix: string): IMementoView {
	const memory = slots.hashmapMemory
	if (!memory) throw new Error("No state backend available — install a memento view or hashmapMemory capability")
	return {
		keys() {
			const cachedKeys = [..._asyncReadCache.keys()]
			if (!prefix) return cachedKeys.filter((k) => !k.startsWith(WORKSPACE_KEY_PREFIX))
			return cachedKeys.filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length))
		},
		get<T>(key: string): T | undefined {
			const value = syncRead(undefined, prefix + key)
			return (value === ABSENT ? undefined : value) as T | undefined
		},
		update(key: string, value: unknown): Thenable<void> {
			const promise = memory.set(prefix + key, value).then(() => {
				if (value === undefined) _asyncReadCache.delete(prefix + key)
				else _asyncReadCache.set(prefix + key, value)
			})
			return Promise.resolve(promise) as Thenable<void>
		},
	}
}

/** Resolve the effective secret view: legacy host store first (extension mode), then the protocol slot. */
function resolveSecrets(slots: BackendStateSlots): ISecretsView | undefined {
	if (slots.legacySecrets) return slots.legacySecrets
	const store = slots.secrets
	if (!store) return undefined
	return {
		get: (k) => Promise.resolve(store.get(k)),
		store: (k, v) => Promise.resolve(store.store(k, v)),
		delete: (k) => Promise.resolve(store.delete(k)),
	}
}

export function getHostEnvironment(): IHostEnvironment {
	const slots = requireSlots()

	// Structural context object: consumers read .globalState/.workspaceState directly (unchanged until E+).
	const extensionContextView: IExtensionContextView = {
		get globalState() {
			return slots.global ?? asyncMemento(slots, "")
		},
		get workspaceState() {
			return slots.workspace ?? asyncMemento(slots, WORKSPACE_KEY_PREFIX)
		},
		get secrets() {
			return resolveSecrets(slots)
		},
		get globalStorageUri(): IHostUri {
			return { fsPath: slots.globalStoragePath }
		},
	}

	const secretsView = () => extensionContextView.secrets

	return {
		get extensionContext() {
			return extensionContextView
		},
		get extensionUri(): IHostUri {
			return { fsPath: slots.extensionRootPath }
		},
		get globalStorageUri(): IHostUri {
			return { fsPath: slots.globalStoragePath }
		},
		get extensionMode() {
			return slots.isDevelopmentMode ? 1 : 3 // host enum values: Development=1, Production=3 (numeric comparison at call sites)
		},

		getGlobalState<T>(key: string): T | undefined {
			const value = syncRead(slots.global, key)
			return (value === ABSENT ? undefined : value) as T | undefined
		},

		updateGlobalState(key: string, value: unknown): Thenable<void> {
			if (slots.global) return slots.global.update(key, value)
			const memory = slots.hashmapMemory
			if (!memory)
				throw new Error("No state backend available — install a memento view or hashmapMemory capability")
			const promise = memory.set(key, value).then(() => {
				if (value === undefined) _asyncReadCache.delete(key)
				else _asyncReadCache.set(key, value)
			})
			return Promise.resolve(promise) as Thenable<void>
		},

		getSecret(key: string): string | undefined {
			return _secretsCache.get(key)
		},

		async storeSecret(key: string, value: string | undefined): Promise<void> {
			_secretsCache.set(key, value ?? undefined)
			const secrets = secretsView()
			if (!secrets) return
			if (value === undefined) await secrets.delete(key)
			else await secrets.store(key, value)
		},

		async refreshSecrets(): Promise<void> {
			const store = resolveSecrets(slots)
			if (!store) return
			await Promise.all(
				[...SECRET_STATE_KEYS, ...GLOBAL_SECRET_KEYS].map(async (key) => {
					const value = await store.get(key)
					_secretsCache.set(key, value ?? undefined)
				}),
			)
		},
	}
}

/**
 * Type declaration for the shared backend foundation feature barrel
 * (`backend/features/foundation/index.ts`).
 *
 * This connector package resolves `@features/foundation` to this declaration so
 * its own `tsc --noEmit` stays isolated from the backend source graph (which is
 * still partially vscode-coupled). The runtime/server bundle resolves the SAME
 * specifier to the real implementation via `backend/tsconfig.json` aliases, so
 * there is exactly one code path at runtime. Keep this declaration in sync with
 * the real `installBackendState` + `getHostEnvironment` the server entrypoint uses.
 */
import type { IHashmapMemory, ISecretStore } from "@jabberwock/types"

/** Structural memento view (file-backed hashmap memory in server mode). */
interface IMementoView {
	keys(): readonly string[]
	get<T = unknown>(key: string): T | undefined
	update(key: string, value: unknown): Thenable<void>
}

/** Structural URI — only the members backend code actually reads. */
interface IHostUri {
	readonly fsPath: string
}

/**
 * Backend state slots installed once at activation. In server mode the file-backed
 * capability is the memento source. Mirrors the real `BackendStateSlots` the
 * server entrypoint fills (hashmapMemory, secrets, paths, dev flag).
 */
interface BackendStateSlots {
	global?: IMementoView
	workspace?: IMementoView
	secrets?: ISecretStore
	hashmapMemory?: IHashmapMemory
	legacySecrets?: unknown
	extensionRootPath: string
	globalStoragePath: string
	isDevelopmentMode: boolean
}

/** Legacy overload (raw host context view) — kept so existing call sites compile. */
interface LegacyHostContextView {
	extensionUri: IHostUri
	globalState?: IMementoView
	workspaceState?: IMementoView
	secrets?: unknown
}

/** Install backend state slots once during activation (throws on double-install). */
export declare function installBackendState(slotsOrLegacy: BackendStateSlots | LegacyHostContextView): void

/**
 * IDE-agnostic host access surface. The server entrypoint reads
 * `extensionContext` to construct the ProviderSettingsManager.
 */
export interface IHostEnvironment {
	extensionContext: {
		readonly globalState: {
			get<T = unknown>(key: string): T | undefined
			update(key: string, value: unknown): Thenable<void>
		}
		readonly secrets?:
			| {
					get(key: string): PromiseLike<string | undefined>
					store(key: string, value: string): PromiseLike<void>
					delete(key: string): PromiseLike<unknown>
			  }
			| undefined
	}
	extensionUri: IHostUri
	globalStorageUri: IHostUri
	readonly extensionMode: number
	getGlobalState<T = unknown>(key: string): T | undefined
	updateGlobalState(key: string, value: unknown): Thenable<void>
	getSecret(key: string): string | undefined
	storeSecret(key: string, value: string | undefined): Promise<void>
	refreshSecrets(): Promise<void>
}

/** Return the installed host-environment access surface. */
export declare function getHostEnvironment(): IHostEnvironment

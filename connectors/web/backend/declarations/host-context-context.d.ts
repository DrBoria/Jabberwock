/**
 * Type declaration for the shared backend host-context slot installer
 * (`backend/features/foundation/host-context/context.ts`).
 *
 * This connector package resolves `@features/foundation/host-context` to this
 * declaration so its own `tsc --noEmit` stays isolated from "the" backend source graph (which
 * is still partially vscode-coupled). The runtime/server bundle resolves the SAME specifier to
 * the real implementation via `backend/tsconfig.json` aliases, so there is exactly one code
 * path at runtime. Keep this declaration in sync with the real `installBackendState` signature.
 */
import type { IHashmapMemory, ISecretStore } from "@jabberwock/types"

/** Structural memento view (host memento in extension mode; file-backed memory slot in server mode). */
export interface IMementoView {
	keys(): readonly string[]
	get<T = unknown>(key: string): T | undefined
	update(key: string, value: unknown): Thenable<void>
}

/** Structural secret-storage view (PromiseLike returns so Thenable host stores satisfy it). */
export interface ISecretsView {
	get(key: string): PromiseLike<string | undefined>
	store(key: string, value: string): PromiseLike<void>
	delete(key: string): PromiseLike<unknown>
}

/** Structural URI — only the members backend code actually reads. */
export interface IHostUri {
	readonly fsPath: string
}

/**
 * Structural extension-context view the facade returns to consumers.
 * Mirrors the real `IExtensionContextView` (`backend/features/foundation/host-context/context.ts`).
 */
export interface IExtensionContextView {
	readonly globalState: IMementoView
	readonly workspaceState: IMementoView
	readonly globalStorageUri: IHostUri
	readonly storageUri?: IHostUri | undefined
	readonly secrets?: ISecretsView | undefined
	subscriptions?: Array<{ dispose(): void }>
}

/** IDE-agnostic host environment facade returned by `getHostEnvironment()`. */
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

/** Structural view of the backend state slots that the standalone server installs at startup. */
export interface BackendStateSlots {
	hashmapMemory?: IHashmapMemory
	/** Secret-storage capability slot (file-backed in server mode); resolved by the facade for getSecret/storeSecret. */
	secrets?: ISecretStore
	extensionRootPath: string
	globalStoragePath: string
	isDevelopmentMode: boolean
}

/**
 * Install backend state slots once during startup. The standalone server passes file-backed
 * slots (hashmapMemory as the memento source, storage dir as both root and global storage).
 */
export declare function installBackendState(slots: BackendStateSlots): void

/**
 * Read the installed host environment facade. Throws before `installBackendState` runs —
 * callers must install slots during bootstrap (the server entrypoint does, before startBackend).
 */
export declare function getHostEnvironment(): IHostEnvironment

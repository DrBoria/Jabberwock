/**
 * Type declaration for the shared backend provider-settings manager
 * (`backend/features/settings/models/provider-settings-manager/ProviderSettingsManager.ts`).
 *
 * This connector package resolves
 * `the feature sub-barrel `@features/settings/models/provider-settings-manager` to this
 * declaration so its own `tsc --noEmit` stays isolated from "the" backend source graph
 * (which is still partially vscode-coupled). The runtime/server bundle resolves the SAME
 * specifier to the real implementation via `backend/tsconfig.json` aliases, so there is
 * exactly one code path at runtime. Keep this declaration in sync with the real
 * `ProviderSettingsManager` constructor + `setProviderSettingsManager` the server entrypoint uses.
 */

/**
 * Host-context view the manager factory accepts (structural mirror of
 * `IExtensionContextView` — globalState + optional secrets views).
 */
export interface IExtensionContextViewDecl {
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

/**
 * Provider API configurations and profiles manager instance (structural — the server
 * entrypoint only constructs it from a host-context view and installs it; it never calls
 * instance methods, so no method surface is declared).
 */
export interface ProviderSettingsManagerInstance {
	readonly [member: string]: unknown
}

/**
 * Factory producing a provider-settings manager closure over the host context.
 * Mirrors the real de-classed factory
 * `export function ProviderSettingsManager(context: IExtensionContextView)`.
 */
export declare function ProviderSettingsManager(context: IExtensionContextViewDecl): ProviderSettingsManagerInstance

/** ProviderSettingsManager instance type (mirrors the real `ReturnType<typeof ProviderSettingsManager>` alias). */
export type ProviderSettingsManager = ProviderSettingsManagerInstance

/** Install the process-wide provider-settings manager singleton (throws on double-install). */
export declare function setProviderSettingsManager(mgr: ProviderSettingsManager): void

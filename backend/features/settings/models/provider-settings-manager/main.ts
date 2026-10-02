// v4 B2 (L14): structural host-context view instead of the vscode type.
import type { IExtensionContextView, ISecretsView } from "@features/foundation"

import { type ProviderSettingsWithId, ProviderSettingsEntry } from "@jabberwock/types"

import { type Mode } from "@shared/modes"

import { type ProviderProfiles, type SyncCloudProfilesResult, type ProviderSettingsDeps } from "./types"
import { initializeCore } from "./operations/initialize"
import { syncCloudProfiles } from "./operations/sync"
import { loadProviderProfiles, storeProviderProfiles, secretsKey } from "./operations/persistence"
import {
	listConfig,
	saveConfig,
	getProfile,
	activateProfile,
	deleteConfig,
	hasConfig,
	setModeConfig,
	getModeConfigId,
} from "./operations/crud"
import { exportProviderProfiles, importProviderProfiles } from "./operations/export-import"

import { modes } from "@shared/modes"

/**
 * ProviderSettingsManager — factory producing a settings-manager closure over
 * the host context. Instance state (default profiles, lock) lives in the
 * closure, not in module scope.
 */
export function ProviderSettingsManager(context: IExtensionContextView) {
	const defaultConfigId = generateId()
	const defaultModeApiConfigs: Record<string, string> = Object.fromEntries(
		modes.map((mode) => [mode.slug, defaultConfigId]),
	)

	const defaultProviderProfiles: ProviderProfiles = {
		currentApiConfigName: "default",
		apiConfigs: { default: { id: defaultConfigId } },
		modeApiConfigs: defaultModeApiConfigs,
		migrations: {
			rateLimitSecondsMigrated: true,
			openAiHeadersMigrated: true,
			consecutiveMistakeLimitMigrated: true,
			todoListEnabledMigrated: true,
			claudeCodeLegacySettingsMigrated: true,
		},
	}

	/**
	 * Secret storage is mandatory for provider profiles (host contexts always provide it;
	 * server mode must install a secrets slot before constructing this manager).
	 */
	function getSecrets(): ISecretsView {
		const secrets = context.secrets
		if (!secrets) throw new Error("ProviderSettingsManager requires secret storage — no secrets slot installed")
		return secrets
	}

	function generateId(): string {
		return Math.random().toString(36).substring(2, 15)
	}

	let _lock = Promise.resolve()
	function lock<T>(cb: () => Promise<T>): Promise<T> {
		const next = _lock.then(cb)
		_lock = next.catch(() => {}) as Promise<void>
		return next
	}

	function getDeps(): ProviderSettingsDeps {
		return {
			lock: <T>(cb: () => Promise<T>) => lock(cb),
			load: () => load(),
			store: (profiles: ProviderProfiles) => store(profiles),
			generateId: () => generateId(),
		}
	}

	async function initialize(): Promise<void> {
		try {
			return await lock(() =>
				initializeCore(
					context,
					() => loadRaw(),
					(profiles) => store(profiles),
					() => generateId(),
					defaultProviderProfiles,
				),
			)
		} catch (error) {
			throw new Error(`Failed to initialize config: ${error}`)
		}
	}

	async function loadRaw(): Promise<ProviderProfiles | null> {
		try {
			const profiles = await loadProviderProfiles(getSecrets(), defaultProviderProfiles)
			return profiles === defaultProviderProfiles ? null : profiles
		} catch {
			return null
		}
	}

	async function load(): Promise<ProviderProfiles> {
		return loadProviderProfiles(getSecrets(), defaultProviderProfiles)
	}

	async function store(providerProfiles: ProviderProfiles): Promise<void> {
		return storeProviderProfiles(getSecrets(), providerProfiles)
	}

	async function doListConfig(): Promise<ProviderSettingsEntry[]> {
		return listConfig(getDeps())
	}

	async function doSaveConfig(name: string, config: ProviderSettingsWithId): Promise<string> {
		return saveConfig(name, config, getDeps())
	}

	async function doGetProfile(
		params: { name: string } | { id: string },
	): Promise<ProviderSettingsWithId & { name: string }> {
		return getProfile(params, getDeps())
	}

	async function doActivateProfile(
		params: { name: string } | { id: string },
	): Promise<ProviderSettingsWithId & { name: string }> {
		return activateProfile(params, getDeps())
	}

	async function doDeleteConfig(name: string): Promise<void> {
		return deleteConfig(name, getDeps())
	}

	async function doHasConfig(name: string): Promise<boolean> {
		return hasConfig(name, getDeps())
	}

	async function doSetModeConfig(mode: Mode, configId: string): Promise<void> {
		return setModeConfig(mode, configId, getDeps())
	}

	async function doGetModeConfigId(mode: Mode): Promise<string | undefined> {
		return getModeConfigId(mode, getDeps())
	}

	async function getCurrentConfigName(): Promise<string | undefined> {
		return lock(async () => {
			const providerProfiles = await load()
			const name = providerProfiles.currentApiConfigName
			return name && providerProfiles.apiConfigs[name] ? name : undefined
		})
	}

	async function doExport(): Promise<ProviderProfiles> {
		return exportProviderProfiles(getDeps())
	}

	async function doImport(providerProfiles: ProviderProfiles): Promise<void> {
		return importProviderProfiles(providerProfiles, getDeps())
	}

	async function resetAllConfigs(): Promise<void> {
		const key = secretsKey()
		await getSecrets().delete(key)
	}

	async function doSyncCloudProfiles(
		cloudProfiles: Record<string, ProviderSettingsWithId>,
		currentActiveProfileName?: string,
	): Promise<SyncCloudProfilesResult> {
		return syncCloudProfiles(cloudProfiles, currentActiveProfileName, getDeps())
	}

	initialize().catch(console.error)

	return {
		generateId,
		initialize,
		listConfig: doListConfig,
		saveConfig: doSaveConfig,
		getProfile: doGetProfile,
		activateProfile: doActivateProfile,
		deleteConfig: doDeleteConfig,
		hasConfig: doHasConfig,
		setModeConfig: doSetModeConfig,
		getModeConfigId: doGetModeConfigId,
		getCurrentConfigName,
		export: doExport,
		import: doImport,
		resetAllConfigs,
		syncCloudProfiles: doSyncCloudProfiles,
	}
}

/** ProviderSettingsManager instance type */
export type ProviderSettingsManager = ReturnType<typeof ProviderSettingsManager>

const _psmState: { manager: ProviderSettingsManager | null } = { manager: null }

export function setProviderSettingsManager(mgr: ProviderSettingsManager): void {
	_psmState.manager = mgr
}

export function getProviderSettingsManager(): ProviderSettingsManager | null {
	return _psmState.manager
}

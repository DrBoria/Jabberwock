// v4 B2 (L14): structural host-context view instead of the vscode type.
import type { IExtensionContextView, ISecretsView } from "@features/foundation/vscode/context"

import { type ProviderSettingsWithId, ProviderSettingsEntry } from "@jabberwock/types"

import { type Mode } from "@shared/modes"

import {
	type ProviderProfiles,
	type SyncCloudProfilesResult,
	type ProviderSettingsDeps,
} from "./ProviderSettingsManager-types"
import { initializeCore } from "./operations/ProviderSettingsManager-initialize"
import { syncCloudProfiles } from "./operations/ProviderSettingsManager-sync"
import {
	loadProviderProfiles,
	storeProviderProfiles,
	secretsKey,
} from "./operations/ProviderSettingsManager-persistence"
import {
	listConfig,
	saveConfig,
	getProfile,
	activateProfile,
	deleteConfig,
	hasConfig,
	setModeConfig,
	getModeConfigId,
} from "./operations/ProviderSettingsManager-crud"
import { exportProviderProfiles, importProviderProfiles } from "./operations/ProviderSettingsManager-export-import"

import { modes } from "@shared/modes"

export class ProviderSettingsManager {
	private readonly defaultConfigId = this.generateId()
	private readonly defaultModeApiConfigs: Record<string, string> = Object.fromEntries(
		modes.map((mode) => [mode.slug, this.defaultConfigId]),
	)

	private readonly defaultProviderProfiles: ProviderProfiles = {
		currentApiConfigName: "default",
		apiConfigs: { default: { id: this.defaultConfigId } },
		modeApiConfigs: this.defaultModeApiConfigs,
		migrations: {
			rateLimitSecondsMigrated: true,
			openAiHeadersMigrated: true,
			consecutiveMistakeLimitMigrated: true,
			todoListEnabledMigrated: true,
			claudeCodeLegacySettingsMigrated: true,
		},
	}

	private readonly context: IExtensionContextView
	/**
	 * Secret storage is mandatory for provider profiles (host contexts always provide it;
	 * server mode must install a secrets slot before constructing this manager).
	 */
	private get secrets(): ISecretsView {
		const secrets = this.context.secrets
		if (!secrets) throw new Error("ProviderSettingsManager requires secret storage — no secrets slot installed")
		return secrets
	}

	constructor(context: IExtensionContextView) {
		this.context = context
		this.initialize().catch(console.error)
	}

	public generateId(): string {
		return Math.random().toString(36).substring(2, 15)
	}

	private _lock = Promise.resolve()
	private lock<T>(cb: () => Promise<T>): Promise<T> {
		const next = this._lock.then(cb)
		this._lock = next.catch(() => {}) as Promise<void>
		return next
	}

	private get deps(): ProviderSettingsDeps {
		return {
			lock: <T>(cb: () => Promise<T>) => this.lock(cb),
			load: () => this.load(),
			store: (profiles: ProviderProfiles) => this.store(profiles),
			generateId: () => this.generateId(),
		}
	}

	public async initialize(): Promise<void> {
		try {
			return await this.lock(() =>
				initializeCore(
					this.context,
					() => this.loadRaw(),
					(profiles) => this.store(profiles),
					() => this.generateId(),
					this.defaultProviderProfiles,
				),
			)
		} catch (error) {
			throw new Error(`Failed to initialize config: ${error}`)
		}
	}

	private async loadRaw(): Promise<ProviderProfiles | null> {
		try {
			const profiles = await loadProviderProfiles(this.secrets, this.defaultProviderProfiles)
			return profiles === this.defaultProviderProfiles ? null : profiles
		} catch {
			return null
		}
	}

	private async load(): Promise<ProviderProfiles> {
		return loadProviderProfiles(this.secrets, this.defaultProviderProfiles)
	}

	private async store(providerProfiles: ProviderProfiles): Promise<void> {
		return storeProviderProfiles(this.secrets, providerProfiles)
	}

	public async listConfig(): Promise<ProviderSettingsEntry[]> {
		return listConfig(this.deps)
	}

	public async saveConfig(name: string, config: ProviderSettingsWithId): Promise<string> {
		return saveConfig(name, config, this.deps)
	}

	public async getProfile(
		params: { name: string } | { id: string },
	): Promise<ProviderSettingsWithId & { name: string }> {
		return getProfile(params, this.deps)
	}

	public async activateProfile(
		params: { name: string } | { id: string },
	): Promise<ProviderSettingsWithId & { name: string }> {
		return activateProfile(params, this.deps)
	}

	public async deleteConfig(name: string): Promise<void> {
		return deleteConfig(name, this.deps)
	}

	public async hasConfig(name: string): Promise<boolean> {
		return hasConfig(name, this.deps)
	}

	public async setModeConfig(mode: Mode, configId: string): Promise<void> {
		return setModeConfig(mode, configId, this.deps)
	}

	public async getModeConfigId(mode: Mode): Promise<string | undefined> {
		return getModeConfigId(mode, this.deps)
	}

	public async export(): Promise<ProviderProfiles> {
		return exportProviderProfiles(this.deps)
	}

	public async import(providerProfiles: ProviderProfiles): Promise<void> {
		return importProviderProfiles(providerProfiles, this.deps)
	}

	public async resetAllConfigs(): Promise<void> {
		const key = secretsKey()
		await this.secrets.delete(key)
	}

	public async syncCloudProfiles(
		cloudProfiles: Record<string, ProviderSettingsWithId>,
		currentActiveProfileName?: string,
	): Promise<SyncCloudProfilesResult> {
		return syncCloudProfiles(cloudProfiles, currentActiveProfileName, this.deps)
	}
}

let _providerSettingsManager: ProviderSettingsManager | null = null

export function setProviderSettingsManager(mgr: ProviderSettingsManager): void {
	_providerSettingsManager = mgr
}

export function getProviderSettingsManager(): ProviderSettingsManager | null {
	return _providerSettingsManager
}

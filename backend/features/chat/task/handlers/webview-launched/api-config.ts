import type { ProviderSettingsEntry, ProviderNameWithRetired, ProviderSettings } from "@jabberwock/types"
import { getProviderSettingsManager } from "@features/settings/models/provider-settings-manager"
import { getHostEnvironment } from "@features/foundation"
import { checkExistKey } from "@shared/api/checkExistApiConfig"
import { activateProviderProfile, sendListApiConfigToProvider } from "@features/settings"

import { getStore } from "@features/singleton"

export function loadApiConfiguration(rootStore: never): { [key: string]: unknown } {
	const additionalState: { [key: string]: unknown } = {}

	try {
		const apiConfig = getStoreApiConfig(rootStore)

		if (apiConfig.apiProvider) {
			additionalState.apiConfiguration = apiConfig.toProviderSettings()
		}

		if (apiConfig.listApiConfigMeta) {
			additionalState.listApiConfigMeta = apiConfig.listApiConfigMeta
		}
	} catch (error: unknown) {
		console.error(
			`[jabberwock] [${new Date().toISOString()}] webviewDidLaunch: failed to load apiConfiguration:`,
			error,
		)
	}

	return additionalState
}

export function getStoreApiConfig(rootStore: never): {
	apiProvider?: string
	toProviderSettings: () => unknown
	listApiConfigMeta?: Array<{ id: string; name: string }>
} {
	return (rootStore as never as { settings: { apiConfig: never } }).settings.apiConfig as never
}

export async function syncApiConfigProfiles(
	provider: { postMessageToWebview: (msg: unknown) => Promise<void> },
	rootStore: never,
): Promise<void> {
	const psm = getProviderSettingsManager()

	if (psm) {
		try {
			const listApiConfig = await psm.listConfig()
			await processApiConfigList(listApiConfig, psm, provider, rootStore)
		} catch (error) {
			console.error(
				`[jabberwock] [${new Date().toISOString()}] syncApiConfigProfiles: failed to sync API config profiles:`,
				error,
			)
		}
	}
}

export async function initializeStoreApiConfig(): Promise<void> {
	try {
		const psm = getProviderSettingsManager()
		if (!psm) return

		const rootStore = getStore()
		const apiConfig = getStoreApiConfig(rootStore as never) as never as {
			setConfiguration: (p: unknown) => void
			setCurrentConfigName: (n: string) => void
			setListApiConfigMeta: (l: ProviderSettingsEntry[]) => void
		}

		const listApiConfig = await psm.listConfig()

		// Populate the MST list cache at startup so hello→state snapshots and
		// later state pushes (loadApiConfiguration) carry the real profile list.
		// Without this the snapshot sends listApiConfigMeta: [], which the
		// frontend merge overwrites its good list with and the dropdown goes empty.
		apiConfig.setListApiConfigMeta(listApiConfig)

		let currentConfigName: string | undefined = getHostEnvironment().getGlobalState("currentApiConfigName")

		if (!currentConfigName && listApiConfig.length > 0) {
			currentConfigName = listApiConfig[0].name
			await getHostEnvironment().updateGlobalState("currentApiConfigName", currentConfigName)
		}

		if (currentConfigName) {
			const profile = await psm.getProfile({ name: currentConfigName })
			if (profile) {
				apiConfig.setConfiguration(profile)
				apiConfig.setCurrentConfigName(currentConfigName)
			}
		}
	} catch (error) {
		console.error(
			`[jabberwock] [${new Date().toISOString()}] initializeStoreApiConfig: failed to populate apiConfig:`,
			error,
		)
	}
}

async function processApiConfigList(
	listApiConfig: ProviderSettingsEntry[],
	psm: NonNullable<ReturnType<typeof getProviderSettingsManager>>,
	provider: { postMessageToWebview: (msg: unknown) => Promise<void> },
	rootStore: never,
): Promise<void> {
	if (!listApiConfig) {
		return
	}

	await migrateSingleConfig(listApiConfig, psm, rootStore)
	await reconcileCurrentConfigName(psm)
	await resolveApiConfigName(listApiConfig, psm, provider)

	await Promise.all([
		getHostEnvironment().updateGlobalState("listApiConfigMeta", listApiConfig),
		sendListApiConfigToProvider(provider, listApiConfig),
	])

	await syncMstConfigProfile(psm, rootStore, listApiConfig)
}

async function migrateSingleConfig(
	listApiConfig: ProviderSettingsEntry[],
	psm: NonNullable<ReturnType<typeof getProviderSettingsManager>>,
	rootStore: never,
): Promise<void> {
	if (listApiConfig.length !== 1) {
		return
	}

	if (checkExistKey(listApiConfig[0])) {
		return
	}

	const apiConfig = getStoreApiConfig(rootStore)
	const apiConfiguration = apiConfig.toProviderSettings() as ProviderSettings | undefined

	if (apiConfiguration && checkExistKey(apiConfiguration)) {
		await psm.saveConfig(listApiConfig[0].name ?? "default", apiConfiguration)
		listApiConfig[0].apiProvider = (apiConfiguration as { [key: string]: unknown })
			.apiProvider as ProviderNameWithRetired
	}
}

/**
 * Reconcile the memento's active-profile name to the PSM's authoritative value.
 *
 * The active profile is persisted in two places:
 *  - PSM (`secrets.json` → `currentApiConfigName`) — the source of truth that
 *    actually drives which provider/model the task uses.
 *  - the memento (`currentApiConfigName` global state) — a redundant UI cache
 *    that the webview switcher reads via the backend store.
 *
 * A profile switch writes PSM first, then the memento, so PSM is always at
 * least as fresh. But other mutations (e.g. the startup id-dedup repair) can
 * leave the memento pointing at a different profile than PSM. Without this,
 * the webview would show the stale memento profile instead of the one PSM is
 * actually using. Reconcile memento → PSM (one-way, safe) before the store is
 * populated from "the" memento.
 */
async function reconcileCurrentConfigName(
	psm: NonNullable<ReturnType<typeof getProviderSettingsManager>>,
): Promise<void> {
	try {
		const psmCurrent = await psm.getCurrentConfigName()
		if (!psmCurrent) {
			return
		}
		const mementoCurrent = getHostEnvironment().getGlobalState("currentApiConfigName")
		if (mementoCurrent !== psmCurrent) {
			await getHostEnvironment().updateGlobalState("currentApiConfigName", psmCurrent)
		}
	} catch (error) {
		console.error(`[jabberwock] reconcileCurrentConfigName failed:`, error)
	}
}

async function resolveApiConfigName(
	listApiConfig: ProviderSettingsEntry[],
	psm: NonNullable<ReturnType<typeof getProviderSettingsManager>>,
	provider: { postMessageToWebview: (msg: unknown) => Promise<void> },
): Promise<void> {
	const currentConfigName: string | undefined = getHostEnvironment().getGlobalState("currentApiConfigName")

	if (!currentConfigName) {
		return
	}

	if (await psm.hasConfig(currentConfigName)) {
		return
	}

	const name = listApiConfig[0]?.name

	await getHostEnvironment().updateGlobalState("currentApiConfigName", name)

	if (name) {
		await activateProviderProfile(provider as never, { name })
	}
}

async function syncMstConfigProfile(
	psm: NonNullable<ReturnType<typeof getProviderSettingsManager>>,
	rootStore: never,
	listApiConfig?: ProviderSettingsEntry[],
): Promise<void> {
	try {
		const currentConfigName: string | undefined = getHostEnvironment().getGlobalState("currentApiConfigName")

		if (currentConfigName) {
			const apiConfig = getStoreApiConfig(rootStore) as never as {
				setConfiguration: (p: unknown) => void
				setCurrentConfigName: (n: string) => void
				setListApiConfigMeta: (l: ProviderSettingsEntry[]) => void
			}
			const profile = await psm.getProfile({ name: currentConfigName })

			if (profile) {
				apiConfig.setConfiguration(profile)
				apiConfig.setCurrentConfigName(currentConfigName)
			}

			// Keep the MST list cache in sync so state pushes built from the
			// snapshot (e.g. postStateToWebviewWithoutMessages enrichment) carry
			// the real profile list instead of the model default [].
			const meta = listApiConfig ?? (await psm.listConfig())
			if (meta.length > 0) {
				apiConfig.setListApiConfigMeta(meta)
			}
		}
	} catch {
		// Non-critical
	}
}

import type { ProviderSettingsEntry, ProviderNameWithRetired, ProviderSettings } from "@jabberwock/types"
import { getProviderSettingsManager } from "@features/settings/models/provider-settings-manager/ProviderSettingsManager"
import { getVscodeContext } from "@features/foundation/vscode/context"
import { checkExistKey } from "@shared/api/checkExistApiConfig"
import { activateProviderProfile } from "@features/settings/models/api-config-store.profiles"

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

export function syncApiConfigProfiles(
	provider: { postMessageToWebview: (msg: unknown) => Promise<void> },
	rootStore: never,
): void {
	const psm = getProviderSettingsManager()

	if (psm) {
		psm.listConfig().then(async (listApiConfig: ProviderSettingsEntry[]) => {
			await processApiConfigList(listApiConfig, psm, provider, rootStore)
		})
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
	await resolveApiConfigName(listApiConfig, psm, provider)

	await Promise.all([
		getVscodeContext().updateGlobalState("listApiConfigMeta", listApiConfig),
		provider.postMessageToWebview({ type: "listApiConfig", listApiConfig }),
	])

	await syncMstConfigProfile(psm, rootStore)
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

async function resolveApiConfigName(
	listApiConfig: ProviderSettingsEntry[],
	psm: NonNullable<ReturnType<typeof getProviderSettingsManager>>,
	provider: { postMessageToWebview: (msg: unknown) => Promise<void> },
): Promise<void> {
	const currentConfigName: string | undefined = getVscodeContext().getGlobalState("currentApiConfigName")

	if (!currentConfigName) {
		return
	}

	if (await psm.hasConfig(currentConfigName)) {
		return
	}

	const name = listApiConfig[0]?.name

	await getVscodeContext().updateGlobalState("currentApiConfigName", name)

	if (name) {
		await activateProviderProfile(provider as never, { name })
	}
}

async function syncMstConfigProfile(
	psm: NonNullable<ReturnType<typeof getProviderSettingsManager>>,
	rootStore: never,
): Promise<void> {
	try {
		const currentConfigName: string | undefined = getVscodeContext().getGlobalState("currentApiConfigName")

		if (currentConfigName) {
			const apiConfig = getStoreApiConfig(rootStore) as never as {
				setConfiguration: (p: unknown) => void
				setCurrentConfigName: (n: string) => void
			}
			const profile = await psm.getProfile({ name: currentConfigName })

			if (profile) {
				apiConfig.setConfiguration(profile)
				apiConfig.setCurrentConfigName(currentConfigName)
			}
		}
	} catch {
		// Non-critical
	}
}

import { ProviderSettings } from "@jabberwock/types"
import type { IntentHandlerContext as IntentBusCtx } from "@features/intents/context"
import { t } from "@i18n"
import { getHostEnvironment } from "@features/foundation/host-context/context"
import { getProviderSettingsManager } from "@features/settings/models/provider-settings-manager/ProviderSettingsManager"
import { activateProviderProfile } from "@features/settings/models/api-config-store.profiles"
import { postStateToWebview } from "@features/foundation/window-manager/store"
import { getMstState } from "@features/foundation/mst/store"
import { log as backendLog } from "@features/foundation/capabilities/backend-logger"

export async function handleSettingsApiConfigSave(
	intent: { id: string; type: string; payload: unknown },
	ctx: IntentBusCtx,
): Promise<void> {
	const provider = ctx.provider
	if (!provider) return

	const payload = intent.payload as { text: string; apiConfiguration: ProviderSettings }
	if (!payload.text || !payload.apiConfiguration) return

	try {
		await getProviderSettingsManager()!.saveConfig(payload.text, payload.apiConfiguration)
		const listApiConfig = await getProviderSettingsManager()!.listConfig()
		await getHostEnvironment().updateGlobalState("listApiConfigMeta", listApiConfig)
	} catch (error) {
		backendLog.info(
			`Error save api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
		)
		publishNotificationError(t("common:errors.save_api_config"))
	}
}

export async function handleSettingsApiConfigRename(
	intent: { id: string; type: string; payload: unknown },
	ctx: IntentBusCtx,
): Promise<void> {
	const provider = ctx.provider
	if (!provider) return

	const payload = intent.payload as {
		text: string
		values: { oldName: string; newName: string }
		apiConfiguration: ProviderSettings
	}
	if (!payload.values || !payload.apiConfiguration) return

	try {
		const oldName = payload.values.oldName
		const newName = payload.values.newName

		if (oldName === newName) return

		const { id } = await getProviderSettingsManager()!.getProfile({ name: oldName })
		await getProviderSettingsManager()!.saveConfig(newName, { ...payload.apiConfiguration, id })
		await getProviderSettingsManager()!.deleteConfig(oldName)

		await activateProviderProfile(provider, { name: newName })
	} catch (error) {
		backendLog.info(
			`Error rename api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
		)
		publishNotificationError(t("common:errors.rename_api_config"))
	}
}

export async function handleSettingsApiConfigLoad(
	intent: { id: string; type: string; payload: unknown },
	ctx: IntentBusCtx,
): Promise<void> {
	const provider = ctx.provider
	if (!provider) return

	const payload = intent.payload as { text: string }
	if (!payload.text) return

	try {
		const profile = await activateProviderProfile(provider, { name: payload.text })
		if (profile) {
			await getHostEnvironment().updateGlobalState("currentApiConfigName", payload.text)
		}
		await postStateToWebview(provider)
	} catch (error) {
		backendLog.info(
			`Error load api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
		)
		publishNotificationError(t("common:errors.load_api_config"))
	}
}

export async function handleSettingsApiConfigLoadById(
	intent: { id: string; type: string; payload: unknown },
	ctx: IntentBusCtx,
): Promise<void> {
	const provider = ctx.provider
	if (!provider) return

	const payload = intent.payload as { text: string }
	if (!payload.text) return

	try {
		const profile = await activateProviderProfile(provider, { id: payload.text })
		if (profile) {
			const configName = typeof profile.name === "string" ? profile.name : undefined
			await getHostEnvironment().updateGlobalState("currentApiConfigName", configName)
		}
		await postStateToWebview(provider)
	} catch (error) {
		backendLog.info(
			`Error load api configuration by ID: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
		)
		publishNotificationError(t("common:errors.load_api_config"))
	}
}

export async function handleSettingsApiConfigList(
	_intent: { id: string; type: string; payload: unknown },
	ctx: IntentBusCtx,
): Promise<void> {
	const provider = ctx.provider
	if (!provider) return

	try {
		const listApiConfig = await getProviderSettingsManager()!.listConfig()
		await getHostEnvironment().updateGlobalState("listApiConfigMeta", listApiConfig)
		provider.postMessageToWebview({ type: "listApiConfig", listApiConfig })
		getMstState(ctx.rootStore).listApiConfigStore?.setListApiConfig(listApiConfig)
	} catch (error) {
		backendLog.info(
			`Error get list api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
		)
		publishNotificationError(t("common:errors.list_api_config"))
	}
}

export async function handleSettingsApiConfigLockModes(
	intent: { id: string; type: string; payload: unknown },
	ctx: IntentBusCtx,
): Promise<void> {
	const provider = ctx.provider
	if (!provider) return

	const payload = intent.payload as { bool: boolean }
	const enabled = payload.bool ?? false
	await getHostEnvironment().extensionContext.workspaceState.update("lockApiConfigAcrossModes", enabled)
	await postStateToWebview(provider)
}

export async function handleSettingsApiConfigPinToggle(
	intent: { id: string; type: string; payload: unknown },
	ctx: IntentBusCtx,
): Promise<void> {
	const provider = ctx.provider
	if (!provider) return

	const payload = intent.payload as { text: string }
	if (!payload.text) return

	const currentPinned =
		getHostEnvironment().getGlobalState<Record<string, boolean>>("pinnedApiConfigs") ??
		({} as Record<string, boolean>)
	const updatedPinned: Record<string, boolean> = { ...currentPinned }

	if (currentPinned[payload.text]) {
		delete updatedPinned[payload.text]
	} else {
		updatedPinned[payload.text] = true
	}

	await getHostEnvironment().updateGlobalState("pinnedApiConfigs", updatedPinned)
	await postStateToWebview(provider)
}

export async function handleSettingsApiConfigEnhancementId(
	intent: { id: string; type: string; payload: unknown },
	ctx: IntentBusCtx,
): Promise<void> {
	const provider = ctx.provider
	if (!provider) return

	const payload = intent.payload as { text: string }
	await getHostEnvironment().updateGlobalState("enhancementApiConfigId", payload.text)
	await postStateToWebview(provider)
}

import { publishNotificationError } from "@features/foundation/capabilities/notifications"

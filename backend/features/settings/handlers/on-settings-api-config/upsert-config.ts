import { ProviderSettings } from "@jabberwock/types"
import type { IntentHandlerContext as IntentBusCtx } from "@features/intents/context"
import { t } from "@i18n"
import { getVscodeContext } from "@features/foundation/vscode/context"
import { getProviderSettingsManager } from "@features/settings/models/provider-settings-manager/ProviderSettingsManager"
import { upsertProviderProfile } from "@features/settings/models/api-config-store.profiles"
import { postStateToWebview } from "@features/foundation/window-manager/store"
import { log as backendLog } from "@features/foundation/capabilities/backend-logger"

export async function handleSettingsApiConfigUpsert(
	intent: { id: string; type: string; payload: unknown },
	ctx: IntentBusCtx,
): Promise<void> {
	const provider = ctx.provider
	if (!provider) return

	const payload = intent.payload as { text: string; apiConfiguration: ProviderSettings }
	if (!payload.text || !payload.apiConfiguration) return

	console.log(
		`[handlers/upsertApiConfiguration] START: name="${payload.text}", apiProvider="${payload.apiConfiguration.apiProvider}", apiModelId="${payload.apiConfiguration.apiModelId}"`,
	)
	console.log(`[handlers/upsertApiConfiguration] providerSettingsManager exists:`, !!getProviderSettingsManager())

	try {
		const result = await upsertProviderProfile(provider, payload.text, payload.apiConfiguration, true)

		console.log(`[handlers/upsertApiConfiguration] upsertProviderProfile returned:`, result)

		if (!getProviderSettingsManager()) {
			console.log(
				`[handlers/upsertApiConfiguration] ERROR: providerSettingsManager is undefined - config will NOT be persisted!`,
			)
			publishNotificationError("API config persistence not available. Please reload VS Code.")
			return
		}

		const listApiConfig = await getProviderSettingsManager()!.listConfig()
		console.log(`[handlers/upsertApiConfiguration] listConfig returned ${listApiConfig?.length ?? 0} configs`)

		await getVscodeContext().updateGlobalState("listApiConfigMeta", listApiConfig)
		await getVscodeContext().updateGlobalState("currentApiConfigName", payload.text)
		console.log(`[handlers/upsertApiConfiguration] saved currentApiConfigName="${payload.text}" to global state`)

		await postStateToWebview(provider, { apiConfiguration: payload.apiConfiguration })
		console.log(`[handlers/upsertApiConfiguration] DONE: posted state to webview`)
	} catch (error) {
		console.log(
			`[handlers/upsertApiConfiguration] ERROR: ${error instanceof Error ? error.message : String(error)}`,
		)
		backendLog.info(
			`Error create new api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
		)
		publishNotificationError(t("common:errors.save_api_config"))
	}
}

import { publishNotificationError } from "@features/foundation/capabilities/notifications"

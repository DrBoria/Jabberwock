import type { IntentHandlerContext as IntentBusCtx } from "@features/intents"

import { getUiDialogs } from "@features/foundation"

import { t } from "@i18n"

import { getProviderSettingsManager } from "@features/settings/models/provider-settings-manager"

import { activateProviderProfile } from "@features/settings"

import { log as backendLog } from "@features/foundation"

import { publishNotificationError } from "@features/foundation"

export async function handleSettingsApiConfigDelete(
	intent: { id: string; type: string; payload: unknown },
	ctx: IntentBusCtx,
): Promise<void> {
	const provider = ctx.provider
	if (!provider) return

	const payload = intent.payload as { text: string }
	if (!payload.text) return

	// D4g-2 (batch 3): modal confirmation via the uiDialogs slot (D4c) — server mode resolves
	// undefined (no dialog), so the delete is cancelled headless.
	const answer = await getUiDialogs().showConfirmDialog({
		message: t("common:confirmation.delete_config_profile"),
		modal: true,
		buttons: [t("common:answers.yes")],
	})

	if (answer !== t("common:answers.yes")) return

	const oldName = payload.text
	const newName = (await getProviderSettingsManager()!.listConfig()).filter((c) => c.name !== oldName)[0]?.name

	if (!newName) {
		publishNotificationError(t("common:errors.delete_api_config"))
		return
	}

	try {
		await getProviderSettingsManager()!.deleteConfig(oldName)
		await activateProviderProfile(provider, { name: newName })
	} catch (error) {
		backendLog.info(
			`Error delete api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
		)
		publishNotificationError(t("common:errors.delete_api_config"))
	}
}

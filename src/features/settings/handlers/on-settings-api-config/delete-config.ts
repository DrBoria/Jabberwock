import type { IntentHandlerContext as IntentBusCtx } from "@features/intents/context"
import * as vscode from "vscode"
import { t } from "@i18n"
import { getProviderSettingsManager } from "@features/settings/models/provider-settings-manager/ProviderSettingsManager"
import { activateProviderProfile } from "@features/settings/models/api-config-store.profiles"
import { EventBridge } from "@features/foundation/webview/EventBridge"

export async function handleSettingsApiConfigDelete(
	intent: { id: string; type: string; payload: unknown },
	ctx: IntentBusCtx,
): Promise<void> {
	const provider = ctx.provider
	if (!provider) return

	const payload = intent.payload as { text: string }
	if (!payload.text) return

	const answer = await vscode.window.showInformationMessage(
		t("common:confirmation.delete_config_profile"),
		{ modal: true },
		t("common:answers.yes"),
	)

	if (answer !== t("common:answers.yes")) return

	const oldName = payload.text
	const newName = (await getProviderSettingsManager()!.listConfig()).filter((c) => c.name !== oldName)[0]?.name

	if (!newName) {
		vscode.window.showErrorMessage(t("common:errors.delete_api_config"))
		return
	}

	try {
		await getProviderSettingsManager()!.deleteConfig(oldName)
		await activateProviderProfile(provider, { name: newName })
	} catch (error) {
		EventBridge.outputChannel?.appendLine(
			`Error delete api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
		)
		vscode.window.showErrorMessage(t("common:errors.delete_api_config"))
	}
}

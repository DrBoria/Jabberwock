import { IntentType } from "@jabberwock/types"
import type { ProviderSettings } from "@jabberwock/types"
import type { IntentBus } from "../../../intents/bus"
import { EventBridge } from "../../../foundation/webview/EventBridge"
import { MessageEnhancer } from "./messageEnhancer"
import { getProviderSettingsManager } from "../../../settings/models/ProviderSettingsManager"
import * as vscode from "vscode"
import { t } from "../../../../i18n"

/**
 * Handles textarea.enhance.requested intent — enhances a prompt using AI.
 */
export function registerOnTextareaEnhanceRequested(bus: IntentBus): void {
	bus.register(IntentType.TextareaEnhanceRequested, async (intent, ctx) => {
		const { text } = intent.payload as { text: string }
		const provider = ctx.provider

		if (!provider || !text) {
			return
		}

		try {
			const apiConfig = ctx.rootStore.settings.apiConfig

			const apiConfiguration = apiConfig.toProviderSettings() as ProviderSettings
			const listApiConfigMeta: Array<{ id: string; name: string }> = (apiConfig.listApiConfigMeta || []).map(
				(m) => ({
					id: m.id || "default",
					name: m.name,
				}),
			)

			const currentCline = ctx.rootStore.chat.activeTask

			const result = await MessageEnhancer.enhanceMessage({
				text,
				apiConfiguration,
				listApiConfigMeta,
				currentClineMessages: currentCline?.messages,
				providerSettingsManager: getProviderSettingsManager()!,
			})

			if (result.success && result.enhancedText) {
				MessageEnhancer.captureTelemetry(currentCline?.taskId)
				await provider.postMessageToWebview({ type: "enhancedPrompt", text: result.enhancedText })
			} else {
				throw new Error(result.error || "Unknown error")
			}
		} catch (error) {
			EventBridge.outputChannel?.appendLine(
				`Error enhancing prompt: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
			)

			vscode.window.showErrorMessage(t("common:errors.enhance_prompt"))
			await provider!.postMessageToWebview({ type: "enhancedPrompt" })
		}
	})
}

import { IntentType } from "@jabberwock/types"

import type { ProviderSettings } from "@jabberwock/types"
import type { IntentBus } from "@features/intents"
import { log as backendLog } from "@features/foundation"

import { enhanceMessage, captureTelemetry, sendEnhancedPrompt } from "@features/chat"

import { getProviderSettingsManager } from "@features/settings/models/provider-settings-manager"

import { t } from "@i18n"

import { publishNotificationError } from "@features/foundation"

/**
 * Handles textarea.enhance.requested intent — enhances a prompt using AI.
 */
export function registerOnTextareaEnhanceRequested(bus: IntentBus): void {
	bus.register(IntentType.TextareaEnhanceRequested, async (intent, ctx) => {
		handleEnhanceRequested(intent as { payload: { text: string } }, ctx as never).catch((error) => {
			backendLog.info(`Error enhancing prompt: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)

			publishNotificationError(t("common:errors.enhance_prompt"))
			if (ctx.provider) {
				sendEnhancedPrompt(ctx.provider)
			}
		})
	})
}

async function handleEnhanceRequested(
	intent: { payload: { text: string } },
	ctx: {
		provider?: { postMessageToWebview: (msg: unknown) => Promise<void> }
		rootStore: {
			settings: {
				apiConfig: {
					toProviderSettings: () => unknown
					listApiConfigMeta?: Array<{ id?: string; name: string }>
				}
			}
			chat: { activeTask?: { messages?: unknown[]; taskId?: string } | null }
		}
	},
): Promise<void> {
	const { text } = intent.payload as { text: string }
	const provider = ctx.provider

	if (!provider || !text) {
		return
	}

	const apiConfig = ctx.rootStore.settings.apiConfig

	const apiConfiguration = apiConfig.toProviderSettings() as ProviderSettings
	const listApiConfigMeta: Array<{ id: string; name: string }> = (apiConfig.listApiConfigMeta || []).map((m) => ({
		id: m.id || "default",
		name: m.name,
	}))

	const currentCline = ctx.rootStore.chat.activeTask

	const result = await enhanceMessage({
		text,
		apiConfiguration,
		listApiConfigMeta,
		currentClineMessages: currentCline?.messages as { type: "ask" | "say"; ts: number }[] | undefined,
		providerSettingsManager: getProviderSettingsManager()!,
	})

	if (result.success && result.enhancedText) {
		captureTelemetry(currentCline?.taskId)
		await sendEnhancedPrompt(provider, result.enhancedText)
	} else {
		throw new Error(result.error || "Unknown error")
	}
}

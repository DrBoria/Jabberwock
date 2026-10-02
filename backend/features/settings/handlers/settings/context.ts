import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents"
import type { WebviewMessage, JabberwockSettings } from "@jabberwock/types"

import { getHostEnvironment } from "@features/foundation"

import { getSettingsAccess } from "@utils/settings"

import { generateSystemPrompt, sendSystemPrompt } from "@features/settings"

import { sendState } from "@features/chat"

import { getTelemetryService, hasTelemetryService } from "@jabberwock/telemetry"

import { t } from "@i18n"

import type { WebviewStatePayload } from "@features/foundation"

import { getClipboard, getUiDialogs } from "@features/foundation"

import { log as backendLog } from "@features/foundation"

import { publishNotificationError } from "@features/foundation"

/**
 * Register all context/prompt settings intent handlers.
 */

function registerOnSettingsContextSettingsPromptUpdate(bus: IntentBus): void {
	bus.register(IntentType.SettingsPromptUpdate, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { promptMode: string; customPrompt: { [key: string]: unknown } }
		if (!payload.promptMode || payload.customPrompt === undefined) return

		const existingPrompts = (getHostEnvironment().getGlobalState("customModePrompts") ?? {}) as Record<
			string,
			{ [key: string]: unknown }
		>
		const updatedPrompts = { ...existingPrompts, [payload.promptMode]: payload.customPrompt }
		await getHostEnvironment().updateGlobalState("customModePrompts", updatedPrompts)
		const hasOpenedModeSelector = (getSettingsAccess().getValue(
			"hasOpenedModeSelector" as keyof JabberwockSettings,
		) ?? false) as boolean
		const stateWithPrompts = {
			...ctx.rootStore,
			customModePrompts: updatedPrompts,
			hasOpenedModeSelector,
		} as WebviewStatePayload
		sendState(provider, stateWithPrompts)

		if (hasTelemetryService()) {
			const oldPrompt = (existingPrompts[payload.promptMode] || {}) as { [key: string]: unknown }
			const newPrompt = payload.customPrompt
			const changedSettings = Object.keys(newPrompt).filter(
				(key) => JSON.stringify(oldPrompt[key]) !== JSON.stringify(newPrompt[key]),
			)

			if (changedSettings.length > 0) {
				getTelemetryService().captureModeSettingChanged(changedSettings[0])
			}
		}
	})
}

function registerOnSettingsContextSettingsPromptSystemTemplateUpdate(bus: IntentBus): void {
	bus.register(IntentType.SettingsPromptSystemTemplateUpdate, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as {
			systemPromptTemplateKey: string
			systemPromptTemplate?: string
		}
		if (payload.systemPromptTemplateKey === undefined) return

		const existingTemplates = (getHostEnvironment().getGlobalState("systemPromptTemplates") ?? {}) as Record<
			string,
			string
		>
		const updatedTemplates = { ...existingTemplates }

		if (payload.systemPromptTemplate === undefined || payload.systemPromptTemplate === "") {
			delete updatedTemplates[payload.systemPromptTemplateKey]
		} else {
			updatedTemplates[payload.systemPromptTemplateKey] = payload.systemPromptTemplate
		}

		await getHostEnvironment().updateGlobalState("systemPromptTemplates", updatedTemplates)
		const hasOpenedModeSelector = (getSettingsAccess().getValue(
			"hasOpenedModeSelector" as keyof JabberwockSettings,
		) ?? false) as boolean
		const stateWithTemplates = {
			...ctx.rootStore,
			systemPromptTemplates: updatedTemplates,
			hasOpenedModeSelector,
		} as WebviewStatePayload
		sendState(provider, stateWithTemplates)
	})
}

function registerOnSettingsContextSettingsPromptSystemGet(bus: IntentBus): void {
	bus.register(IntentType.SettingsPromptSystemGet, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { mode?: string }

		try {
			const systemPrompt = await generateSystemPrompt(provider, payload as WebviewMessage)

			await sendSystemPrompt(provider, {
				text: systemPrompt,
				mode: payload.mode,
			})
		} catch (error) {
			backendLog.info(
				`Error getting system prompt: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
			publishNotificationError(t("common:errors.get_system_prompt"))
		}
	})
}

function registerOnSettingsContextSettingsPromptSystemCopy(bus: IntentBus): void {
	bus.register(IntentType.SettingsPromptSystemCopy, async (intent, ctx) => {
		const payload = intent.payload as { mode?: string }

		try {
			const provider = ctx.provider
			if (!provider) return

			const systemPrompt = await generateSystemPrompt(provider, payload as WebviewMessage)

			// D4g-2 (batch 3): clipboard + toast via the capability slots (D4c) — server mode has
			// no host clipboard, so the copy degrades to a no-op.
			await getClipboard()?.writeText(systemPrompt)
			await getUiDialogs().showInformationMessage(t("common:info.clipboard_copy"))
		} catch (error) {
			backendLog.info(
				`Error getting system prompt: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
			publishNotificationError(t("common:errors.get_system_prompt"))
		}
	})
}

function registerOnSettingsContextSettingsInstructionsCustomUpdate(bus: IntentBus): void {
	bus.register(IntentType.SettingsInstructionsCustomUpdate, async (intent) => {
		const payload = intent.payload as { text: string }
		await getHostEnvironment().updateGlobalState("customInstructions", payload.text)
	})
}

export function registerOnSettingsContext(_bus: IntentBus): void {
	registerOnSettingsContextSettingsPromptUpdate(_bus)
	registerOnSettingsContextSettingsPromptSystemTemplateUpdate(_bus)
	registerOnSettingsContextSettingsPromptSystemGet(_bus)
	registerOnSettingsContextSettingsPromptSystemCopy(_bus)
	registerOnSettingsContextSettingsInstructionsCustomUpdate(_bus)
}

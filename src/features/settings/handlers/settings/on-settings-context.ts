import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import type { WebviewMessage, JabberwockSettings } from "@jabberwock/types"
import { getVscodeContext } from "@features/foundation/vscode/context"
import { getSettingsAccess } from "@utils/settings"
import { generateSystemPrompt } from "@features/settings/context/generateSystemPrompt"
import { getTelemetryService, hasTelemetryService } from "@jabberwock/telemetry"
import { t } from "@i18n"
import * as vscode from "vscode"
import type { WebviewStatePayload } from "@features/foundation/window-manager/store"
import { EventBridge } from "@features/foundation/webview/EventBridge"

/**
 * Register all context/prompt settings intent handlers.
 */

export function registerOnSettingsContext(bus: IntentBus): void {
	// ── updatePrompt ──────────────────────────────────────────────────
	bus.register(IntentType.SettingsPromptUpdate, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { promptMode: string; customPrompt: { [key: string]: unknown } }
		if (!payload.promptMode || payload.customPrompt === undefined) return

		const existingPrompts = (getVscodeContext().getGlobalState("customModePrompts") ?? {}) as Record<
			string,
			{ [key: string]: unknown }
		>
		const updatedPrompts = { ...existingPrompts, [payload.promptMode]: payload.customPrompt }
		await getVscodeContext().updateGlobalState("customModePrompts", updatedPrompts)
		const hasOpenedModeSelector = (getSettingsAccess().getValue(
			"hasOpenedModeSelector" as keyof JabberwockSettings,
		) ?? false) as boolean
		const stateWithPrompts = {
			...ctx.rootStore,
			customModePrompts: updatedPrompts,
			hasOpenedModeSelector,
		} as WebviewStatePayload
		provider.postMessageToWebview({ type: "state", state: stateWithPrompts })

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

	// ── updateSystemPromptTemplate ────────────────────────────────────
	bus.register(IntentType.SettingsPromptSystemTemplateUpdate, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as {
			systemPromptTemplateKey: string
			systemPromptTemplate?: string
		}
		if (payload.systemPromptTemplateKey === undefined) return

		const existingTemplates = (getVscodeContext().getGlobalState("systemPromptTemplates") ?? {}) as Record<
			string,
			string
		>
		const updatedTemplates = { ...existingTemplates }

		if (payload.systemPromptTemplate === undefined || payload.systemPromptTemplate === "") {
			delete updatedTemplates[payload.systemPromptTemplateKey]
		} else {
			updatedTemplates[payload.systemPromptTemplateKey] = payload.systemPromptTemplate
		}

		await getVscodeContext().updateGlobalState("systemPromptTemplates", updatedTemplates)
		const hasOpenedModeSelector = (getSettingsAccess().getValue(
			"hasOpenedModeSelector" as keyof JabberwockSettings,
		) ?? false) as boolean
		const stateWithTemplates = {
			...ctx.rootStore,
			systemPromptTemplates: updatedTemplates,
			hasOpenedModeSelector,
		} as WebviewStatePayload
		provider.postMessageToWebview({ type: "state", state: stateWithTemplates })
	})

	// ── getSystemPrompt ───────────────────────────────────────────────
	bus.register(IntentType.SettingsPromptSystemGet, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { mode?: string }

		try {
			const systemPrompt = await generateSystemPrompt(provider, payload as WebviewMessage)

			await provider.postMessageToWebview({
				type: "systemPrompt",
				text: systemPrompt,
				mode: payload.mode,
			})
		} catch (error) {
			EventBridge.outputChannel?.appendLine(
				`Error getting system prompt: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
			vscode.window.showErrorMessage(t("common:errors.get_system_prompt"))
		}
	})

	// ── copySystemPrompt ──────────────────────────────────────────────
	bus.register(IntentType.SettingsPromptSystemCopy, async (intent, ctx) => {
		const payload = intent.payload as { mode?: string }

		try {
			const provider = ctx.provider
			if (!provider) return

			const systemPrompt = await generateSystemPrompt(provider, payload as WebviewMessage)

			await vscode.env.clipboard.writeText(systemPrompt)
			await vscode.window.showInformationMessage(t("common:info.clipboard_copy"))
		} catch (error) {
			EventBridge.outputChannel?.appendLine(
				`Error getting system prompt: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
			vscode.window.showErrorMessage(t("common:errors.get_system_prompt"))
		}
	})

	// ── customInstructions ────────────────────────────────────────────
	bus.register(IntentType.SettingsInstructionsCustomUpdate, async (intent) => {
		const payload = intent.payload as { text: string }
		await getVscodeContext().updateGlobalState("customInstructions", payload.text)
	})
}

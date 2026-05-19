import type { EventBridge } from "../../../core/webview/EventBridge"
import type { WebviewMessage } from "@jabberwock/types"
import { generateSystemPrompt } from "../../../core/webview/generateSystemPrompt"
import { TelemetryService, getTelemetryService, hasTelemetryService } from "@jabberwock/telemetry"
import { t } from "../../../i18n"
import * as vscode from "vscode"
import { getState } from "../../storeSingleton"

export type HandlerFn = (provider: EventBridge, message: WebviewMessage) => Promise<void>

export const handlerMap: Record<string, HandlerFn> = {
	updatePrompt: async (provider, message) => {
		if (message.promptMode && message.customPrompt !== undefined) {
			const existingPrompts = provider.contextProxy.getGlobalState("customModePrompts") ?? {}
			const updatedPrompts = { ...existingPrompts, [message.promptMode]: message.customPrompt }
			await provider.updateGlobalState("customModePrompts", updatedPrompts)
			const currentState = getState(provider)
			const hasOpenedModeSelector = provider.contextProxy?.getValue?.("hasOpenedModeSelector") ?? false
			const stateWithPrompts = {
				...currentState,
				customModePrompts: updatedPrompts,
				hasOpenedModeSelector,
			} as Record<string, unknown>
			provider.postMessageToWebview({ type: "state", state: stateWithPrompts })

			if (hasTelemetryService()) {
				const oldPrompt = existingPrompts[message.promptMode] || {}
				const newPrompt = message.customPrompt
				const changedSettings = Object.keys(newPrompt).filter(
					(key) =>
						JSON.stringify((oldPrompt as Record<string, unknown>)[key]) !==
						JSON.stringify((newPrompt as Record<string, unknown>)[key]),
				)

				if (changedSettings.length > 0) {
					getTelemetryService().captureModeSettingChanged(changedSettings[0])
				}
			}
		}
	},

	updateSystemPromptTemplate: async (provider, message) => {
		if (message.systemPromptTemplateKey !== undefined) {
			const existingTemplates = provider.contextProxy.getGlobalState("systemPromptTemplates") ?? {}
			const updatedTemplates = { ...existingTemplates }

			if (message.systemPromptTemplate === undefined || message.systemPromptTemplate === "") {
				delete updatedTemplates[message.systemPromptTemplateKey]
			} else {
				updatedTemplates[message.systemPromptTemplateKey] = message.systemPromptTemplate
			}

			await provider.updateGlobalState("systemPromptTemplates", updatedTemplates)
			const currentState = getState(provider)
			const hasOpenedModeSelector = provider.contextProxy?.getValue?.("hasOpenedModeSelector") ?? false
			const stateWithTemplates = {
				...currentState,
				systemPromptTemplates: updatedTemplates,
				hasOpenedModeSelector,
			} as Record<string, unknown>
			provider.postMessageToWebview({ type: "state", state: stateWithTemplates })
		}
	},

	getSystemPrompt: async (provider, message) => {
		try {
			const systemPrompt = await generateSystemPrompt(provider, message)

			await provider.postMessageToWebview({
				type: "systemPrompt",
				text: systemPrompt,
				mode: message.mode,
			})
		} catch (error) {
			provider.log(`Error getting system prompt:  ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)
			vscode.window.showErrorMessage(t("common:errors.get_system_prompt"))
		}
	},

	copySystemPrompt: async (provider, message) => {
		try {
			const systemPrompt = await generateSystemPrompt(provider, message)

			await vscode.env.clipboard.writeText(systemPrompt)
			await vscode.window.showInformationMessage(t("common:info.clipboard_copy"))
		} catch (error) {
			provider.log(`Error getting system prompt:  ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)
			vscode.window.showErrorMessage(t("common:errors.get_system_prompt"))
		}
	},

	customInstructions: async (provider, message) => {
		await provider.updateGlobalState("customInstructions", message.text)
	},
}

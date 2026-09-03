import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import type { IBackendRootStore } from "@features/store"
import { getHostEnvironment } from "@features/foundation/host-context/context"
import { log as backendLog } from "@features/foundation/capabilities/backend-logger"
import { openAiCodexOAuthManager } from "@integrations/openai-codex/oauth"
import { fetchOpenAiCodexRateLimitInfo } from "@integrations/openai-codex/rate-limits"
import { generateErrorDiagnostics } from "@features/settings/handlers/lifecycle/on-diagnostics"
import type { ErrorDiagnosticsValues } from "@features/settings/handlers/lifecycle/on-diagnostics"
import { openDebugHistoryFile } from "./debug-utils"

export function registerSettingsDebug(bus: IntentBus): void {
	bus.register(IntentType.SettingsTextareaTextInsert, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) {
			return
		}
		const payload = intent.payload as { text: string }
		if (payload.text) {
			await provider.postMessageToWebview({
				type: "insertTextIntoTextarea",
				text: payload.text,
			})
		}
	})

	bus.register(IntentType.SettingsOpenaiCodexRateLimits, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) {
			return
		}

		try {
			const accessToken = await openAiCodexOAuthManager.getAccessToken()
			if (!accessToken) {
				provider.postMessageToWebview({
					type: "openAiCodexRateLimits",
					error: "Not authenticated with OpenAI Codex",
				})
				return
			}

			const accountId = await openAiCodexOAuthManager.getAccountId()
			const rateLimits = await fetchOpenAiCodexRateLimitInfo(accessToken, { accountId })

			provider.postMessageToWebview({
				type: "openAiCodexRateLimits",
				values: rateLimits,
			})
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			backendLog.info(`Error fetching OpenAI Codex rate limits: ${errorMessage}`)
			provider.postMessageToWebview({
				type: "openAiCodexRateLimits",
				error: errorMessage,
			})
		}
	})

	bus.register(IntentType.SettingsDebugApiHistoryOpen, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) {
			return
		}
		const currentTask = (ctx.rootStore as IBackendRootStore).chat.activeTask
		if (!currentTask) {
			publishNotificationError("No active task to view history for")
			return
		}

		try {
			const globalStoragePath = getHostEnvironment().globalStorageUri.fsPath
			await openDebugHistoryFile(
				currentTask.taskId,
				globalStoragePath,
				"api_conversation_history.json",
				"debug-api",
			)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			backendLog.info(`Error opening debug history: ${errorMessage}`)
			publishNotificationError(`Failed to open debug history: ${errorMessage}`)
		}
	})

	bus.register(IntentType.SettingsDebugUiHistoryOpen, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) {
			return
		}
		const currentTask = (ctx.rootStore as IBackendRootStore).chat.activeTask
		if (!currentTask) {
			publishNotificationError("No active task to view history for")
			return
		}

		try {
			const globalStoragePath = getHostEnvironment().globalStorageUri.fsPath
			await openDebugHistoryFile(currentTask.taskId, globalStoragePath, "ui_messages.json", "debug-ui")
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			backendLog.info(`Error opening debug history: ${errorMessage}`)
			publishNotificationError(`Failed to open debug history: ${errorMessage}`)
		}
	})

	bus.register(IntentType.SettingsDiagnosticsDownload, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) {
			return
		}
		const payload = intent.payload as { values: unknown }
		const currentTask = (ctx.rootStore as IBackendRootStore).chat.activeTask
		if (!currentTask) {
			publishNotificationError("No active task to generate diagnostics for")
			return
		}

		await generateErrorDiagnostics({
			taskId: currentTask.taskId,
			globalStoragePath: getHostEnvironment().globalStorageUri.fsPath,
			values: payload.values as ErrorDiagnosticsValues | undefined,
			log: (msg: string) => backendLog.info(msg),
		})
	})
}

import { publishNotificationError } from "@features/foundation/capabilities/notifications"

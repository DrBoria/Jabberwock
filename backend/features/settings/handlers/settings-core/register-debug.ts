import * as os from "os"
import type { IntentBus } from "@features/intents"
import * as path from "path"
import * as fs from "fs/promises"
import { getHostContext } from "@features/foundation"
import { getTelemetryService, hasTelemetryService } from "@jabberwock/telemetry"
import type { TelemetrySetting } from "@jabberwock/types"
import { getTaskDirectoryPath } from "@utils/io"
import { fileExistsAtPath } from "@utils/io/fs"

import { IntentType } from "@jabberwock/types"
import type { IBackendRootStore } from "@features/store"
import { getHostEnvironment } from "@features/foundation"
import { log as backendLog } from "@features/foundation"
import { openAiCodexOAuthManager } from "@integrations/openai-codex"
import { fetchOpenAiCodexRateLimitInfo } from "@integrations/openai-codex/rate-limits"
import { generateErrorDiagnostics } from "@features/settings"
import { sendInsertTextIntoTextarea, sendOpenAiCodexRateLimits } from "@features/settings"
import type { ErrorDiagnosticsValues } from "@features/settings"
import { publishNotificationError } from "@features/foundation"

function registerDebugSettingsTextareaTextInsert(bus: IntentBus): void {
	bus.register(IntentType.SettingsTextareaTextInsert, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) {
			return
		}
		const payload = intent.payload as { text: string }
		if (payload.text) {
			await sendInsertTextIntoTextarea(provider, payload.text)
		}
	})
}

function registerDebugSettingsOpenaiCodexRateLimits(bus: IntentBus): void {
	bus.register(IntentType.SettingsOpenaiCodexRateLimits, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) {
			return
		}

		try {
			const accessToken = await openAiCodexOAuthManager.getAccessToken()
			if (!accessToken) {
				sendOpenAiCodexRateLimits(provider, { error: "Not authenticated with OpenAI Codex" })
				return
			}

			const accountId = await openAiCodexOAuthManager.getAccountId()
			const rateLimits = await fetchOpenAiCodexRateLimitInfo(accessToken, { accountId })

			sendOpenAiCodexRateLimits(provider, { values: rateLimits })
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			backendLog.info(`Error fetching OpenAI Codex rate limits: ${errorMessage}`)
			sendOpenAiCodexRateLimits(provider, { error: errorMessage })
		}
	})
}

function registerDebugSettingsDebugApiHistoryOpen(bus: IntentBus): void {
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
}

function registerDebugSettingsDebugUiHistoryOpen(bus: IntentBus): void {
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
}

function registerDebugSettingsDiagnosticsDownload(bus: IntentBus): void {
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

export function registerDebug(_bus: IntentBus): void {
	registerDebugSettingsTextareaTextInsert(_bus)
	registerDebugSettingsOpenaiCodexRateLimits(_bus)
	registerDebugSettingsDebugApiHistoryOpen(_bus)
	registerDebugSettingsDebugUiHistoryOpen(_bus)
	registerDebugSettingsDiagnosticsDownload(_bus)
}

export function captureTelemetryChange(
	wasOptedIn: boolean,
	isOptedIn: boolean,
	previousSetting: TelemetrySetting,
	currentSetting: TelemetrySetting,
): void {
	if (!hasTelemetryService()) {
		return
	}
	if (wasOptedIn && !isOptedIn) {
		getTelemetryService().captureTelemetrySettingsChanged(previousSetting, currentSetting)
	}
	if (!wasOptedIn && isOptedIn) {
		getTelemetryService().captureTelemetrySettingsChanged(previousSetting, currentSetting)
	}
}

export async function openDebugHistoryFile(
	taskId: string,
	globalStoragePath: string,
	fileName: string,
	prefix: string,
): Promise<void> {
	const taskDirPath = await getTaskDirectoryPath(globalStoragePath, taskId)
	const sourceFilePath = path.join(taskDirPath, fileName)

	if (!(await fileExistsAtPath(sourceFilePath))) {
		publishNotificationError(`File not found: ${fileName}`)
		return
	}

	const content = await fs.readFile(sourceFilePath, "utf8")
	let jsonContent: unknown

	try {
		jsonContent = JSON.parse(content)
	} catch {
		publishNotificationError(`Failed to parse ${fileName}`)
		return
	}

	const prettifiedContent = JSON.stringify(jsonContent, null, 2)

	const tmpDir = os.tmpdir()
	const timestamp = Date.now()
	const tempFileName = `jabberwock-${prefix}-${taskId.slice(0, 8)}-${timestamp}.json`
	const tempFilePath = path.join(tmpDir, tempFileName)

	await fs.writeFile(tempFilePath, prettifiedContent, "utf8")

	// D4g-2 (batch 3): open the temp file in the host editor via the hostCommands slot (D4g-pre) —
	// server mode has no host editor, so this degrades to a no-op.
	getHostContext()?.hostCommands?.openFileInEditor?.(tempFilePath, { preview: true })
}

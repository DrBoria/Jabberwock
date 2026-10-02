import { createTelemetryService } from "@jabberwock/telemetry"

import { Package } from "@shared/core/package"
import { getStore } from "@features/singleton"
import { getHostContext } from "@features/foundation"
import { getIntentBus } from "@features/store"
import { registerOnTaskIntents } from "@features/chat"
import { registerOnMessagesIntents } from "@features/chat"
import { registerOnNotificationsIntents } from "@features/chat"
import { registerOnSettingsIntents } from "@features/settings"
import { registerOnWindowManagerIntents } from "@features/foundation"
import { registerOnContextManagementIntents } from "@features/foundation"
import { registerOnCloudIntents } from "@features/cloud"
import { registerOnHistoryIntents } from "@features/hist"
import { registerOnMarketplaceIntents } from "@features/marketplace"
import { EventBridge } from "@features/foundation"

export async function setupIntentBus(
	provider: EventBridge,
	telemetryService: ReturnType<typeof createTelemetryService>,
): Promise<void> {
	const intentsBus = getIntentBus()
	if (!intentsBus) {
		console.warn("[extension] IntentBus not available — handlers not registered")
		return
	}

	registerOnTaskIntents(intentsBus)
	registerOnMessagesIntents(intentsBus)
	registerOnNotificationsIntents(intentsBus)
	registerOnSettingsIntents(intentsBus)
	registerOnWindowManagerIntents(intentsBus)
	registerOnContextManagementIntents(intentsBus)
	registerOnCloudIntents(intentsBus)
	registerOnHistoryIntents(intentsBus)
	registerOnMarketplaceIntents(intentsBus)
	intentsBus.setProvider(provider)

	telemetryService.setProvider({
		getTelemetryProperties: async () => {
			const hostContext = getHostContext()
			const store = getStore()
			let mode = "ask"
			if (store !== undefined) {
				const activeTask = store.chat.activeTask
				if (activeTask !== undefined && activeTask.taskMode !== undefined) {
					mode = activeTask.taskMode
				}
			}

			return {
				appName: Package.name,
				appVersion: Package.version,
				vscodeVersion: hostContext?.extensionVersion ?? "unknown",
				platform: process.platform,
				editorName: "vscode",
				hostname: process.env.HOSTNAME ?? undefined,
				language: hostContext?.language ?? "en",
				mode,
			}
		},
	})

	console.log("[extension] IntentBus handlers registered")
}

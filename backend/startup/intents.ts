import { createTelemetryService } from "@jabberwock/telemetry"

import { Package } from "@shared/package"
import { getBackendRootStore } from "@features/storeSingleton"
import { getHostContext } from "@features/foundation/host-context/context"
import { getIntentBus } from "@features/store"
import { registerOnTaskIntents } from "@features/chat/task/events/handlers/index.ts"
import { registerOnMessagesIntents } from "@features/chat/task/messages/events/handlers/index.ts"
import { registerOnNotificationsIntents } from "@features/chat/task/notifications/events/handlers/index.ts"
import { registerOnSettingsIntents } from "@features/settings/events/handlers/index.ts"
import { registerOnWindowManagerIntents } from "@features/foundation/window-manager/events/handlers/index.ts"
import { registerOnContextManagementIntents } from "@features/foundation/time-machine/file-context/events/handlers/index.ts"
import { registerOnCloudIntents } from "@features/cloud/events/handlers/index.ts"
import { registerOnHistoryIntents } from "@features/hist/events/handlers/index.ts"
import { registerOnMarketplaceIntents } from "@features/marketplace/events/handlers/index.ts"
import { EventBridge } from "@features/foundation/webview/EventBridge"

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
			const store = getBackendRootStore()
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

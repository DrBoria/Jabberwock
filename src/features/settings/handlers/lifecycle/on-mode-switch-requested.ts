import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import { handleModeSwitch } from "@features/foundation/window-manager/store"

/**
 * Handles topic.mode.switch.requested intent — switches the active mode.
 * Also handles the "switchMode" alias from the webview.
 * Migrated from chat/topic/handlers/on-mode-switch-requested.ts
 */
export function registerOnTopicModeSwitchRequested(bus: IntentBus): void {
	bus.register(IntentType.TopicModeSwitchRequested, async (intent, ctx) => {
		const provider = ctx.provider
		const { mode } = intent.payload as { mode: string }

		if (!provider || !mode) {
			return
		}

		await handleModeSwitch(provider, mode)
	})
}

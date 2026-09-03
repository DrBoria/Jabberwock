import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import { setTtsEnabled } from "@utils/token/tts"
import { getHostEnvironment } from "@features/foundation/host-context/context"
import { postStateToWebview } from "@features/foundation/window-manager/store"

/**
 * Handles notification.tts.enabled.set intent — enables/disables TTS.
 */
export function registerOnTtsEnabledSet(bus: IntentBus): void {
	bus.register(IntentType.NotificationTtsEnabledSet, async (intent, ctx) => {
		const provider = ctx.provider
		const { enabled } = intent.payload as { enabled: boolean }

		if (!provider) {
			return
		}

		await getHostEnvironment().updateGlobalState("ttsEnabled", enabled)
		setTtsEnabled(enabled)
		await postStateToWebview(provider)
	})
}

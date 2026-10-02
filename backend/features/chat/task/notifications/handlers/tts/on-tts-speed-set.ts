import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents"
import { setTtsSpeed } from "@utils/token/tts"
import { getHostEnvironment } from "@features/foundation"
import { postStateToWebview } from "@features/foundation"

/**
 * Handles notification.tts.speed.set intent — sets TTS playback speed.
 */
export function registerOnTtsSpeedSet(bus: IntentBus): void {
	bus.register(IntentType.NotificationTtsSpeedSet, async (intent, ctx) => {
		const provider = ctx.provider
		const { value } = intent.payload as { value: number }

		if (!provider) {
			return
		}

		await getHostEnvironment().updateGlobalState("ttsSpeed", value)
		setTtsSpeed(value)
		await postStateToWebview(provider)
	})
}

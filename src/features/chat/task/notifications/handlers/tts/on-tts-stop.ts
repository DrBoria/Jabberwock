import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import { stopTts } from "@utils/token/tts"

/**
 * Handles notification.tts.stop intent — stops text-to-speech playback.
 */
export function registerOnTtsStop(bus: IntentBus): void {
	bus.register(IntentType.NotificationTtsStop, async (_intent, _ctx) => {
		stopTts()
	})
}

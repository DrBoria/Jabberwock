import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents"
import { playTts } from "@utils/token/tts"
import { sendTtsStart, sendTtsStop } from "@features/chat"

/**
 * Handles notification.tts.play intent — plays text-to-speech.
 */
export function registerOnTtsPlay(bus: IntentBus): void {
	bus.register(IntentType.NotificationTtsPlay, async (intent, ctx) => {
		const provider = ctx.provider
		const { text } = intent.payload as { text: string }

		if (!provider || !text) {
			return
		}

		playTts(text, {
			onStart: () => sendTtsStart(provider, text),
			onStop: () => sendTtsStop(provider, text),
		})
	})
}

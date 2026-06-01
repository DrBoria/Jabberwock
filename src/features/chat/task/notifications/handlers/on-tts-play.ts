import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "../../../../intents/bus"
import { playTts } from "../../../../../utils/tts"

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
			onStart: () => provider.postMessageToWebview({ type: "ttsStart", text }),
			onStop: () => provider.postMessageToWebview({ type: "ttsStop", text }),
		})
	})
}

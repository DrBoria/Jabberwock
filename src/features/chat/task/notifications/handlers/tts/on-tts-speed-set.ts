import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import { setTtsSpeed } from "@utils/token/tts"
import { getVscodeContext } from "@features/foundation/vscode/context"
import { postStateToWebview } from "@features/foundation/window-manager/store"

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

		await getVscodeContext().updateGlobalState("ttsSpeed", value)
		setTtsSpeed(value)
		await postStateToWebview(provider)
	})
}

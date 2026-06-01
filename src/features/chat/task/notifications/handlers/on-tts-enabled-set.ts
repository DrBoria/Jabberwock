import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "../../../../intents/bus"
import { setTtsEnabled } from "../../../../../utils/tts"
import { getVscodeContext } from "../../../../foundation/vscode/context"
import { postStateToWebview } from "../../../../foundation/window-manager/store"

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

		await getVscodeContext().updateGlobalState("ttsEnabled", enabled)
		setTtsEnabled(enabled)
		await postStateToWebview(provider)
	})
}

import type { IntentBus } from "@features/intents"
import { BackendIntentType } from "@intentConstants"
import { postStateToWebview } from "@features/foundation"

/**
 * Handles settings.opened intent — triggers settings view refresh.
 */
export function registerOnSettingsOpened(bus: IntentBus): void {
	bus.register(BackendIntentType.SettingsOpened, async (_intent, ctx) => {
		// Settings opened — refresh webview state
		if (ctx.provider) {
			await postStateToWebview(ctx.provider)
		}
	})
}

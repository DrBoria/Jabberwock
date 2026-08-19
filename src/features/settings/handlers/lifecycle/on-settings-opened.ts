import type { IntentBus } from "@features/intents/bus"
import { BackendIntentType } from "@intentConstants"
import { postStateToWebview } from "@features/foundation/window-manager/store"

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

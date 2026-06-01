import type { IntentBus } from "../../intents/bus"

/**
 * Handles settings.opened intent — triggers settings view refresh.
 */
import { BackendIntentType } from "@intentConstants"

export function registerOnSettingsOpened(bus: IntentBus): void {
	bus.register(BackendIntentType.SettingsOpened, async (_intent, ctx) => {
		const { postStateToWebview } = await import("../../foundation/window-manager/store")
		// Settings opened — refresh webview state
		if (ctx.provider) {
			await postStateToWebview(ctx.provider)
		}
	})
}

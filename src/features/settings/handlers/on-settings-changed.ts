import { BackendIntentType } from "@intentConstants"
import type { IntentBus } from "../../intents/bus"

/**
 * Handles settings.changed intent — persists settings changes.
 */
export function registerOnSettingsChanged(bus: IntentBus): void {
	bus.register(BackendIntentType.SettingsChanged, async (intent, ctx) => {
		const { key, value } = intent.payload as {
			key: string
			value: unknown
		}

		// Persist settings change — the ContextProxy handles actual storage.
		// MST's onSnapshot already persists through ContextProxy, so this
		// handler is a future hook for additional side effects.
		console.log(`[onSettingsChanged] ${key} changed`)
	})
}

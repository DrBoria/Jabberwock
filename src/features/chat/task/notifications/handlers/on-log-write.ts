import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "../../../../intents/bus"

/**
 * Handles log.write intent — writes a log message to console and diagnostics.
 *
 * Action creators like ask() emit this intent to decouple logging from
 * notification creation.
 */
export function registerOnLogWrite(bus: IntentBus): void {
	bus.register(IntentType.LogWrite, async (intent) => {
		const { message, level } = intent.payload as {
			message: string
			level: string
		}

		switch (level) {
			case "warn":
				console.warn(message)
				break
			case "error":
				console.error(message)
				break
			default: {
				console.log(message)
				// Forward info-level logs to diagnostics
				const { diagnosticsManager } = await import("@jabberwock/devtool")
				diagnosticsManager.log(message, "info")
				break
			}
		}
	})
}

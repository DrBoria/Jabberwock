import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"

/**
 * Handles log.write intent — writes a log message to console and diagnostics.
 *
 * Action creators like ask() emit this intent to decouple logging from
 * notification creation.
 */
import { diagnosticsManager } from "@jabberwock/devtool"

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
				diagnosticsManager.log(message, "info")
				break
			}
		}
	})
}

import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"

/**
 * Handles script.finished intent — triggered when a terminal script completes.
 */
export function registerOnScriptFinished(bus: IntentBus): void {
	bus.register(IntentType.ScriptFinished, async (intent, _ctx) => {
		const { taskId, exitCode } = intent.payload as {
			taskId: string
			exitCode: number
			output: string
		}

		// Currently a no-op — script results flow through the stream pipeline.
		// Future: route terminal output back into the API conversation.
		console.log(`[onScriptFinished] Task ${taskId} exited with code ${exitCode}`)
	})
}

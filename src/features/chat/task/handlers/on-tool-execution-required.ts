import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"

/**
 * Handles tool.execution.required intent — executes a tool call from the assistant.
 * Delegates to the existing executeTools pipeline which processes the assistant's
 * tool_use blocks from the streaming content.
 */
import { executeTools } from "@features/chat/tools/actions/executeTools"

export function registerOnToolExecutionRequired(bus: IntentBus): void {
	bus.register(IntentType.ToolExecutionRequired, async (intent, _ctx) => {
		const { taskId } = intent.payload as {
			taskId: string
			toolName: string
			toolArgs: { [key: string]: unknown }
		}

		await executeTools(taskId, "")
	})
}

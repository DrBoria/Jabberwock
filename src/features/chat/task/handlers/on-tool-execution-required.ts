import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "../../../intents/bus"

/**
 * Handles tool.execution.required intent — executes a tool call from the assistant.
 * Delegates to the existing executeTools pipeline which processes the assistant's
 * tool_use blocks from the streaming content.
 */
export function registerOnToolExecutionRequired(bus: IntentBus): void {
	bus.register(IntentType.ToolExecutionRequired, async (intent, _ctx) => {
		const { taskId } = intent.payload as {
			taskId: string
			toolName: string
			toolArgs: { [key: string]: unknown }
		}

		// The tool execution is handled by the existing pipeline (executeTools).
		// This handler is a placeholder for future intent-driven execution.
		// The executeTools function reads tool_use blocks from task.assistantMessageContent.
		const { executeTools } = await import("../../tools/actions/executeTools")
		await executeTools(taskId, "")
	})
}

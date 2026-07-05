import { BackendIntentType } from "@intentConstants"
import type { IntentBus } from "@features/intents/bus"

/**
 * Handles MCP tool result — processes tool execution result and
 * prepares the next API request with the tool output.
 */
export function registerOnMcpToolResult(bus: IntentBus): void {
	bus.register(BackendIntentType.McpToolResult, async (intent, ctx) => {
		const { taskId, result, isError } = intent.payload as {
			taskId: string
			toolName: string
			result: string
			isError?: boolean
		}

		const store = ctx.rootStore.chat.tasks.get(taskId)
		if (!store) {
			console.error(`[onMcpToolResult] Task ${taskId} not found`)
			return
		}

		// Add tool result as a notification
		store.notifications.addNotification({
			ts: Date.now(),
			type: "say",
			say: isError ? "error" : "tool",
			text: result,
		})
	})
}

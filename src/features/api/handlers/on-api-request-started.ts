/**
 * Handler for STREAMING_STARTED intent.
 *
 * Lightweight handler that creates an AgentMessage(text: "") in MST
 * and snapshots to frontend. The actual streaming orchestration happens
 * in the UserMessageReceived handler which calls handleStream().
 *
 * handleStream() internally dispatches STREAMING_STARTED as a side-effect
 * notification — this handler reacts to it by setting up the MST entry.
 */
import type { IntentBus } from "@features/intents/bus"
import { IntentConstants } from "@intentConstants"

export function registerOnApiRequestStarted(bus: IntentBus): void {
	bus.register(IntentConstants.api.STREAMING_STARTED, async (intent, ctx) => {
		const { taskId, modelId } = intent.payload as {
			taskId: string
			modelId?: string
		}

		if (!taskId) {
			console.error(`[ApiRequestStart] STREAMING_STARTED intent missing taskId`)
			return
		}

		const taskModel = ctx.rootStore.chat.tasks.get(taskId)
		if (!taskModel) {
			console.error(`[ApiRequestStart] Task ${taskId} not found`)
			return
		}

		// Create AgentMessage(text: "") in MST to give the frontend a placeholder
		// This message will be finalized when the stream completes
		console.log(`[ApiRequestStart] Stream started for task ${taskId}${modelId ? ` (model: ${modelId})` : ""}`)

		// TODO: Create AgentMessage(text: "") in MST store
		// taskModel.addAssistantMessage({ text: "", partial: true })
	})
}

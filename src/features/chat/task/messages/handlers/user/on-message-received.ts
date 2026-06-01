import { Anthropic } from "@anthropic-ai/sdk"
import { IntentType, IntentStatus } from "@jabberwock/types"
import type { IntentBus } from "../../../../../intents/bus"

/**
 * Handles user.message.received intent — triggers the API request pipeline
 * when a user message arrives.
 */
export function registerOnUserMessageReceived(bus: IntentBus): void {
	bus.register(IntentType.UserMessageReceived, async (intent, ctx) => {
		const { taskId, text, images, content } = intent.payload as {
			taskId: string
			text?: string
			images?: string[]
			content?: Anthropic.Messages.ContentBlockParam[]
		}

		try {
			const { getTask } = await import("../../../../task/actions/taskRegistry")
			const task = getTask(taskId)
			if (!task) {
				console.error(`[UserMessageReceived] Task ${taskId} not found in registry`)
				return
			}

			const { getBackendRootStore } = await import("@features/storeSingleton")
			const store = getBackendRootStore()
			const taskModel = store.chat.tasks.get(taskId)

			if (!taskModel || taskModel.isProcessing || store.chat.abort) {
				return
			}

			taskModel.setIsProcessing(true)

			let userContent: Anthropic.Messages.ContentBlockParam[]

			if (content && content.length > 0) {
				// Direct content blocks from tool-result continuation
				userContent = content
			} else if (text || (images && images.length > 0)) {
				// Text/images from intent payload (initial user message)
				userContent = []
				if (text) {
					userContent.push({ type: "text" as const, text })
				}
				if (images && images.length > 0) {
					for (const image of images) {
						userContent.push({
							type: "image" as const,
							source: { type: "base64" as const, media_type: "image/png" as const, data: image },
						})
					}
				}
			} else {
				// No content in intent payload — nothing to process
				taskModel.setIsProcessing(false)
				return
			}

			const { prepareApiRequest } = await import("../../../../../api/handlers/helpers/prepareApiRequest")
			const { handleStream } = await import("../../../../../api/handlers/helpers/handleStream")
			const { finalizeToolCalls } = await import("../../../../tools/actions/finalizeToolCalls")
			const { executeTools } = await import("../../../../tools/actions/executeTools")

			const apiCtx = await prepareApiRequest(task.taskId, userContent, true, 0, false)

			const result = await handleStream(apiCtx)
			if (!result) {
				// Stream aborted / retry needed — handleStream creates the retry intent
				taskModel.setIsProcessing(false)
				return
			}

			await finalizeToolCalls(apiCtx.taskId, result)
			await executeTools(apiCtx.taskId, result.assistantMessage)

			taskModel.setIsProcessing(false)
		} catch (err) {
			console.error(`[UserMessageReceived] Error processing task:`, err)
			ctx.intentStore.createIntent({
				id: crypto.randomUUID(),
				type: IntentType.SystemFailure,
				payload: { taskId, error: String(err) },
				status: IntentStatus.Queued,
				createdAt: Date.now(),
			})
			// Ensure isProcessing is reset even on error
			const taskModel = ctx.rootStore.chat.tasks.get(taskId)
			if (taskModel) {
				taskModel.setIsProcessing(false)
			}
		}
	})
}

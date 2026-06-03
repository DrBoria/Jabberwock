import { Anthropic } from "@anthropic-ai/sdk"
import { IntentType, IntentStatus } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"

/**
 * Handles user.message.received intent — triggers the API request pipeline
 * when a user message arrives.
 */
import { getTask } from "@features/chat/task/actions/taskRegistry"
import { getBackendRootStore } from "@features/storeSingleton"
import { prepareApiRequest } from "@features/api/handlers/helpers/prepareApiRequest"
import { handleStream } from "@features/api/handlers/helpers/handleStream"
import { finalizeToolCalls } from "@features/chat/tools/actions/finalizeToolCalls"
import { executeTools } from "@features/chat/tools/actions/executeTools"

export function registerOnUserMessageReceived(bus: IntentBus): void {
	bus.register(IntentType.UserMessageReceived, async (intent, ctx) => {
		const { taskId, text, images, content } = intent.payload as {
			taskId: string
			text?: string
			images?: string[]
			content?: Anthropic.Messages.ContentBlockParam[]
		}

		try {
			const task = getTask(taskId)
			if (!task) {
				console.error(`[UserMessageReceived] Task ${taskId} not found in registry`)
				return
			}

			const store = getBackendRootStore()
			const taskModel = store.chat.tasks.get(taskId)

			if (!taskModel || taskModel.isProcessing || store.chat.abort) {
				return
			}

			taskModel.setIsProcessing(true)

			let userContent: Anthropic.Messages.ContentBlockParam[]

			if (content && content.length > 0) {
				userContent = content
			} else if (text || (images && images.length > 0)) {
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
				taskModel.setIsProcessing(false)
				return
			}

			const apiCtx = await prepareApiRequest(task.taskId, userContent, true, 0, false)

			const result = await handleStream(apiCtx)
			if (!result) {
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
			const taskModel = ctx.rootStore.chat.tasks.get(taskId)
			if (taskModel) {
				taskModel.setIsProcessing(false)
			}
		}
	})
}

import { Anthropic } from "@anthropic-ai/sdk"
import { IntentType, IntentStatus } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"

/**
 * Handles user.message.received intent — triggers the API request pipeline
 * when a user message arrives.
 */
import { getTask } from "@features/chat/task/actions/taskRegistry"
import { getBackendRootStore } from "@features/storeSingleton"
import { prepareApiRequest } from "@features/api/handlers/helpers/prepare/prepareApiRequest"
import { handleStream } from "@features/api/handlers/helpers/process/handleStream"
import { finalizeToolCalls } from "@features/chat/tools/actions/finalizeToolCalls"
import { executeTools } from "@features/chat/tools/actions/executeTools"

function buildUserContent(
	content: Anthropic.Messages.ContentBlockParam[] | undefined,
	text: string | undefined,
	images: string[] | undefined,
): Anthropic.Messages.ContentBlockParam[] | undefined {
	if (content && content.length > 0) {
		return content
	}

	if (!text && !(images && images.length > 0)) {
		return undefined
	}

	const result: Anthropic.Messages.ContentBlockParam[] = []

	if (text) {
		result.push({ type: "text" as const, text })
	}

	if (images && images.length > 0) {
		for (const image of images) {
			result.push({
				type: "image" as const,
				source: { type: "base64" as const, media_type: "image/png" as const, data: image },
			})
		}
	}

	return result
}

import type { IIntentStore } from "@features/intents/store"

function handleProcessingError(ctx: { intentStore: IIntentStore }, taskId: string, err: unknown): void {
	console.error(`[UserMessageReceived] Error processing task:`, err)
	ctx.intentStore.createIntent({
		id: crypto.randomUUID(),
		type: IntentType.SystemFailure,
		payload: { taskId, error: String(err) },
		status: IntentStatus.Queued,
		createdAt: Date.now(),
	})
	const taskModel = getBackendRootStore().chat.tasks.get(taskId)
	if (taskModel) {
		taskModel.setIsProcessing(false)
	}
}

async function yieldAndProceed(
	scheduler: { yield(): Promise<void> } | undefined,
	intentStore: IIntentStore,
	intentId: string,
): Promise<boolean> {
	await scheduler?.yield()
	return intentStore.getById(intentId)?.status === IntentStatus.Processing
}

async function processUserMessage(
	intent: { id: string; payload: Record<string, unknown> },
	ctx: { scheduler?: { yield(): Promise<void> }; intentStore: IIntentStore },
): Promise<void> {
	const { taskId, text, images, content, retryAttempt } = intent.payload as {
		taskId: string
		text?: string
		images?: string[]
		content?: Anthropic.Messages.ContentBlockParam[]
		retryAttempt?: number
	}

	const store = getBackendRootStore()
	const taskModel = store.chat.tasks.get(taskId)
	const task = getTask(taskId)

	if (!taskModel || taskModel.isProcessing || store.chat.abort || !task) {
		return
	}

	taskModel.setIsProcessing(true)

	const userContent = buildUserContent(content, text, images)

	if (!userContent) {
		taskModel.setIsProcessing(false)
		return
	}

	// ── YIELD POINT #1: before prepareApiRequest ──
	if (!(await yieldAndProceed(ctx.scheduler, ctx.intentStore, intent.id))) return

	const apiCtx = await prepareApiRequest(task.taskId, userContent, true, retryAttempt, false)

	// ── YIELD POINT #2: before handleStream ──
	if (!(await yieldAndProceed(ctx.scheduler, ctx.intentStore, intent.id))) return

	const result = await handleStream(apiCtx)
	if (!result) {
		taskModel.setIsProcessing(false)
		return
	}

	// ── YIELD POINT #3: after stream, before finalize ──
	if (!(await yieldAndProceed(ctx.scheduler, ctx.intentStore, intent.id))) return

	await finalizeToolCalls(apiCtx.taskId, result)
	await executeTools(apiCtx.taskId, result.assistantMessage)
	taskModel.setIsProcessing(false)
}

export function registerOnUserMessageReceived(bus: IntentBus): void {
	bus.register(IntentType.UserMessageReceived, async (intent, ctx) => {
		try {
			await processUserMessage(intent, ctx)
		} catch (err) {
			const { taskId } = intent.payload as { taskId: string }
			handleProcessingError(ctx, taskId, err)
		}
	})
}

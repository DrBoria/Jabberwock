import type { ModelInfo, BedrockModelId } from "@jabberwock/types"
import type { ApiStreamChunk } from "@api/transform/stream"
import { logger } from "@utils/logging"
import type { StreamEvent, UsageType } from "@api/providers/bedrock/core/types"

import { handleContentBlockStart, handleContentBlockDelta } from "./bedrock-stream-content"

export interface StreamHandlerContext {
	parseArn: (
		arn: string,
		region?: string,
	) => {
		isValid: boolean
		region?: string
		modelType?: string
		modelId?: string
		errorMessage?: string
		crossRegionInference: boolean
	}
	getModelById: (modelId: string, modelType?: string) => { id: BedrockModelId | string; info: ModelInfo }
	setCostModelConfig: (config: { id: BedrockModelId | string; info: ModelInfo }) => void
}

export function* handleMetadataUsage(usage: UsageType): Generator<ApiStreamChunk> {
	const cacheReadTokens = usage.cacheReadInputTokens || usage.cacheReadInputTokenCount || 0
	const cacheWriteTokens = usage.cacheWriteInputTokens || usage.cacheWriteInputTokenCount || 0

	yield {
		type: "usage",
		inputTokens: usage.inputTokens || 0,
		outputTokens: usage.outputTokens || 0,
		cacheReadTokens,
		cacheWriteTokens,
	}
}

export function* yieldRouterUsage(
	routerUsage: NonNullable<NonNullable<StreamEvent["trace"]>["promptRouter"]>["usage"],
): Generator<ApiStreamChunk> {
	if (!routerUsage) return
	const cacheReadTokens = routerUsage.cacheReadTokens || routerUsage.cacheReadInputTokenCount || 0
	const cacheWriteTokens = routerUsage.cacheWriteTokens || routerUsage.cacheWriteInputTokenCount || 0

	yield {
		type: "usage",
		inputTokens: routerUsage.inputTokens || 0,
		outputTokens: routerUsage.outputTokens || 0,
		cacheReadTokens,
		cacheWriteTokens,
	}
}

export function* handleTracePromptRouterEvent(
	promptRouter: NonNullable<StreamEvent["trace"]>["promptRouter"],
	modelConfig: { id: BedrockModelId | string; info: ModelInfo },
	context: StreamHandlerContext,
): Generator<ApiStreamChunk> {
	if (!promptRouter) return
	try {
		const invokedArnInfo = context.parseArn(promptRouter.invokedModelId!)
		const invokedModel = context.getModelById(invokedArnInfo.modelId as string, invokedArnInfo.modelType)
		if (invokedModel) {
			invokedModel.id = modelConfig.id
			context.setCostModelConfig(invokedModel)
		}

		if (promptRouter.usage) {
			yield* yieldRouterUsage(promptRouter.usage)
		}
	} catch (error) {
		logger.error("Error handling Bedrock invokedModelId", {
			ctx: "bedrock",
			error: error instanceof Error ? error : String(error),
		})
	}
}

export function* handleStreamEvent(
	streamEvent: StreamEvent,
	modelConfig: { id: BedrockModelId | string; info: ModelInfo },
	context: StreamHandlerContext,
): Generator<ApiStreamChunk> {
	if (streamEvent.metadata?.usage) {
		yield* handleMetadataUsage(streamEvent.metadata.usage as UsageType)
		return
	}

	if (streamEvent?.trace?.promptRouter?.invokedModelId) {
		yield* handleTracePromptRouterEvent(streamEvent.trace.promptRouter, modelConfig, context)
		return
	}

	if (streamEvent.messageStart) {
		return
	}

	if (streamEvent.contentBlockStart) {
		yield* handleContentBlockStart(streamEvent.contentBlockStart)
		return
	}

	if (streamEvent.contentBlockDelta) {
		yield* handleContentBlockDelta(streamEvent.contentBlockDelta)
		return
	}
}

export function tryParseStreamEvent(chunk: unknown): StreamEvent | undefined {
	try {
		return typeof chunk === "string" ? (JSON.parse(chunk) as StreamEvent) : (chunk as StreamEvent)
	} catch (_e) {
		logger.error("Failed to parse stream event", {
			ctx: "bedrock",
			error: _e instanceof Error ? _e : String(_e),
			chunk: typeof chunk === "string" ? chunk : "binary data",
		})
		return undefined
	}
}

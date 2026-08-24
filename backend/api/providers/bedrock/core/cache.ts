import { Anthropic } from "@anthropic-ai/sdk"
import { Message, SystemContentBlock, ContentBlock } from "@aws-sdk/client-bedrock-runtime"
import { MultiPointStrategy } from "@api/transform/cache-strategy/multi-point-strategy"
import { ModelInfo as CacheModelInfo, CachePointPlacement } from "@api/transform/cache-strategy/types"
import { convertToBedrockConverseMessages as sharedConverter } from "@api/transform/format/bedrock-converse-format"
import type { ModelInfoWithCacheFields } from "./types"

function getNumberOr(modelInfo: Record<string, unknown> | undefined, key: string, fallback: number): number {
	if (!modelInfo) {
		return fallback
	}
	const val = modelInfo[key]
	return typeof val === "number" ? val : fallback
}

function getStringArrayOr(
	modelInfo: Record<string, unknown> | undefined,
	key: string,
	fallback: Array<"system" | "messages" | "tools">,
): Array<"system" | "messages" | "tools"> {
	if (!modelInfo) {
		return fallback
	}
	const val = modelInfo[key]
	return Array.isArray(val) ? (val as Array<"system" | "messages" | "tools">) : fallback
}

function buildCacheModelInfo(modelInfo: Record<string, unknown> | undefined): CacheModelInfo {
	return {
		maxTokens: getNumberOr(modelInfo, "maxTokens", 8192),
		contextWindow: getNumberOr(modelInfo, "contextWindow", 200_000),
		supportsPromptCache: getNumberOr(modelInfo, "supportsPromptCache", 0) === 1,
		maxCachePoints: getNumberOr(modelInfo, "maxCachePoints", 0),
		minTokensPerCachePoint: getNumberOr(modelInfo, "minTokensPerCachePoint", 50),
		cachableFields: getStringArrayOr(modelInfo, "cachableFields", []),
	}
}

function getCacheStrategyResult(
	modelInfo: Record<string, unknown> | undefined,
	systemMessage: string | undefined,
	anthropicMessages: Anthropic.Messages.MessageParam[] | { role: string; content: string }[],
	usePromptCache: boolean,
	conversationId: string | undefined,
	previousCachePointPlacements: Record<string, CachePointPlacement[]>,
): {
	system: SystemContentBlock[]
	messageCachePointPlacements?: CachePointPlacement[]
} {
	const cacheModelInfo = buildCacheModelInfo(modelInfo)

	const previousPlacements =
		conversationId && previousCachePointPlacements[conversationId]
			? previousCachePointPlacements[conversationId]
			: undefined

	const config = {
		modelInfo: cacheModelInfo,
		systemPrompt: systemMessage,
		messages: anthropicMessages as Anthropic.Messages.MessageParam[],
		usePromptCache,
		previousCachePointPlacements: previousPlacements,
	}

	const strategy = new MultiPointStrategy(config)
	return strategy.determineOptimalCachePoints()
}

export function supportsAwsPromptCache(modelConfig: {
	id: string
	info: { supportsPromptCache?: boolean }
}): boolean | undefined {
	if (!modelConfig?.info?.supportsPromptCache) return false
	const info = modelConfig.info as ModelInfoWithCacheFields
	const cachableFields = info.cachableFields
	return Array.isArray(cachableFields) && cachableFields.length > 0
}

export function removeCachePoints(content: unknown): unknown {
	if (Array.isArray(content)) {
		return content.map((block: Record<string, unknown>) => {
			const { cachePoint: _, ...rest } = block
			return rest
		})
	}

	return content
}

export function convertToBedrockConverseMessages(
	anthropicMessages: Anthropic.Messages.MessageParam[] | { role: string; content: string }[],
	systemMessage?: string,
	usePromptCache: boolean = false,
	modelInfo?: Record<string, unknown>,
	conversationId?: string,
	previousCachePointPlacements?: Record<string, CachePointPlacement[]>,
): { system: SystemContentBlock[]; messages: Message[] } {
	const convertedMessages = sharedConverter(anthropicMessages as Anthropic.Messages.MessageParam[])

	if (!usePromptCache) {
		return {
			system: systemMessage ? [{ text: systemMessage } as SystemContentBlock] : [],
			messages: convertedMessages,
		}
	}

	const cacheResult = getCacheStrategyResult(
		modelInfo,
		systemMessage,
		anthropicMessages,
		usePromptCache,
		conversationId,
		previousCachePointPlacements ?? {},
	)

	const messagesWithCache = applyCachePointsToMessages(convertedMessages, cacheResult.messageCachePointPlacements)

	return {
		system: cacheResult.system,
		messages: messagesWithCache,
	}
}

function applyCachePointsToMessages(
	messages: Message[],
	messageCachePointPlacements: CachePointPlacement[] | undefined,
): Message[] {
	return messages.map((msg, index) => {
		const placement = messageCachePointPlacements?.find((p) => p.index === index)
		if (placement) {
			return {
				...msg,
				content: [...(msg.content || []), { cachePoint: { type: "default" } } as ContentBlock],
			}
		}
		return msg
	})
}

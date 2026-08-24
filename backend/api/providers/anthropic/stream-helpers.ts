import { Anthropic } from "@anthropic-ai/sdk"
import { CacheControlEphemeral } from "@anthropic-ai/sdk/resources"

export const CACHEABLE_MODELS = new Set<string>([
	"claude-sonnet-4-6",
	"claude-sonnet-4-5",
	"claude-sonnet-4-20250514",
	"claude-opus-4-6",
	"claude-opus-4-5-20251101",
	"claude-opus-4-1-20250805",
	"claude-opus-4-20250514",
	"claude-3-7-sonnet-20250219",
	"claude-3-5-sonnet-20241022",
	"claude-3-5-haiku-20241022",
	"claude-3-opus-20240229",
	"claude-haiku-4-5-20251001",
	"claude-3-haiku-20240307",
])

export const _1M_CONTEXT_MODELS = new Set<string>([
	"claude-sonnet-4-20250514",
	"claude-sonnet-4-5",
	"claude-sonnet-4-6",
	"claude-opus-4-6",
])

export function add1MContextBeta(betas: string[], modelId: string, anthropicBeta1MContext?: boolean): void {
	if (_1M_CONTEXT_MODELS.has(modelId) && anthropicBeta1MContext) {
		betas.push("context-1m-2025-08-07")
	}
}

export function getAnthropicRequestOptions(
	betas: string[],
	modelId: string,
): { headers: { "anthropic-beta": string } } | undefined {
	if (CACHEABLE_MODELS.has(modelId)) {
		betas.push("prompt-caching-2024-07-31")
		return { headers: { "anthropic-beta": betas.join(",") } }
	}
	return undefined
}

export function applyCacheControl(
	message: Anthropic.Messages.MessageParam,
	index: number,
	lastUserMsgIndex: number,
	secondLastMsgUserIndex: number,
	cacheControl: CacheControlEphemeral,
): Anthropic.Messages.MessageParam {
	if (index !== lastUserMsgIndex && index !== secondLastMsgUserIndex) {
		return message
	}
	return {
		...message,
		content:
			typeof message.content === "string"
				? [{ type: "text" as const, text: message.content, cache_control: cacheControl }]
				: message.content.map((content, contentIndex) =>
						contentIndex === message.content.length - 1
							? { ...content, cache_control: cacheControl }
							: content,
					),
	}
}

export function buildCacheableMessages(
	sanitizedMessages: Anthropic.Messages.MessageParam[],
	cacheControl: CacheControlEphemeral,
): Anthropic.Messages.MessageParam[] {
	const userMsgIndices = sanitizedMessages.reduce(
		(acc, msg, index) => (msg.role === "user" ? [...acc, index] : acc),
		[] as number[],
	)
	const lastUserMsgIndex = userMsgIndices[userMsgIndices.length - 1] ?? -1
	const secondLastMsgUserIndex = userMsgIndices[userMsgIndices.length - 2] ?? -1
	return sanitizedMessages.map((message, index) =>
		applyCacheControl(message, index, lastUserMsgIndex, secondLastMsgUserIndex, cacheControl),
	)
}

export function buildCacheableStreamParams(
	modelId: string,
	maxTokens: number | undefined,
	temperature: number | undefined,
	thinking: Anthropic.Messages.MessageStreamParams["thinking"],
	systemPrompt: string,
	cacheControl: CacheControlEphemeral,
	messageParams: Anthropic.Messages.MessageParam[],
	nativeToolParams: { tools: Anthropic.Messages.Tool[]; tool_choice?: Anthropic.Messages.ToolChoice },
	anthropicDefaultMaxTokens: number,
): Anthropic.Messages.MessageCreateParamsStreaming {
	return {
		model: modelId,
		max_tokens: maxTokens ?? anthropicDefaultMaxTokens,
		temperature,
		thinking,
		system: [{ text: systemPrompt, type: "text" as const, cache_control: cacheControl }],
		messages: messageParams,
		stream: true,
		...nativeToolParams,
	}
}

export function buildDefaultStreamParams(
	modelId: string,
	maxTokens: number | undefined,
	temperature: number | undefined,
	systemPrompt: string,
	sanitizedMessages: Anthropic.Messages.MessageParam[],
	nativeToolParams: { tools: Anthropic.Messages.Tool[]; tool_choice?: Anthropic.Messages.ToolChoice },
	anthropicDefaultMaxTokens: number,
): Anthropic.Messages.MessageCreateParamsStreaming {
	return {
		model: modelId,
		max_tokens: maxTokens ?? anthropicDefaultMaxTokens,
		temperature,
		system: [{ text: systemPrompt, type: "text" as const }],
		messages: sanitizedMessages,
		stream: true,
		...nativeToolParams,
	}
}

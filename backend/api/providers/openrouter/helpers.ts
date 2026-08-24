import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import {
	ApiProviderError,
	OPENROUTER_DEFAULT_PROVIDER_NAME,
	OPEN_ROUTER_PROMPT_CACHING_MODELS,
} from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"

import {
	OpenRouterErrorResponseSchema,
	extractErrorFromMetadataRaw,
	type OpenRouterChatCompletionParams,
	type OpenRouterError,
} from "./types"
import type { OpenRouterReasoningParams } from "@api/transform/content/reasoning"
import { handleProviderError } from "@api/providers/utils/error-handler"
import { sanitizeGeminiMessages } from "@api/transform/content/sanitize-gemini"
import { convertToOpenAiMessages } from "@api/transform/format/openai-format"
import { normalizeMistralToolCallId } from "@api/transform/format/mistral-format"
import { convertToR1Format } from "@api/transform/r1/format"
import { addCacheBreakpoints as addGeminiCacheBreakpoints } from "@api/transform/caching/gemini"
import { addCacheBreakpoints as addAnthropicCacheBreakpoints } from "@api/transform/caching/anthropic"

export function handleStreamingError(
	error: OpenRouterError,
	modelId: string,
	operation: string,
	providerName: string,
): never {
	const rawString = error?.metadata?.raw
	const parsedError = extractErrorFromMetadataRaw(rawString)
	const rawErrorMessage = parsedError || error?.message || "Unknown error"

	const apiError = Object.assign(
		new ApiProviderError(rawErrorMessage, providerName, modelId, operation, error?.code),
		{ status: error?.code, error },
	)

	getTelemetryService().captureException(apiError)

	throw new Error(`OpenRouter API Error ${error?.code}: ${rawErrorMessage}`)
}

export function handleRequestError(error: unknown, modelId: string, operation: string, providerName: string): never {
	const parseResult = OpenRouterErrorResponseSchema.safeParse(error)
	const openRouterError = parseResult.success ? parseResult.data.error : null

	if (openRouterError) {
		const rawString = openRouterError.metadata?.raw
		const parsedError = extractErrorFromMetadataRaw(rawString)
		const rawErrorMessage = parsedError || openRouterError.message || "Unknown error"

		const apiError = Object.assign(
			new ApiProviderError(rawErrorMessage, providerName, modelId, operation, openRouterError.code),
			{ status: openRouterError.code, error: openRouterError },
		)

		getTelemetryService().captureException(apiError)
		throw handleProviderError(error, providerName)
	}

	const errorMessage = error instanceof Error ? error.message : String(error)
	const apiError = new ApiProviderError(errorMessage, providerName, modelId, operation)
	getTelemetryService().captureException(apiError)
	throw handleProviderError(error, providerName)
}

export function buildRequestOptions(modelId: string): Record<string, unknown> | undefined {
	return modelId.startsWith("anthropic/")
		? { headers: { "x-anthropic-beta": "fine-grained-tool-streaming-2025-05-14" } }
		: undefined
}

export function buildProviderConfig(
	openRouterSpecificProvider: string | undefined,
): Record<string, unknown> | undefined {
	if (openRouterSpecificProvider && openRouterSpecificProvider !== OPENROUTER_DEFAULT_PROVIDER_NAME) {
		return {
			order: [openRouterSpecificProvider],
			only: [openRouterSpecificProvider],
			allow_fallbacks: false,
		}
	}
	return undefined
}

export function addCacheBreakpoints(
	modelId: string,
	systemPrompt: string,
	messages: OpenAI.Chat.ChatCompletionMessageParam[],
): void {
	if (modelId.startsWith("google")) {
		addGeminiCacheBreakpoints(systemPrompt, messages)
	} else {
		addAnthropicCacheBreakpoints(systemPrompt, messages)
	}
}

export function prepareCreateMessage(
	systemPrompt: string,
	messages: Anthropic.Messages.MessageParam[],
	modelId: string,
	_reasoning: OpenRouterReasoningParams | undefined,
): OpenAI.Chat.ChatCompletionMessageParam[] {
	const isMistral = modelId.toLowerCase().includes("mistral")
	let openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
		{ role: "system", content: systemPrompt },
		...convertToOpenAiMessages(
			messages,
			isMistral ? { normalizeToolCallId: normalizeMistralToolCallId } : undefined,
		),
	]

	if (modelId.startsWith("deepseek/deepseek-r1") || modelId === "perplexity/sonar-reasoning") {
		openAiMessages = convertToR1Format([{ role: "user", content: systemPrompt }, ...messages])
	}

	if (modelId.startsWith("google/gemini")) {
		openAiMessages = sanitizeGeminiMessages(openAiMessages, modelId)
	}

	if (OPEN_ROUTER_PROMPT_CACHING_MODELS.has(modelId)) {
		addCacheBreakpoints(modelId, systemPrompt, openAiMessages)
	}

	return openAiMessages
}

export async function executeStreamRequest(
	client: OpenAI,
	modelId: string,
	maxTokens: number | undefined,
	temperature: number | undefined,
	topP: number | undefined,
	reasoning: OpenRouterReasoningParams | undefined,
	openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[],
	tools: OpenAI.Chat.ChatCompletionTool[] | undefined,
	toolChoice: OpenAI.Chat.ChatCompletionToolChoiceOption | undefined,
	openRouterSpecificProvider: string | undefined,
	providerName: string,
): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk> | null> {
	const providerConfig = buildProviderConfig(openRouterSpecificProvider)
	const completionParams: OpenRouterChatCompletionParams = {
		model: modelId,
		...(maxTokens && maxTokens > 0 && { max_tokens: maxTokens }),
		temperature,
		top_p: topP,
		messages: openAiMessages,
		stream: true,
		stream_options: { include_usage: true },
		...(providerConfig && { provider: providerConfig }),
		...(reasoning && { reasoning }),
		tools,
		tool_choice: toolChoice,
	}

	const requestOptions = buildRequestOptions(modelId)

	try {
		return (await client.chat.completions.create(
			completionParams,
			requestOptions,
		)) as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk> | null
	} catch (error) {
		handleRequestError(error, modelId, "createMessage", providerName)
	}
}

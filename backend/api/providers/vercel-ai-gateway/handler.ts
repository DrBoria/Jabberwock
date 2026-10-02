import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import {
	type ModelInfo,
	vercelAiGatewayDefaultModelId,
	vercelAiGatewayDefaultModelInfo,
	VERCEL_AI_GATEWAY_DEFAULT_TEMPERATURE,
	VERCEL_AI_GATEWAY_PROMPT_CACHING_MODELS,
} from "@jabberwock/types"

import { ApiHandlerOptions } from "@shared/api"

import { ApiStream } from "@api/transform/stream"
import { convertToOpenAiMessages } from "@api/transform/format/openai-format"
import { addCacheBreakpoints } from "@api/transform/caching/vercel-ai-gateway"

import type { ApiHandlerCreateMessageMetadata } from "@api/index"
import { RouterProvider } from "@api/providers/router-provider"

// Extend OpenAI's CompletionUsage to include Vercel AI Gateway specific fields
interface VercelAiGatewayUsage extends OpenAI.CompletionUsage {
	cache_creation_input_tokens?: number
	cost?: number
}

export function VercelAiGatewayHandler(options: ApiHandlerOptions) {
	const base = RouterProvider({
		options,
		name: "vercel-ai-gateway",
		baseURL: "https://ai-gateway.vercel.sh/v1",
		apiKey: options.vercelAiGatewayApiKey,
		modelId: options.vercelAiGatewayModelId,
		defaultModelId: vercelAiGatewayDefaultModelId,
		defaultModelInfo: vercelAiGatewayDefaultModelInfo,
	})
	const handler = {
		...base,
		buildVercelRequestBody(
			modelId: string,
			systemPrompt: string,
			openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[],
			info: ModelInfo,
			metadata?: ApiHandlerCreateMessageMetadata,
		): OpenAI.Chat.ChatCompletionCreateParams {
			return {
				model: modelId,
				messages: openAiMessages,
				temperature: handler.supportsTemperature(modelId)
					? (handler.options.modelTemperature ?? VERCEL_AI_GATEWAY_DEFAULT_TEMPERATURE)
					: undefined,
				max_completion_tokens: info.maxTokens,
				stream: true,
				stream_options: { include_usage: true },
				tools: handler.convertToolsForOpenAI(metadata?.tools),
				tool_choice: metadata?.tool_choice,
				parallel_tool_calls: metadata?.parallelToolCalls ?? true,
			}
		},
		buildVercelUsageChunk(usage: VercelAiGatewayUsage): {
			type: "usage"
			inputTokens: number
			outputTokens: number
			cacheWriteTokens?: number
			cacheReadTokens?: number
			totalCost: number
		} {
			return {
				type: "usage",
				inputTokens: usage.prompt_tokens || 0,
				outputTokens: usage.completion_tokens || 0,
				cacheWriteTokens: usage.cache_creation_input_tokens || undefined,
				cacheReadTokens: usage.prompt_tokens_details?.cached_tokens || undefined,
				totalCost: usage.cost ?? 0,
			}
		},
		*processVercelToolCalls(
			toolCalls: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta.ToolCall[],
		): Generator<{
			type: "tool_call_partial"
			index: number
			id?: string
			name?: string
			arguments?: string
		}> {
			for (const toolCall of toolCalls) {
				yield {
					type: "tool_call_partial",
					index: toolCall.index,
					id: toolCall.id,
					name: toolCall.function?.name,
					arguments: toolCall.function?.arguments,
				}
			}
		},
		*processVercelChunk(chunk: OpenAI.Chat.ChatCompletionChunk): Generator<
			| {
					type: "text"
					text: string
			  }
			| {
					type: "tool_call_partial"
					index: number
					id?: string
					name?: string
					arguments?: string
			  }
			| {
					type: "usage"
					inputTokens: number
					outputTokens: number
					cacheWriteTokens?: number
					cacheReadTokens?: number
					totalCost: number
			  }
		> {
			const delta = chunk.choices[0]?.delta
			if (delta?.content) {
				yield { type: "text", text: delta.content }
			}
			if (delta?.tool_calls) {
				yield* handler.processVercelToolCalls(delta.tool_calls)
			}
			if (chunk.usage) {
				yield handler.buildVercelUsageChunk(chunk.usage as VercelAiGatewayUsage)
			}
		},
		async *createMessage(
			systemPrompt: string,
			messages: Anthropic.Messages.MessageParam[],
			metadata?: ApiHandlerCreateMessageMetadata,
		): ApiStream {
			const { id: modelId, info } = await handler.fetchModel()
			const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
				{ role: "system", content: systemPrompt },
				...convertToOpenAiMessages(messages),
			]
			if (VERCEL_AI_GATEWAY_PROMPT_CACHING_MODELS.has(modelId) && info.supportsPromptCache) {
				addCacheBreakpoints(systemPrompt, openAiMessages)
			}
			const body = handler.buildVercelRequestBody(modelId, systemPrompt, openAiMessages, info, metadata)
			const completion = (await handler.client.chat.completions.create(
				body,
			)) as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
			for await (const chunk of completion) {
				yield* handler.processVercelChunk(chunk)
			}
		},
		async completePrompt(prompt: string): Promise<string> {
			const { id: modelId, info } = await handler.fetchModel()
			try {
				const requestOptions: OpenAI.Chat.ChatCompletionCreateParams = {
					model: modelId,
					messages: [{ role: "user", content: prompt }],
					stream: false,
				}
				if (handler.supportsTemperature(modelId)) {
					requestOptions.temperature =
						handler.options.modelTemperature ?? VERCEL_AI_GATEWAY_DEFAULT_TEMPERATURE
				}
				requestOptions.max_completion_tokens = info.maxTokens
				const response = await handler.client.chat.completions.create(requestOptions)
				return response.choices[0]?.message.content || ""
			} catch (error) {
				if (error instanceof Error) {
					throw new Error(`Vercel AI Gateway completion error: ${error.message}`)
				}
				throw error
			}
		},
	}
	return handler
}

import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { type ModelInfo, qwenCodeModels, qwenCodeDefaultModelId } from "@jabberwock/types"

import type { ApiHandlerOptions } from "@shared/api"

import { convertToOpenAiMessages } from "@api/transform/format/openai-format"
import { ApiStream } from "@api/transform/stream"

import { createBaseProvider } from "@api/providers/base-provider"
import type { ApiHandlerCreateMessageMetadata } from "@api/index"

import { type QwenOAuthCredentials, loadCachedQwenCredentials, doRefreshAccessToken, isTokenValid } from "./auth"
import { processQwenDelta } from "./utils"

interface QwenCodeHandlerOptions extends ApiHandlerOptions {
	qwenCodeOauthPath?: string
}

export function QwenCodeHandler(options: QwenCodeHandlerOptions) {
	const base = createBaseProvider()
	const handler = {
		...base,
		options,
		credentials: null as QwenOAuthCredentials | null,
		client: undefined as OpenAI | undefined,
		refreshPromise: null as Promise<QwenOAuthCredentials> | null,
		ensureClient(): OpenAI {
			if (!handler.client) {
				// Create the client instance with dummy key initially
				// The API key will be updated dynamically via ensureAuthenticated
				handler.client = new OpenAI({
					apiKey: "dummy-key-will-be-replaced",
					baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
				})
			}
			return handler.client
		},
		async refreshAccessToken(credentials: QwenOAuthCredentials): Promise<QwenOAuthCredentials> {
			// If a refresh is already in progress, return the existing promise
			if (handler.refreshPromise) {
				return handler.refreshPromise
			}
			// Create a new refresh promise
			handler.refreshPromise = doRefreshAccessToken(credentials, handler.options.qwenCodeOauthPath)
			try {
				const result = await handler.refreshPromise
				return result
			} finally {
				// Clear the promise after completion (success or failure)
				handler.refreshPromise = null
			}
		},
		isTokenExpired(credentials: QwenOAuthCredentials): boolean {
			return !isTokenValid(credentials)
		},
		async ensureAuthenticated(): Promise<void> {
			if (!handler.credentials) {
				handler.credentials = await loadCachedQwenCredentials(handler.options.qwenCodeOauthPath)
			}
			if (handler.isTokenExpired(handler.credentials)) {
				handler.credentials = await handler.refreshAccessToken(handler.credentials)
			}
			// After authentication, update the apiKey and baseURL on the existing client
			const client = handler.ensureClient()
			client.apiKey = handler.credentials.access_token
			client.baseURL = handler.getBaseUrl(handler.credentials)
		},
		getBaseUrl(creds: QwenOAuthCredentials): string {
			let baseUrl = creds.resource_url || "https://dashscope.aliyuncs.com/compatible-mode/v1"
			if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
				baseUrl = `https://${baseUrl}`
			}
			return baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`
		},
		async callApiWithRetry<T>(apiCall: () => Promise<T>): Promise<T> {
			try {
				return await apiCall()
			} catch (error) {
				if ((error as Record<string, unknown>).status === 401) {
					// Token expired, refresh and retry
					handler.credentials = await handler.refreshAccessToken(handler.credentials!)
					const client = handler.ensureClient()
					client.apiKey = handler.credentials.access_token
					client.baseURL = handler.getBaseUrl(handler.credentials)
					return await apiCall()
				} else {
					throw error
				}
			}
		},
		buildQwenRequestOptions(
			modelId: string,
			messages: OpenAI.Chat.ChatCompletionMessageParam[],
			maxTokens: number | undefined,
			metadata: ApiHandlerCreateMessageMetadata | undefined,
		): OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming {
			return {
				model: modelId,
				temperature: 0,
				messages,
				stream: true,
				stream_options: { include_usage: true },
				max_completion_tokens: maxTokens,
				tools: handler.convertToolsForOpenAI(metadata?.tools),
				tool_choice: metadata?.tool_choice,
				parallel_tool_calls: metadata?.parallelToolCalls ?? true,
			}
		},
		async *createMessage(
			systemPrompt: string,
			messages: Anthropic.Messages.MessageParam[],
			metadata?: ApiHandlerCreateMessageMetadata,
		): ApiStream {
			await handler.ensureAuthenticated()
			const client = handler.ensureClient()
			const model = handler.getModel()
			const systemMessage: OpenAI.Chat.ChatCompletionSystemMessageParam = {
				role: "system",
				content: systemPrompt,
			}
			const convertedMessages = [systemMessage, ...convertToOpenAiMessages(messages)]
			const requestOptions = handler.buildQwenRequestOptions(
				model.id,
				convertedMessages,
				model.info.maxTokens ?? undefined,
				metadata,
			)
			const stream = await handler.callApiWithRetry(() => client.chat.completions.create(requestOptions))
			let fullContent = ""
			for await (const apiChunk of stream) {
				const delta = apiChunk.choices[0]?.delta ?? {}
				fullContent = yield* processQwenDelta(delta, fullContent)
				if (apiChunk.usage) {
					yield {
						type: "usage",
						inputTokens: apiChunk.usage.prompt_tokens || 0,
						outputTokens: apiChunk.usage.completion_tokens || 0,
					}
				}
			}
		},
		getModel(): {
			id: string
			info: ModelInfo
		} {
			const id = handler.options.apiModelId ?? qwenCodeDefaultModelId
			const info = qwenCodeModels[id as keyof typeof qwenCodeModels] || qwenCodeModels[qwenCodeDefaultModelId]
			return { id, info }
		},
		async completePrompt(prompt: string): Promise<string> {
			await handler.ensureAuthenticated()
			const client = handler.ensureClient()
			const model = handler.getModel()
			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
				model: model.id,
				messages: [{ role: "user", content: prompt }],
				max_completion_tokens: model.info.maxTokens,
			}
			const response = await handler.callApiWithRetry(() => client.chat.completions.create(requestOptions))
			return response.choices[0]?.message.content || ""
		},
	}
	return handler
}

import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { type ModelInfo, qwenCodeModels, qwenCodeDefaultModelId } from "@jabberwock/types"

import type { ApiHandlerOptions } from "@shared/api"

import { convertToOpenAiMessages } from "@api/transform/format/openai-format"
import { ApiStream } from "@api/transform/stream"

import { BaseProvider } from "@api/providers/base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "@api/index"

import { type QwenOAuthCredentials, loadCachedQwenCredentials, doRefreshAccessToken, isTokenValid } from "./auth"
import { processQwenDelta } from "./utils"

interface QwenCodeHandlerOptions extends ApiHandlerOptions {
	qwenCodeOauthPath?: string
}

export class QwenCodeHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: QwenCodeHandlerOptions
	private credentials: QwenOAuthCredentials | null = null
	private client: OpenAI | undefined
	private refreshPromise: Promise<QwenOAuthCredentials> | null = null

	constructor(options: QwenCodeHandlerOptions) {
		super()
		this.options = options
	}

	private ensureClient(): OpenAI {
		if (!this.client) {
			// Create the client instance with dummy key initially
			// The API key will be updated dynamically via ensureAuthenticated
			this.client = new OpenAI({
				apiKey: "dummy-key-will-be-replaced",
				baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
			})
		}
		return this.client
	}

	private async refreshAccessToken(credentials: QwenOAuthCredentials): Promise<QwenOAuthCredentials> {
		// If a refresh is already in progress, return the existing promise
		if (this.refreshPromise) {
			return this.refreshPromise
		}

		// Create a new refresh promise
		this.refreshPromise = doRefreshAccessToken(credentials, this.options.qwenCodeOauthPath)

		try {
			const result = await this.refreshPromise
			return result
		} finally {
			// Clear the promise after completion (success or failure)
			this.refreshPromise = null
		}
	}

	private isTokenExpired(credentials: QwenOAuthCredentials): boolean {
		return !isTokenValid(credentials)
	}

	private async ensureAuthenticated(): Promise<void> {
		if (!this.credentials) {
			this.credentials = await loadCachedQwenCredentials(this.options.qwenCodeOauthPath)
		}

		if (this.isTokenExpired(this.credentials)) {
			this.credentials = await this.refreshAccessToken(this.credentials)
		}

		// After authentication, update the apiKey and baseURL on the existing client
		const client = this.ensureClient()
		client.apiKey = this.credentials.access_token
		client.baseURL = this.getBaseUrl(this.credentials)
	}

	private getBaseUrl(creds: QwenOAuthCredentials): string {
		let baseUrl = creds.resource_url || "https://dashscope.aliyuncs.com/compatible-mode/v1"
		if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
			baseUrl = `https://${baseUrl}`
		}
		return baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`
	}

	private async callApiWithRetry<T>(apiCall: () => Promise<T>): Promise<T> {
		try {
			return await apiCall()
		} catch (error) {
			if ((error as Record<string, unknown>).status === 401) {
				// Token expired, refresh and retry
				this.credentials = await this.refreshAccessToken(this.credentials!)
				const client = this.ensureClient()
				client.apiKey = this.credentials.access_token
				client.baseURL = this.getBaseUrl(this.credentials)
				return await apiCall()
			} else {
				throw error
			}
		}
	}

	private buildQwenRequestOptions(
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
			tools: this.convertToolsForOpenAI(metadata?.tools),
			tool_choice: metadata?.tool_choice,
			parallel_tool_calls: metadata?.parallelToolCalls ?? true,
		}
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		await this.ensureAuthenticated()
		const client = this.ensureClient()
		const model = this.getModel()

		const systemMessage: OpenAI.Chat.ChatCompletionSystemMessageParam = {
			role: "system",
			content: systemPrompt,
		}

		const convertedMessages = [systemMessage, ...convertToOpenAiMessages(messages)]

		const requestOptions = this.buildQwenRequestOptions(
			model.id,
			convertedMessages,
			model.info.maxTokens ?? undefined,
			metadata,
		)

		const stream = await this.callApiWithRetry(() => client.chat.completions.create(requestOptions))

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
	}

	override getModel(): { id: string; info: ModelInfo } {
		const id = this.options.apiModelId ?? qwenCodeDefaultModelId
		const info = qwenCodeModels[id as keyof typeof qwenCodeModels] || qwenCodeModels[qwenCodeDefaultModelId]
		return { id, info }
	}

	async completePrompt(prompt: string): Promise<string> {
		await this.ensureAuthenticated()
		const client = this.ensureClient()
		const model = this.getModel()

		const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
			model: model.id,
			messages: [{ role: "user", content: prompt }],
			max_completion_tokens: model.info.maxTokens,
		}

		const response = await this.callApiWithRetry(() => client.chat.completions.create(requestOptions))

		return response.choices[0]?.message.content || ""
	}
}

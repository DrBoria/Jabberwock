import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI, { AzureOpenAI } from "openai"
import { type ModelInfo, azureOpenAiDefaultApiVersion, openAiModelInfoSaneDefaults } from "@jabberwock/types"
import type { ApiHandlerOptions } from "@shared/api"
import { getModelParams } from "@api/transform/model-params"
import { ApiStream } from "@api/transform/stream"
import type { ApiHandlerCreateMessageMetadata } from "@api/index"
import { convertToOpenAiMessages } from "@api/transform/format/openai-format"
import { convertToR1Format } from "@api/transform/r1/format"
import { DEFAULT_HEADERS } from "@api/providers/constants"
import { BaseProvider } from "@api/providers/base-provider"
import type { SingleCompletionHandler } from "@api/index"
import { getApiRequestTimeout } from "@api/providers/utils/timeout-config"
import { OpenAiO3Handler } from "./o3"
import { OpenAiStreamRequestHandler } from "./stream-request"
import { createCompletionWithErrorHandling, processNonStreamToolCalls, processUsageMetrics } from "./stream"
import { getUrlHost, isAzureAiInference, addMaxTokensIfNeeded, isDeepseekReasoner } from "./utils"

export class OpenAiHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	protected client: OpenAI
	private readonly providerName = "OpenAI"
	private readonly o3Handler: OpenAiO3Handler
	private readonly streamRequestHandler: OpenAiStreamRequestHandler

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		const baseURL = this.options.openAiBaseUrl || "https://api.openai.com/v1"
		const apiKey = this.options.openAiApiKey ?? "not-provided"
		const azureAiInference = isAzureAiInference(this.options.openAiBaseUrl)
		const urlHost = getUrlHost(this.options.openAiBaseUrl)
		const isAzureOpenAi = urlHost === "azure.com" || urlHost.endsWith(".azure.com") || options.openAiUseAzure
		const headers = { ...DEFAULT_HEADERS, ...(this.options.openAiHeaders || {}) }
		const timeout = getApiRequestTimeout()

		if (azureAiInference) {
			this.client = new OpenAI({
				baseURL,
				apiKey,
				defaultHeaders: headers,
				defaultQuery: { "api-version": this.options.azureApiVersion || "2024-05-01-preview" },
				timeout,
			})
		} else if (isAzureOpenAi) {
			this.client = new AzureOpenAI({
				baseURL,
				apiKey,
				apiVersion: this.options.azureApiVersion || azureOpenAiDefaultApiVersion,
				defaultHeaders: headers,
				timeout,
			})
		} else {
			this.client = new OpenAI({ baseURL, apiKey, defaultHeaders: headers, timeout })
		}

		const bindConvertTools = (tools: OpenAI.Chat.ChatCompletionTool[] | undefined) =>
			this.convertToolsForOpenAI(tools)
		this.o3Handler = new OpenAiO3Handler(this.client, this.options, this.providerName, bindConvertTools)
		this.streamRequestHandler = new OpenAiStreamRequestHandler(
			this.client,
			this.options,
			this.providerName,
			bindConvertTools,
		)
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { info: modelInfo, reasoning } = this.getModel()
		const modelUrl = this.options.openAiBaseUrl ?? ""
		const modelId = this.options.openAiModelId ?? ""

		if (this.o3Handler.isO3FamilyModel(modelId)) {
			yield* this.o3Handler.handleO3FamilyMessage(modelId, systemPrompt, messages, metadata)
			return
		}

		if (this.options.openAiStreamingEnabled ?? true) {
			yield* this.streamRequestHandler.handleStreamingRequest(
				systemPrompt,
				messages,
				metadata,
				modelInfo,
				reasoning,
				modelId,
				modelUrl,
			)
		} else {
			yield* this.handleNonStreamingRequest(systemPrompt, messages, metadata, modelInfo, modelId, modelUrl)
		}
	}

	private async *handleNonStreamingRequest(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata: ApiHandlerCreateMessageMetadata | undefined,
		modelInfo: ModelInfo,
		modelId: string,
		modelUrl: string,
	): ApiStream {
		const deepseekReasoner = isDeepseekReasoner(modelId, this.options.openAiR1FormatEnabled ?? false)
		const convertedMessages = this.buildNonStreamMessages(systemPrompt, messages, deepseekReasoner)

		const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
			model: modelId,
			messages: convertedMessages,
			tools: this.convertToolsForOpenAI(metadata?.tools),
			tool_choice: metadata?.tool_choice,
			parallel_tool_calls: metadata?.parallelToolCalls ?? true,
		}

		addMaxTokensIfNeeded(this.options, requestOptions, modelInfo)

		const response = await createCompletionWithErrorHandling(
			this.client,
			requestOptions,
			modelUrl,
			this.providerName,
		)
		const message = response.choices?.[0]?.message

		yield* processNonStreamToolCalls(message)
		yield { type: "text", text: message?.content || "" }
		yield processUsageMetrics(response.usage, modelInfo)
	}

	private buildNonStreamMessages(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		deepseekReasoner: boolean,
	): OpenAI.Chat.ChatCompletionMessageParam[] {
		if (deepseekReasoner) {
			return convertToR1Format([{ role: "user", content: systemPrompt }, ...messages])
		}

		return [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)]
	}

	override getModel() {
		const id = this.options.openAiModelId ?? ""
		const info: ModelInfo = this.options.openAiCustomModelInfo ?? openAiModelInfoSaneDefaults
		return {
			id,
			info,
			...getModelParams({
				format: "openai",
				modelId: id,
				model: info,
				settings: this.options,
				defaultTemperature: 0,
			}),
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			const model = this.getModel()
			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
				model: model.id,
				messages: [{ role: "user", content: prompt }],
			}
			addMaxTokensIfNeeded(this.options, requestOptions, model.info)
			const response = await createCompletionWithErrorHandling(
				this.client,
				requestOptions,
				this.options.openAiBaseUrl ?? "",
				this.providerName,
			)
			return response.choices?.[0]?.message.content || ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`${this.providerName} completion error: ${error.message}`)
			}
			throw error
		}
	}
}

import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI, { AzureOpenAI } from "openai"
import { type ModelInfo, azureOpenAiDefaultApiVersion, openAiModelInfoSaneDefaults } from "@jabberwock/types"
import type { ApiHandlerOptions } from "@shared/api"
import { getModelParams } from "@api/transform/model-params"
import { ApiStream } from "@api/transform/stream"
import type { ApiHandlerCreateMessageMetadata } from "@api/index"
import { convertToOpenAiMessages } from "@api/transform/format/openai-format"
import { convertToR1Format } from "@api/transform/r1"
import { DEFAULT_HEADERS } from "@api/providers/constants"
import { createBaseProvider, convertToolsForOpenAI } from "@api/providers/base-provider"
import { getApiRequestTimeout } from "@api/providers/utils/timeout-config"
import { OpenAiO3Handler } from "./o3"
import { OpenAiStreamRequestHandler } from "./request"
import { createCompletionWithErrorHandling, processNonStreamToolCalls, processUsageMetrics } from "./main"
import { getUrlHost, isAzureAiInference, addMaxTokensIfNeeded, isDeepseekReasoner } from "./utils"

export function OpenAiHandler(options: ApiHandlerOptions) {
	let providerName = "OpenAI"
	const baseURL = options.openAiBaseUrl || "https://api.openai.com/v1"
	const apiKey = options.openAiApiKey ?? "not-provided"
	const azureAiInference = isAzureAiInference(options.openAiBaseUrl)
	const urlHost = getUrlHost(options.openAiBaseUrl)
	const isAzureOpenAi = urlHost === "azure.com" || urlHost.endsWith(".azure.com") || options.openAiUseAzure
	const headers = { ...DEFAULT_HEADERS, ...(options.openAiHeaders || {}) }
	const timeout = getApiRequestTimeout()

	let client: OpenAI
	if (azureAiInference) {
		client = new OpenAI({
			baseURL,
			apiKey,
			defaultHeaders: headers,
			defaultQuery: { "toolExecutor.api-version": options.azureApiVersion || "2024-05-01-preview" },
			timeout,
		})
	} else if (isAzureOpenAi) {
		client = new AzureOpenAI({
			baseURL,
			apiKey,
			apiVersion: options.azureApiVersion || azureOpenAiDefaultApiVersion,
			defaultHeaders: headers,
			timeout,
		})
	} else {
		client = new OpenAI({ baseURL, apiKey, defaultHeaders: headers, timeout })
	}

	const bindConvertTools = (tools: OpenAI.Chat.ChatCompletionTool[] | undefined) => convertToolsForOpenAI(tools)
	const o3Handler = OpenAiO3Handler(client, options, providerName, bindConvertTools)
	const streamRequestHandler = OpenAiStreamRequestHandler(client, options, providerName, bindConvertTools)

	const base = createBaseProvider()
	const handler = {
		...base,
		options,
		client: client,
		providerName: providerName,
		o3Handler: o3Handler,
		streamRequestHandler: streamRequestHandler,
		async *createMessage(
			systemPrompt: string,
			messages: Anthropic.Messages.MessageParam[],
			metadata?: ApiHandlerCreateMessageMetadata,
		): ApiStream {
			const { info: modelInfo, reasoning } = handler.getModel()
			const modelUrl = handler.options.openAiBaseUrl ?? ""
			const modelId = handler.options.openAiModelId ?? ""
			if (handler.o3Handler.isO3FamilyModel(modelId)) {
				yield* handler.o3Handler.handleO3FamilyMessage(modelId, systemPrompt, messages, metadata)
				return
			}
			if (handler.options.openAiStreamingEnabled ?? true) {
				yield* handler.streamRequestHandler.handleStreamingRequest(
					systemPrompt,
					messages,
					metadata,
					modelInfo,
					reasoning,
					modelId,
					modelUrl,
				)
			} else {
				yield* handler.handleNonStreamingRequest(systemPrompt, messages, metadata, modelInfo, modelId, modelUrl)
			}
		},
		async *handleNonStreamingRequest(
			systemPrompt: string,
			messages: Anthropic.Messages.MessageParam[],
			metadata: ApiHandlerCreateMessageMetadata | undefined,
			modelInfo: ModelInfo,
			modelId: string,
			modelUrl: string,
		): ApiStream {
			const deepseekReasoner = isDeepseekReasoner(modelId, handler.options.openAiR1FormatEnabled ?? false)
			const convertedMessages = handler.buildNonStreamMessages(systemPrompt, messages, deepseekReasoner)
			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
				model: modelId,
				messages: convertedMessages,
				tools: handler.convertToolsForOpenAI(metadata?.tools),
				tool_choice: metadata?.tool_choice,
				parallel_tool_calls: metadata?.parallelToolCalls ?? true,
			}
			addMaxTokensIfNeeded(handler.options, requestOptions, modelInfo)
			const response = await createCompletionWithErrorHandling(
				handler.client,
				requestOptions,
				modelUrl,
				handler.providerName,
			)
			const message = response.choices?.[0]?.message
			yield* processNonStreamToolCalls(message)
			yield { type: "text", text: message?.content || "" }
			yield processUsageMetrics(response.usage, modelInfo)
		},
		buildNonStreamMessages(
			systemPrompt: string,
			messages: Anthropic.Messages.MessageParam[],
			deepseekReasoner: boolean,
		): OpenAI.Chat.ChatCompletionMessageParam[] {
			if (deepseekReasoner) {
				return convertToR1Format([{ role: "user", content: systemPrompt }, ...messages])
			}
			return [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)]
		},
		getModel() {
			const id = handler.options.openAiModelId ?? ""
			const info: ModelInfo = handler.options.openAiCustomModelInfo ?? openAiModelInfoSaneDefaults
			return {
				id,
				info,
				...getModelParams({
					format: "openai",
					modelId: id,
					model: info,
					settings: handler.options,
					defaultTemperature: 0,
				}),
			}
		},
		async completePrompt(prompt: string): Promise<string> {
			try {
				const model = handler.getModel()
				const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
					model: model.id,
					messages: [{ role: "user", content: prompt }],
				}
				addMaxTokensIfNeeded(handler.options, requestOptions, model.info)
				const response = await createCompletionWithErrorHandling(
					handler.client,
					requestOptions,
					handler.options.openAiBaseUrl ?? "",
					handler.providerName,
				)
				return response.choices?.[0]?.message.content || ""
			} catch (error) {
				if (error instanceof Error) {
					throw new Error(`${handler.providerName} completion error: ${error.message}`)
				}
				throw error
			}
		},
	}
	return handler
}

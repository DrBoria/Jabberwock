import type { Anthropic } from "@anthropic-ai/sdk"
import { GoogleGenAI, type GenerateContentParameters, type GenerateContentConfig } from "@google/genai"
import type { JWTInput } from "google-auth-library"
import { type ModelInfo, type GeminiModelId, geminiDefaultModelId, geminiModels } from "@jabberwock/types"
import { safeJsonParse } from "@jabberwock/core"
import { convertAnthropicMessageToGemini } from "@api/transform/format/gemini-format"
import type { ApiStream } from "@api/transform/stream"
import { getModelParams } from "@api/transform/model-params"
import { t } from "i18next"
import type { ApiHandlerCreateMessageMetadata } from "@api/index"
import { createBaseProvider } from "@api/providers/base-provider"
import type { GeminiHandlerOptions } from "./types"
import {
	filterReasoningMessages,
	buildToolIdMap,
	buildTemperatureConfig,
	buildMaxOutputTokens,
	shouldIncludeThoughtSignatures,
	extractCitationsOnly,
} from "./utils"
import { buildGeminiTools, applyToolConfig } from "./tools"
import { GeminiStreamProcessor } from "./stream"
import { handleGeminiError } from "./error"

export function GeminiHandler({ isVertex, ...options }: GeminiHandlerOptions) {
	const streamProcessor = GeminiStreamProcessor()
	let providerName = "Gemini"
	const project = options.vertexProjectId ?? "not-provided"
	const location = options.vertexRegion ?? "not-provided"
	const apiKey = options.geminiApiKey ?? "not-provided"
	const credentials = options.vertexJsonCredentials

	let client
	if (credentials) {
		client = new GoogleGenAI({
			vertexai: true,
			project,
			location,
			googleAuthOptions: { credentials: safeJsonParse<JWTInput>(credentials, undefined) },
		})
	} else if (options.vertexKeyFile) {
		client = new GoogleGenAI({
			vertexai: true,
			project,
			location,
			googleAuthOptions: { keyFile: options.vertexKeyFile },
		})
	} else {
		client = isVertex ? new GoogleGenAI({ vertexai: true, project, location }) : new GoogleGenAI({ apiKey })
	}

	const base = createBaseProvider()
	const handler = {
		...base,
		options,
		client: client,
		streamProcessor: streamProcessor,
		providerName: providerName,
		async *createMessage(
			systemInstruction: string,
			messages: Anthropic.Messages.MessageParam[],
			metadata?: ApiHandlerCreateMessageMetadata,
		): ApiStream {
			const { id: model, info, reasoning, maxTokens } = handler.getModel()
			handler.streamProcessor.lastThoughtSignature = undefined
			handler.streamProcessor.lastResponseId = undefined
			const config = handler.buildCreateMessageConfig(
				systemInstruction,
				messages,
				metadata,
				info,
				reasoning,
				maxTokens,
			)
			const params: GenerateContentParameters = {
				model,
				contents: config.contents as GenerateContentParameters["contents"],
				config: config.generationConfig,
			}
			try {
				const result = await handler.client.models.generateContentStream(params)
				yield* handler.streamProcessor.processStream(result, info, config.includeThoughtSignatures)
			} catch (error) {
				handleGeminiError(error, handler.providerName, model, "createMessage")
			}
		},
		buildCreateMessageConfig(
			systemInstruction: string,
			messages: Anthropic.Messages.MessageParam[],
			metadata: ApiHandlerCreateMessageMetadata | undefined,
			info: ModelInfo,
			thinkingConfig: unknown,
			maxTokens: number | undefined,
		): {
			contents: unknown[]
			generationConfig: GenerateContentConfig
			includeThoughtSignatures: boolean
		} {
			const maxOutputTokens = buildMaxOutputTokens(info, maxTokens, handler.options.modelMaxTokens)
			const includeThoughtSignatures = shouldIncludeThoughtSignatures(thinkingConfig, metadata)
			const geminiMessages = filterReasoningMessages(messages)
			const toolIdToName = buildToolIdMap(messages)
			const contents = geminiMessages
				.map((message) => convertAnthropicMessageToGemini(message, { includeThoughtSignatures, toolIdToName }))
				.flat()
			const tools = buildGeminiTools(metadata)
			const temperatureConfig = buildTemperatureConfig(info, handler.options)
			const generationConfig: GenerateContentConfig = {
				systemInstruction,
				httpOptions: handler.options.googleGeminiBaseUrl
					? { baseUrl: handler.options.googleGeminiBaseUrl }
					: undefined,
				thinkingConfig: thinkingConfig as GenerateContentConfig["thinkingConfig"],
				maxOutputTokens,
				temperature: temperatureConfig,
				...(tools && tools.length > 0 ? { tools } : {}),
			}
			applyToolConfig(generationConfig, metadata)
			return { contents, generationConfig, includeThoughtSignatures }
		},
		getModel() {
			const modelId = handler.options.apiModelId
			let id = modelId && modelId in geminiModels ? (modelId as GeminiModelId) : geminiDefaultModelId
			let info: ModelInfo = geminiModels[id]
			const params = getModelParams({
				format: "gemini",
				modelId: id,
				model: info,
				settings: handler.options,
				defaultTemperature: info.defaultTemperature ?? 1,
			})
			info = {
				...info,
				excludedTools: [...new Set([...(info.excludedTools || []), "apply_diff"])],
				includedTools: [...new Set([...(info.includedTools || []), "edit"])],
			}
			return { id: id.endsWith(":thinking") ? id.replace(":thinking", "") : id, info, ...params }
		},
		async completePrompt(prompt: string): Promise<string> {
			const { id: model, info } = handler.getModel()
			try {
				const temperatureConfig = buildTemperatureConfig(info, handler.options)
				const promptConfig: GenerateContentConfig = {
					httpOptions: handler.options.googleGeminiBaseUrl
						? { baseUrl: handler.options.googleGeminiBaseUrl }
						: undefined,
					temperature: temperatureConfig,
				}
				const result = await handler.client.models.generateContent({
					model,
					contents: [{ role: "user", parts: [{ text: prompt }] }],
					config: promptConfig,
				})
				let text = result.text ?? ""
				const candidate = result.candidates?.[0]
				if (candidate?.groundingMetadata) {
					const citations = extractCitationsOnly(candidate.groundingMetadata)
					if (citations) {
						text += `\n\n${t("common:errors.gemini.sources")} ${citations}`
					}
				}
				return text
			} catch (error) {
				handleGeminiError(error, handler.providerName, model, "completePrompt")
			}
		},
		getThoughtSignature(): string | undefined {
			return handler.streamProcessor.lastThoughtSignature
		},
		getResponseId(): string | undefined {
			return handler.streamProcessor.lastResponseId
		},
	}
	return handler
}

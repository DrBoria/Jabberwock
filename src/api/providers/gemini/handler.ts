import type { Anthropic } from "@anthropic-ai/sdk"
import { GoogleGenAI, type GenerateContentParameters, type GenerateContentConfig } from "@google/genai"
import type { JWTInput } from "google-auth-library"
import { type ModelInfo, type GeminiModelId, geminiDefaultModelId, geminiModels } from "@jabberwock/types"
import { safeJsonParse } from "@jabberwock/core"
import type { ApiHandlerOptions } from "@shared/api"
import { convertAnthropicMessageToGemini } from "@api/transform/format/gemini-format"
import type { ApiStream } from "@api/transform/stream"
import { getModelParams } from "@api/transform/model-params"
import { t } from "i18next"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "@api/index"
import { BaseProvider } from "@api/providers/base-provider"
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

export class GeminiHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: GoogleGenAI
	private streamProcessor = new GeminiStreamProcessor()
	private readonly providerName = "Gemini"

	constructor({ isVertex, ...options }: GeminiHandlerOptions) {
		super()
		this.options = options
		const project = this.options.vertexProjectId ?? "not-provided"
		const location = this.options.vertexRegion ?? "not-provided"
		const apiKey = this.options.geminiApiKey ?? "not-provided"
		const credentials = this.options.vertexJsonCredentials

		if (credentials) {
			this.client = new GoogleGenAI({
				vertexai: true,
				project,
				location,
				googleAuthOptions: { credentials: safeJsonParse<JWTInput>(credentials, undefined) },
			})
		} else if (this.options.vertexKeyFile) {
			this.client = new GoogleGenAI({
				vertexai: true,
				project,
				location,
				googleAuthOptions: { keyFile: this.options.vertexKeyFile },
			})
		} else {
			this.client = isVertex
				? new GoogleGenAI({ vertexai: true, project, location })
				: new GoogleGenAI({ apiKey })
		}
	}

	async *createMessage(
		systemInstruction: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { id: model, info, reasoning, maxTokens } = this.getModel()
		this.streamProcessor.lastThoughtSignature = undefined
		this.streamProcessor.lastResponseId = undefined
		const config = this.buildCreateMessageConfig(systemInstruction, messages, metadata, info, reasoning, maxTokens)
		const params: GenerateContentParameters = {
			model,
			contents: config.contents as GenerateContentParameters["contents"],
			config: config.generationConfig,
		}
		try {
			const result = await this.client.models.generateContentStream(params)
			yield* this.streamProcessor.processStream(result, info, config.includeThoughtSignatures)
		} catch (error) {
			handleGeminiError(error, this.providerName, model, "createMessage")
		}
	}

	private buildCreateMessageConfig(
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
		const maxOutputTokens = buildMaxOutputTokens(info, maxTokens, this.options.modelMaxTokens)
		const includeThoughtSignatures = shouldIncludeThoughtSignatures(thinkingConfig, metadata)
		const geminiMessages = filterReasoningMessages(messages)
		const toolIdToName = buildToolIdMap(messages)
		const contents = geminiMessages
			.map((message) => convertAnthropicMessageToGemini(message, { includeThoughtSignatures, toolIdToName }))
			.flat()

		const tools = buildGeminiTools(metadata)
		const temperatureConfig = buildTemperatureConfig(info, this.options)

		const generationConfig: GenerateContentConfig = {
			systemInstruction,
			httpOptions: this.options.googleGeminiBaseUrl ? { baseUrl: this.options.googleGeminiBaseUrl } : undefined,
			thinkingConfig: thinkingConfig as GenerateContentConfig["thinkingConfig"],
			maxOutputTokens,
			temperature: temperatureConfig,
			...(tools && tools.length > 0 ? { tools } : {}),
		}

		applyToolConfig(generationConfig, metadata)

		return { contents, generationConfig, includeThoughtSignatures }
	}

	override getModel() {
		const modelId = this.options.apiModelId
		let id = modelId && modelId in geminiModels ? (modelId as GeminiModelId) : geminiDefaultModelId
		let info: ModelInfo = geminiModels[id]

		const params = getModelParams({
			format: "gemini",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: info.defaultTemperature ?? 1,
		})

		info = {
			...info,
			excludedTools: [...new Set([...(info.excludedTools || []), "apply_diff"])],
			includedTools: [...new Set([...(info.includedTools || []), "edit"])],
		}

		return { id: id.endsWith(":thinking") ? id.replace(":thinking", "") : id, info, ...params }
	}

	async completePrompt(prompt: string): Promise<string> {
		const { id: model, info } = this.getModel()

		try {
			const temperatureConfig = buildTemperatureConfig(info, this.options)
			const promptConfig: GenerateContentConfig = {
				httpOptions: this.options.googleGeminiBaseUrl
					? { baseUrl: this.options.googleGeminiBaseUrl }
					: undefined,
				temperature: temperatureConfig,
			}

			const result = await this.client.models.generateContent({
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
			handleGeminiError(error, this.providerName, model, "completePrompt")
		}
	}

	public getThoughtSignature(): string | undefined {
		return this.streamProcessor.lastThoughtSignature
	}

	public getResponseId(): string | undefined {
		return this.streamProcessor.lastResponseId
	}
}

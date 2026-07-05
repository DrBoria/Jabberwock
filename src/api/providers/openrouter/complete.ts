import OpenAI from "openai"

import { type ModelRecord, openRouterDefaultModelInfo, DEEP_SEEK_DEFAULT_TEMPERATURE } from "@jabberwock/types"

import type { ApiHandlerOptions } from "@shared/api"
import { getModelParams } from "@api/transform/model-params"

import { applyRouterToolPreferences } from "@api/providers/utils/router-tool-preferences"

import type { OpenRouterChatCompletionParams, OpenRouterError } from "./types"
import type { OpenRouterReasoningParams } from "@api/transform/content/reasoning"
import { handleStreamingError, handleRequestError, buildRequestOptions, buildProviderConfig } from "./helpers"

export async function executeCompletePrompt(
	client: OpenAI,
	modelId: string,
	maxTokens: number | undefined,
	temperature: number | undefined,
	reasoning: OpenRouterReasoningParams | undefined,
	prompt: string,
	openRouterSpecificProvider: string | undefined,
	providerName: string,
): Promise<string> {
	const completionParams: OpenRouterChatCompletionParams = {
		model: modelId,
		max_tokens: maxTokens,
		temperature,
		messages: [{ role: "user", content: prompt }],
		stream: false,
		...(buildProviderConfig(openRouterSpecificProvider) && {
			provider: buildProviderConfig(openRouterSpecificProvider),
		}),
		...(reasoning && { reasoning }),
	}

	const requestOptions = buildRequestOptions(modelId)

	try {
		const response = await client.chat.completions.create(completionParams, requestOptions)

		if ("error" in response) {
			handleStreamingError(response.error as OpenRouterError, modelId, "completePrompt", providerName)
		}

		const completion = response as OpenAI.Chat.ChatCompletion
		return completion.choices[0]?.message?.content || ""
	} catch (error) {
		handleRequestError(error, modelId, "completePrompt", providerName)
	}
}

export function buildModelResult(id: string, models: ModelRecord, endpoints: ModelRecord, options: ApiHandlerOptions) {
	let info = models[id] ?? openRouterDefaultModelInfo

	if (options.openRouterSpecificProvider && endpoints[options.openRouterSpecificProvider]) {
		info = endpoints[options.openRouterSpecificProvider]
	}

	info = applyRouterToolPreferences(id, info)

	const isDeepSeekR1 = id.startsWith("deepseek/deepseek-r1") || id === "perplexity/sonar-reasoning"

	const params = getModelParams({
		format: "openrouter",
		modelId: id,
		model: info,
		settings: options,
		defaultTemperature: isDeepSeekR1 ? DEEP_SEEK_DEFAULT_TEMPERATURE : 0,
	})

	return { id, info, topP: isDeepSeekR1 ? 0.95 : undefined, ...params }
}

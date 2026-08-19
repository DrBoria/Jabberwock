import type { ModelInfo } from "../../models/model.ts"

// https://openai.com/api/pricing/
import { openAiNativeModels } from "./models.ts"

export type OpenAiNativeModelId = keyof typeof openAiNativeModels

export const openAiNativeDefaultModelId: OpenAiNativeModelId = "gpt-5.1-codex-max"

export { openAiNativeModels }

export const openAiModelInfoSaneDefaults: ModelInfo = {
	maxTokens: -1,
	contextWindow: 128_000,
	supportsImages: true,
	supportsPromptCache: false,
	inputPrice: 0,
	outputPrice: 0,
}

// https://learn.microsoft.com/en-us/azure/ai-services/openai/api-version-deprecation
// https://learn.microsoft.com/en-us/azure/ai-services/openai/reference#api-specs
export const azureOpenAiDefaultApiVersion = "2024-08-01-preview"

export const OPENAI_NATIVE_DEFAULT_TEMPERATURE = 0

export const OPENAI_AZURE_AI_INFERENCE_PATH = "/models/chat/completions"

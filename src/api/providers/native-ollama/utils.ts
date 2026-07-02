import OpenAI from "openai"
import { Tool as OllamaTool } from "ollama"
import { ModelInfo, openAiModelInfoSaneDefaults, DEEP_SEEK_DEFAULT_TEMPERATURE } from "@jabberwock/types"
import { getOllamaModels } from "@api/providers/fetchers/providers/ollama"
import { OllamaChatOptions } from "./types"

export function convertToolsToOllama(tools: OpenAI.Chat.ChatCompletionTool[] | undefined): OllamaTool[] | undefined {
	if (!tools || tools.length === 0) {
		return undefined
	}

	return tools
		.filter((tool): tool is OpenAI.Chat.ChatCompletionTool & { type: "function" } => tool.type === "function")
		.map((tool) => ({
			type: tool.type,
			function: {
				name: tool.function.name,
				description: tool.function.description,
				parameters: tool.function.parameters as OllamaTool["function"]["parameters"],
			},
		}))
}

export function buildChatOptions(
	options: { ollamaNumCtx?: number; modelTemperature?: number },
	useR1Format: boolean,
): OllamaChatOptions {
	const temperature = options.modelTemperature ?? (useR1Format ? DEEP_SEEK_DEFAULT_TEMPERATURE : 0)

	const chatOptions: OllamaChatOptions = {
		temperature,
	}

	if (options.ollamaNumCtx !== undefined) {
		chatOptions.num_ctx = options.ollamaNumCtx
	}

	return chatOptions
}

export function handleOllamaError(error: unknown, ollamaBaseUrl: string | undefined, modelId: string): never {
	const err = error as { message?: string; code?: string; status?: number; statusCode?: number }
	const statusCode = err.status || err.statusCode
	const errorMessage = err.message || "Unknown error"

	if (err.code === "ECONNREFUSED") {
		throw new Error(
			`Ollama service is not running at ${ollamaBaseUrl || "http://localhost:11434"}. Please start Ollama first.`,
		)
	}

	if (statusCode === 404) {
		throw new Error(
			`Model ${modelId} not found in Ollama. Please pull the model first with: ollama pull ${modelId}`,
		)
	}

	console.error(`[jabberwock] Ollama API error (${statusCode || "unknown"}): ${errorMessage}`)
	throw error
}

export async function fetchOllamaModel(
	ollamaBaseUrl: string | undefined,
	ollamaApiKey: string | undefined,
	modelId: string,
	modelsCache: Record<string, ModelInfo>,
): Promise<{ id: string; info: ModelInfo }> {
	const models = await getOllamaModels(ollamaBaseUrl, ollamaApiKey)
	return {
		id: modelId,
		info: models[modelId] || openAiModelInfoSaneDefaults,
	}
}

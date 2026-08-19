import type { ApiHandlerCreateMessageMetadata } from "@api/index"
import { getModelParams } from "@api/transform/model-params"
import { openAiCodexDefaultModelId, OpenAiCodexModelId, openAiCodexModels } from "@jabberwock/types"
import type { OpenAiCodexModel, ResponsesRequestBody } from "@api/providers/openai-codex/types"
import { formatTools } from "./tools"

type ApiHandlerOptions = import("@shared/api").ApiHandlerOptions

export function buildRequestBody(
	model: OpenAiCodexModel,
	formattedInput: ResponsesRequestBody["input"],
	systemPrompt: string,
	reasoningEffort: string | undefined,
	metadata?: ApiHandlerCreateMessageMetadata,
): ResponsesRequestBody {
	return {
		model: model.id,
		input: formattedInput,
		stream: true,
		store: false,
		instructions: systemPrompt,
		...(reasoningEffort
			? {
					include: ["reasoning.encrypted_content"],
					reasoning: { effort: reasoningEffort, summary: "auto" as const },
				}
			: {}),
		tools: formatTools(metadata?.tools),
		tool_choice: metadata?.tool_choice,
		parallel_tool_calls: metadata?.parallelToolCalls ?? true,
	}
}

export function getModel(options: ApiHandlerOptions) {
	const modelId = options.apiModelId
	const id = modelId && modelId in openAiCodexModels ? (modelId as OpenAiCodexModelId) : openAiCodexDefaultModelId
	const info = openAiCodexModels[id]
	const params = getModelParams({
		format: "openai",
		modelId: id,
		model: info,
		settings: options,
		defaultTemperature: 0,
	})
	return { id, info, ...params }
}

export function getReasoningEffort(model: OpenAiCodexModel, options: ApiHandlerOptions): string | undefined {
	const selected = options.reasoningEffort ?? model.info.reasoningEffort
	return selected && selected !== "disable" && selected !== "none" ? selected : undefined
}

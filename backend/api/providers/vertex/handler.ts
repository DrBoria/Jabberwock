import { type ModelInfo, type VertexModelId, vertexDefaultModelId, vertexModels } from "@jabberwock/types"

import type { ApiHandlerOptions } from "@shared/api"

import { getModelParams } from "@api/transform/model-params"

import { GeminiHandler } from "@api/providers/gemini"

export function VertexHandler(options: ApiHandlerOptions) {
	const base = GeminiHandler({ ...options, isVertex: true })
	const handler = {
		...base,
		getModel() {
			const modelId = handler.options.apiModelId
			let id = modelId && modelId in vertexModels ? (modelId as VertexModelId) : vertexDefaultModelId
			let info: ModelInfo = vertexModels[id]
			const params = getModelParams({
				format: "gemini",
				modelId: id,
				model: info,
				settings: handler.options,
				defaultTemperature: info.defaultTemperature ?? 1,
			})
			// Vertex Gemini models perform better with the edit tool instead of apply_diff.
			info = {
				...info,
				excludedTools: [...new Set([...(info.excludedTools || []), "apply_diff"])],
				includedTools: [...new Set([...(info.includedTools || []), "edit"])],
			}
			// The `:thinking` suffix indicates that the model is a "Hybrid"
			// reasoning model and that reasoning is required to be enabled.
			// The actual model ID honored by Gemini's API does not have this
			// suffix.
			return { id: id.endsWith(":thinking") ? id.replace(":thinking", "") : id, info, ...params }
		},
	}
	return handler
}

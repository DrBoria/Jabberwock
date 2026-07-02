import { IMAGE_GENERATION_MODEL_IDS, IMAGE_GENERATION_MODELS } from "@jabberwock/types"
import type { ITaskModel } from "@features/chat/task/store"
import { sayAndCreateMissingParamError } from "@features/chat/task/messages/actions/command/sayAndCreateMissingParamError"
import type { PushToolResult } from "@shared/tools"

export interface ResolvedImageModel {
	selectedModel: string
	apiMethod: string | undefined
}

export async function validateImageParams(
	prompt: string | undefined,
	relPath: string | undefined,
	task: ITaskModel,
	pushToolResult: (content: string) => void,
): Promise<boolean> {
	if (!prompt) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("generate_image")
		pushToolResult(await sayAndCreateMissingParamError(task.taskId, "generate_image", "prompt"))
		return false
	}
	if (!relPath) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("generate_image")
		pushToolResult(await sayAndCreateMissingParamError(task.taskId, "generate_image", "path"))
		return false
	}
	return true
}

export function resolveImageModel(selectedModel: string | undefined, imageProvider: string): ResolvedImageModel {
	let model = selectedModel
	let modelInfo: { value: string; provider: string; apiMethod?: string } | undefined

	if (model) {
		modelInfo = IMAGE_GENERATION_MODELS.find((m) => m.value === model && m.provider === imageProvider)
		if (!modelInfo) {
			const providerModels = IMAGE_GENERATION_MODELS.filter((m) => m.provider === imageProvider)
			modelInfo = providerModels[0]
			model = modelInfo?.value || IMAGE_GENERATION_MODEL_IDS[0]
		}
	} else {
		const providerModels = IMAGE_GENERATION_MODELS.filter((m) => m.provider === imageProvider)
		modelInfo = providerModels[0]
		model = modelInfo?.value || IMAGE_GENERATION_MODEL_IDS[0]
	}

	return {
		selectedModel: model as string,
		apiMethod: modelInfo?.apiMethod,
	}
}

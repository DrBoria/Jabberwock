import { GenerateImageParams } from "@jabberwock/types"
import type { ITaskModel } from "@features/chat/task/store"
import { formatResponse } from "@features/settings/context/responses"
import { EXPERIMENT_IDS, experiments } from "@shared/experiments"
import { BaseTool, ToolCallbacks } from "@features/chat/tools/a-b/BaseTool"
import type { ToolUse } from "@shared/tools"
import { validateImageParams, executeImageFlow } from "@features/chat/tools/helpers/generate-image"

export class GenerateImageTool extends BaseTool<"generate_image"> {
	readonly name = "generate_image" as const

	async execute(params: GenerateImageParams, task: ITaskModel, callbacks: ToolCallbacks): Promise<void> {
		const { prompt, path: relPath, image: inputImagePath } = params
		const { handleError, pushToolResult, askApproval } = callbacks

		try {
			if (!experiments.isEnabled({}, EXPERIMENT_IDS.IMAGE_GENERATION)) {
				pushToolResult(
					formatResponse.toolError(
						"Image generation is an experimental feature that must be enabled in settings. Please enable 'Image Generation' in the Experimental Settings section.",
					),
				)
				return
			}

			if (!(await validateImageParams(prompt, relPath, task, pushToolResult))) return

			await executeImageFlow(prompt, relPath, inputImagePath, task, { askApproval, pushToolResult })
		} catch (error) {
			await handleError("generating image", error as Error)
		}
	}

	override async handlePartial(_task: ITaskModel, _block: ToolUse<"generate_image">): Promise<void> {
		return
	}
}

export const generateImageTool = new GenerateImageTool()

import path from "path"
import { formatResponse } from "@features/settings/context/responses"
import { getReadablePath } from "@utils/io/path"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "@shared/tools"
import type { ITaskModel } from "@features/chat/task/store"
import { buildApiHandler } from "@api"
import { ask } from "@features/chat/task/notifications/actions/ask"
import { sayAndCreateMissingParamError } from "@features/chat/task/messages/actions/command/sayAndCreateMissingParamError"

import { getVirtualWorkspace } from "@features/foundation/time-machine/actions/getTimeMachine"
import { validateAccess } from "@utils/ignore"

/**
 * Validates that the image file exists at the given path.
 */
async function validateImagePath(task: ITaskModel, fullPath: string, _relPath: string): Promise<boolean> {
	try {
		await getVirtualWorkspace().stat(fullPath)
		return true
	} catch {
		return false
	}
}

/**
 * Reads the image, validates format, calls the API for analysis, and returns the result text.
 * Returns undefined if the analysis fails or format is unsupported.
 */
async function callImageAnalysisApi(
	task: ITaskModel,
	fullPath: string,
	relPath: string,
	prompt: string,
	pushToolResult: ToolCallbacks["pushToolResult"],
): Promise<string | undefined> {
	const imageBuffer = await getVirtualWorkspace().readBuffer(fullPath)
	const imageExtension = path.extname(fullPath).toLowerCase().replace(".", "")
	const supportedFormats = ["png", "jpg", "jpeg", "gif", "webp"]

	if (!supportedFormats.includes(imageExtension)) {
		pushToolResult(formatResponse.toolError(`Unsupported format: ${imageExtension}`))
		return undefined
	}

	const mimeType = imageExtension === "jpg" ? "jpeg" : imageExtension
	const base64Data = imageBuffer.toString("base64")

	const apiConfig = task.apiConfiguration
	if (!apiConfig) {
		pushToolResult(formatResponse.toolError("No API configuration found."))
		return undefined
	}

	const apiHandler = buildApiHandler(apiConfig)
	let resultText = ""

	try {
		const stream = apiHandler.createMessage("You are an expert visual layout and graphic analyzer.", [
			{
				role: "user",
				content: [
					{ type: "text", text: prompt },
					{
						type: "image",
						source: {
							type: "base64",
							media_type: `image/${mimeType}` as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
							data: base64Data,
						},
					},
				],
			},
		])

		for await (const chunk of stream) {
			if (chunk.type === "text") {
				resultText += chunk.text
			}
		}
	} catch (apiError) {
		pushToolResult(
			formatResponse.toolError(
				`API Error analyzing image: ${apiError instanceof Error ? apiError.message : String(apiError)}`,
			),
		)
		return undefined
	}

	if (!resultText) {
		pushToolResult(formatResponse.toolError("Received empty analysis from the model."))
		return undefined
	}

	return `Analysis of ${relPath}:\n\n${resultText}`
}

export class AnalyzeImageTool extends BaseTool<"analyze_image"> {
	name = "analyze_image" as const

	async execute(
		params: { path: string; prompt?: string },
		task: ITaskModel,
		callbacks: ToolCallbacks,
	): Promise<void> {
		const { path: relPath, prompt = "Analyze and describe this image in detail." } = params
		const { pushToolResult, askApproval, handleError } = callbacks

		if (!relPath) {
			task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
			task.recordToolError("analyze_image")
			pushToolResult(await sayAndCreateMissingParamError(task.taskId, "analyze_image", "path"))
			return
		}

		try {
			const fullPath = path.resolve(task.cwd, relPath)
			const validated = await validateImagePath(task, fullPath, relPath)
			if (!validated) {
				pushToolResult(formatResponse.toolError(`Image not found: ${getReadablePath(task.cwd, relPath)}`))
				return
			}

			const accessAllowed = validateAccess(task.jabberwockIgnoreController, relPath, task.cwd)
			if (!accessAllowed) {
				pushToolResult(formatResponse.jabberwockIgnoreError(relPath))
				return
			}

			task._state.setConsecutiveMistakeCount(0)

			const approvalMessage = JSON.stringify({
				tool: "analyzeImage",
				path: getReadablePath(task.cwd, relPath),
				content: prompt,
			})

			const didApprove = await askApproval("tool", approvalMessage)
			if (!didApprove) return

			const result = await callImageAnalysisApi(task, fullPath, relPath, prompt, pushToolResult)
			if (result) {
				task.recordToolUsage("analyze_image")
				pushToolResult(result)
			}
		} catch (error) {
			await handleError("analyzing image", error instanceof Error ? error : new Error(String(error)))
		}
	}

	override async handlePartial(task: ITaskModel, block: ToolUse<"analyze_image">): Promise<void> {
		const relPath = block.params.path
		const prompt = block.params.prompt || ""

		const partialMessage = JSON.stringify({
			tool: "analyzeImage",
			path: relPath ?? "",
			content: prompt,
		})

		await ask(task.taskId, "tool", partialMessage, block.partial).catch(() => {})
	}
}

export const analyzeImageTool = new AnalyzeImageTool()

import path from "path"
import fs from "fs/promises"
import * as vscode from "vscode"
import {
	GenerateImageParams,
	IMAGE_GENERATION_MODEL_IDS,
	IMAGE_GENERATION_MODELS,
	getImageGenerationProvider,
	type ImageGenerationProvider,
} from "@jabberwock/types"
import type { ITaskModel } from "../../../features/chat/task/store"
import { formatResponse } from "../../settings/context/responses"
import { fileExistsAtPath } from "../../../utils/fs"
import { getReadablePath } from "../../../utils/path"
import { isPathOutsideWorkspace } from "../../../utils/pathUtils"
import { EXPERIMENT_IDS, experiments } from "../../../shared/experiments"
import { OpenRouterHandler } from "../../../api/providers/openrouter"
import { RooHandler } from "../../../api/providers/jabberwock"
import { ApiHandlerOptions } from "../../../shared/api"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../../shared/tools"
import { t } from "../../../i18n"
import { systemBroadcast, userBroadcast } from "../task/messages/actions/say"
import { sayAndCreateMissingParamError } from "../task/messages/actions/missingParamError"

import { getFileContextTracker } from "../../../features/foundation/time-machine/actions/getTimeMachine"
import { validateAccess } from "@utils/ignore"
import { getSettingsAccess } from "@utils/settings-access"

export class GenerateImageTool extends BaseTool<"generate_image"> {
	readonly name = "generate_image" as const

	async execute(params: GenerateImageParams, task: ITaskModel, callbacks: ToolCallbacks): Promise<void> {
		const { prompt, path: relPath, image: inputImagePath } = params
		const { handleError, pushToolResult, askApproval } = callbacks
		const contextValues = getSettingsAccess().getValues()

		const isImageGenerationEnabled = experiments.isEnabled({}, EXPERIMENT_IDS.IMAGE_GENERATION)

		if (!isImageGenerationEnabled) {
			pushToolResult(
				formatResponse.toolError(
					"Image generation is an experimental feature that must be enabled in settings. Please enable 'Image Generation' in the Experimental Settings section.",
				),
			)
			return
		}

		if (!prompt) {
			task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
			task.recordToolError("generate_image")
			pushToolResult(await sayAndCreateMissingParamError(task.taskId, "generate_image", "prompt"))
			return
		}

		if (!relPath) {
			task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
			task.recordToolError("generate_image")
			pushToolResult(await sayAndCreateMissingParamError(task.taskId, "generate_image", "path"))
			return
		}

		const accessAllowed = validateAccess(task.jabberwockIgnoreController, relPath, task.cwd)
		if (!accessAllowed) {
			await systemBroadcast(task.taskId, "rooignore_error", relPath)
			pushToolResult(formatResponse.jabberwockIgnoreError(relPath))
			return
		}

		let inputImageData: string | undefined
		if (inputImagePath) {
			const inputImageFullPath = path.resolve(task.cwd, inputImagePath)

			const inputImageExists = await fileExistsAtPath(inputImageFullPath)
			if (!inputImageExists) {
				await systemBroadcast(
					task.taskId,
					"error",
					`Input image not found: ${getReadablePath(task.cwd, inputImagePath)}`,
				)
				task._state.setDidToolFailInCurrentTurn(true)
				pushToolResult(
					formatResponse.toolError(`Input image not found: ${getReadablePath(task.cwd, inputImagePath)}`),
				)
				return
			}

			const inputImageAccessAllowed = task.jabberwockIgnoreController
				? validateAccess(task.jabberwockIgnoreController, inputImagePath, task.cwd)
				: true
			if (!inputImageAccessAllowed) {
				await systemBroadcast(task.taskId, "rooignore_error", inputImagePath)
				pushToolResult(formatResponse.jabberwockIgnoreError(inputImagePath))
				return
			}

			try {
				const imageBuffer = await fs.readFile(inputImageFullPath)
				const imageExtension = path.extname(inputImageFullPath).toLowerCase().replace(".", "")

				const supportedFormats = ["png", "jpg", "jpeg", "gif", "webp"]
				if (!supportedFormats.includes(imageExtension)) {
					await systemBroadcast(
						task.taskId,
						"error",
						`Unsupported image format: ${imageExtension}. Supported formats: ${supportedFormats.join(", ")}`,
					)
					task._state.setDidToolFailInCurrentTurn(true)
					pushToolResult(
						formatResponse.toolError(
							`Unsupported image format: ${imageExtension}. Supported formats: ${supportedFormats.join(", ")}`,
						),
					)
					return
				}

				const mimeType = imageExtension === "jpg" ? "jpeg" : imageExtension
				inputImageData = `data:image/${mimeType};base64,${imageBuffer.toString("base64")}`
			} catch (error) {
				await systemBroadcast(
					task.taskId,
					"error",
					`Failed to read input image: ${error instanceof Error ? error.message : "Unknown error"}`,
				)
				task._state.setDidToolFailInCurrentTurn(true)
				pushToolResult(
					formatResponse.toolError(
						`Failed to read input image: ${error instanceof Error ? error.message : "Unknown error"}`,
					),
				)
				return
			}
		}

		const isFileWriteProtected = isWriteProtected(task.cwd, relPath)

		// Use shared utility for backwards compatibility logic
		const imageProvider = getImageGenerationProvider(
			contextValues.imageGenerationProvider as ImageGenerationProvider | undefined,
			!!contextValues.openRouterImageGenerationSelectedModel,
		)

		// Get the selected model
		let selectedModel = contextValues.openRouterImageGenerationSelectedModel
		let modelInfo = undefined

		// Find the model info matching both value AND provider
		// (since the same model value can exist for multiple providers)
		if (selectedModel) {
			modelInfo = IMAGE_GENERATION_MODELS.find((m) => m.value === selectedModel && m.provider === imageProvider)
			if (!modelInfo) {
				// Model doesn't exist for this provider, use first model for selected provider
				const providerModels = IMAGE_GENERATION_MODELS.filter((m) => m.provider === imageProvider)
				modelInfo = providerModels[0]
				selectedModel = modelInfo?.value || IMAGE_GENERATION_MODEL_IDS[0]
			}
		} else {
			// No model selected, use first model for selected provider
			const providerModels = IMAGE_GENERATION_MODELS.filter((m) => m.provider === imageProvider)
			modelInfo = providerModels[0]
			selectedModel = modelInfo?.value || IMAGE_GENERATION_MODEL_IDS[0]
		}

		// Use the provider selection
		const modelProvider = imageProvider
		const apiMethod = modelInfo?.apiMethod

		// Validate API key for OpenRouter
		const openRouterApiKey = contextValues.openRouterImageApiKey

		if (imageProvider === "openrouter" && !openRouterApiKey) {
			const errorMessage = t("tools:generateImage.openRouterApiKeyRequired")
			await systemBroadcast(task.taskId, "error", errorMessage)
			pushToolResult(formatResponse.toolError(errorMessage))
			return
		}

		const fullPath = path.resolve(task.cwd, relPath)
		const isOutsideWorkspace = isPathOutsideWorkspace(fullPath)

		const sharedMessageProps = {
			tool: "generateImage" as const,
			path: getReadablePath(task.cwd, relPath),
			content: prompt,
			isOutsideWorkspace,
			isProtected: isFileWriteProtected,
		}

		try {
			task._state.setConsecutiveMistakeCount(0)

			const approvalMessage = JSON.stringify({
				...sharedMessageProps,
				content: prompt,
				...(inputImagePath && { inputImage: getReadablePath(task.cwd, inputImagePath) }),
			})

			const didApprove = await askApproval("tool", approvalMessage, undefined, isFileWriteProtected)

			if (!didApprove) {
				return
			}

			let result
			if (modelProvider === "jabberwock") {
				// Use Jabberwock Cloud provider (supports both chat completions and images API)
				const rooHandler = new RooHandler({} as ApiHandlerOptions)
				result = await rooHandler.generateImage(prompt, selectedModel as string, inputImageData, apiMethod)
			} else {
				// Use OpenRouter provider (only supports chat completions API)
				const openRouterHandler = new OpenRouterHandler({} as ApiHandlerOptions)
				result = await openRouterHandler.generateImage(
					prompt,
					selectedModel as string,
					openRouterApiKey as string,
					inputImageData,
				)
			}

			if (!result.success) {
				await systemBroadcast(task.taskId, "error", result.error || "Failed to generate image")
				task._state.setDidToolFailInCurrentTurn(true)
				pushToolResult(formatResponse.toolError(result.error || "Failed to generate image"))
				return
			}

			if (!result.imageData) {
				const errorMessage = "No image data received"
				await systemBroadcast(task.taskId, "error", errorMessage)
				task._state.setDidToolFailInCurrentTurn(true)
				pushToolResult(formatResponse.toolError(errorMessage))
				return
			}

			const base64Match = result.imageData.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/)
			if (!base64Match) {
				const errorMessage = "Invalid image format received"
				await systemBroadcast(task.taskId, "error", errorMessage)
				task._state.setDidToolFailInCurrentTurn(true)
				pushToolResult(formatResponse.toolError(errorMessage))
				return
			}

			const imageFormat = base64Match[1]
			const base64Data = base64Match[2]

			let finalPath = relPath
			if (!finalPath.match(/\.(png|jpg|jpeg)$/i)) {
				finalPath = `${finalPath}.${imageFormat === "jpeg" ? "jpg" : imageFormat}`
			}

			const imageBuffer = Buffer.from(base64Data, "base64")

			const absolutePath = path.resolve(task.cwd, finalPath)
			const directory = path.dirname(absolutePath)
			await fs.mkdir(directory, { recursive: true })

			await fs.writeFile(absolutePath, imageBuffer)

			if (finalPath) {
				await getFileContextTracker().trackFileContext(finalPath, "roo_edited")
			}

			task.didEditFile = true

			task.recordToolUsage("generate_image")

			const fullImagePath = path.join(task.cwd, finalPath)

			let imageUri = vscode.Uri.file(fullImagePath).toString()

			const cacheBuster = Date.now()
			imageUri = imageUri.includes("?") ? `${imageUri}&t=${cacheBuster}` : `${imageUri}?t=${cacheBuster}`

			await userBroadcast(task.taskId, "image", JSON.stringify({ imageUri, imagePath: fullImagePath }))
			pushToolResult(formatResponse.toolResult(getReadablePath(task.cwd, finalPath)))
		} catch (error) {
			await handleError("generating image", error as Error)
		}
	}

	override async handlePartial(task: ITaskModel, block: ToolUse<"generate_image">): Promise<void> {
		return
	}
}

import { isWriteProtected } from "@utils/protect"
export const generateImageTool = new GenerateImageTool()

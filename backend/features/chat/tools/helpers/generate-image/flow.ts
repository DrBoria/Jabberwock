import path from "path"
import {
	getImageGenerationProvider,
	type ImageGenerationProvider,
	type ImageGenerationApiMethod,
} from "@jabberwock/types"
import { formatResponse } from "@features/settings/context/responses"
import { getReadablePath } from "@utils/io/path"
import type { ITaskModel } from "@features/chat/task/store"
import { t } from "@i18n"
import { systemBroadcast, userBroadcast } from "@features/chat/task/messages/actions/say"
import { validateAccess } from "@utils/ignore"
import { getSettingsAccess } from "@utils/settings"
import { isWriteProtected } from "@utils/protect"
import { isPathOutsideWorkspace } from "@utils/io"
import type { AskApproval, PushToolResult } from "@shared/tools"
import { resolveImageModel } from "./validation"
import { readInputImage, saveGeneratedImage } from "./io"

export async function executeImageFlow(
	prompt: string | undefined,
	relPath: string | undefined,
	inputImagePath: string | undefined,
	task: ITaskModel,
	callbacks: { askApproval: AskApproval; pushToolResult: PushToolResult },
): Promise<void> {
	const contextValues = getSettingsAccess().getValues()
	const { askApproval, pushToolResult } = callbacks

	const accessAllowed = validateAccess(task.jabberwockIgnoreController, relPath!, task.cwd)
	if (!accessAllowed) {
		await systemBroadcast(task.taskId, "rooignore_error", relPath!)
		pushToolResult(formatResponse.jabberwockIgnoreError(relPath!))
		return
	}

	let inputImageData: string | undefined
	if (inputImagePath) {
		inputImageData = await readInputImage(inputImagePath, task.cwd, task, pushToolResult)
		if (!inputImageData) return
	}

	const isFileWriteProtected = isWriteProtected(task.cwd, relPath!)
	const imageProvider = getImageGenerationProvider(
		contextValues.imageGenerationProvider as ImageGenerationProvider | undefined,
		!!contextValues.openRouterImageGenerationSelectedModel,
	)

	const { selectedModel, apiMethod } = resolveImageModel(
		contextValues.openRouterImageGenerationSelectedModel,
		imageProvider,
	)

	const openRouterApiKey = contextValues.openRouterImageApiKey
	if (imageProvider === "openrouter" && !openRouterApiKey) {
		const errorMessage = t("tools:generateImage.openRouterApiKeyRequired")
		await systemBroadcast(task.taskId, "error", errorMessage)
		pushToolResult(formatResponse.toolError(errorMessage))
		return
	}

	const fullPath = path.resolve(task.cwd, relPath!)
	const isOutsideWorkspace = isPathOutsideWorkspace(fullPath)

	const sharedMessageProps = {
		tool: "generateImage" as const,
		path: getReadablePath(task.cwd, relPath!),
		content: prompt,
		isOutsideWorkspace,
		isProtected: isFileWriteProtected,
	}

	task._state.setConsecutiveMistakeCount(0)

	const approvalMessage = JSON.stringify({
		...sharedMessageProps,
		content: prompt,
		...(inputImagePath && { inputImage: getReadablePath(task.cwd, inputImagePath) }),
	})

	const didApprove = await askApproval("tool", approvalMessage, undefined, isFileWriteProtected)
	if (!didApprove) return

	const genResult = await executeImageGenerationAndValidate(
		imageProvider,
		prompt!,
		selectedModel,
		inputImageData,
		openRouterApiKey,
		apiMethod as ImageGenerationApiMethod | undefined,
		task,
		pushToolResult,
	)
	if (!genResult) return

	const savedInfo = await saveGeneratedImage(
		genResult.base64Data,
		genResult.imageFormat,
		relPath!,
		task.cwd,
		task,
		pushToolResult,
	)
	await userBroadcast(
		task.taskId,
		"image",
		JSON.stringify({
			imageUri: savedInfo.imageUri,
			imagePath: savedInfo.fullImagePath,
		}),
	)
}

import { OpenRouterHandler } from "@api/providers/openrouter"
import { RooHandler } from "@api/providers/jabberwock"

async function executeImageGenerationAndValidate(
	imageProvider: string,
	prompt: string,
	selectedModel: string,
	inputImageData: string | undefined,
	openRouterApiKey: string | undefined,
	apiMethod: ImageGenerationApiMethod | undefined,
	task: ITaskModel,
	pushToolResult: PushToolResult,
): Promise<{ base64Data: string; imageFormat: string } | null> {
	type ApiHandlerOptions = import("@shared/api").ApiHandlerOptions

	let result
	if (imageProvider === "jabberwock") {
		const rooHandler = new RooHandler({} as ApiHandlerOptions)
		result = await rooHandler.generateImage(prompt, selectedModel, inputImageData, apiMethod)
	} else {
		const openRouterHandler = new OpenRouterHandler({} as ApiHandlerOptions)
		result = await openRouterHandler.generateImage(prompt, selectedModel, openRouterApiKey!, inputImageData)
	}

	if (!result.success) {
		const errorText = result.error || "Failed to generate image"
		await systemBroadcast(task.taskId, "error", errorText)
		task._state.setDidToolFailInCurrentTurn(true)
		pushToolResult(formatResponse.toolError(errorText))
		return null
	}

	if (!result.imageData) {
		await systemBroadcast(task.taskId, "error", "No image data received")
		task._state.setDidToolFailInCurrentTurn(true)
		pushToolResult(formatResponse.toolError("No image data received"))
		return null
	}

	const base64Match = result.imageData.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/)
	if (!base64Match) {
		await systemBroadcast(task.taskId, "error", "Invalid image format received")
		task._state.setDidToolFailInCurrentTurn(true)
		pushToolResult(formatResponse.toolError("Invalid image format received"))
		return null
	}

	return { base64Data: base64Match[2], imageFormat: base64Match[1] }
}

import fs from "fs/promises"
import path from "path"
import * as vscode from "vscode"
import { formatResponse } from "@features/settings/context/responses"
import { fileExistsAtPath } from "@utils/io/fs"
import { getReadablePath } from "@utils/io/path"
import type { ITaskModel } from "@features/chat/task/store"
import { systemBroadcast } from "@features/chat/task/messages/actions/say"
import { getFileContextTracker } from "@features/foundation/time-machine/actions/getTimeMachine"
import { validateAccess } from "@utils/ignore"
import type { PushToolResult } from "@shared/tools"

export interface SavedImageInfo {
	imageUri: string
	fullImagePath: string
}

export async function readInputImage(
	inputImagePath: string,
	cwd: string,
	task: ITaskModel,
	pushToolResult: PushToolResult,
): Promise<string | undefined> {
	const inputImageFullPath = path.resolve(cwd, inputImagePath)
	const inputImageExists = await fileExistsAtPath(inputImageFullPath)
	if (!inputImageExists) {
		await systemBroadcast(task.taskId, "error", `Input image not found: ${getReadablePath(cwd, inputImagePath)}`)
		task._state.setDidToolFailInCurrentTurn(true)
		pushToolResult(formatResponse.toolError(`Input image not found: ${getReadablePath(cwd, inputImagePath)}`))
		return undefined
	}

	const inputImageAccessAllowed = task.jabberwockIgnoreController
		? validateAccess(task.jabberwockIgnoreController, inputImagePath, cwd)
		: true
	if (!inputImageAccessAllowed) {
		await systemBroadcast(task.taskId, "rooignore_error", inputImagePath)
		pushToolResult(formatResponse.jabberwockIgnoreError(inputImagePath))
		return undefined
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
			return undefined
		}
		const mimeType = imageExtension === "jpg" ? "jpeg" : imageExtension
		return `data:image/${mimeType};base64,${imageBuffer.toString("base64")}`
	} catch (error) {
		const msg = error instanceof Error ? error.message : "Unknown error"
		await systemBroadcast(task.taskId, "error", `Failed to read input image: ${msg}`)
		task._state.setDidToolFailInCurrentTurn(true)
		pushToolResult(formatResponse.toolError(`Failed to read input image: ${msg}`))
		return undefined
	}
}

export async function saveGeneratedImage(
	base64Data: string,
	imageFormat: string,
	relPath: string,
	cwd: string,
	task: ITaskModel,
	pushToolResult: PushToolResult,
): Promise<SavedImageInfo> {
	let finalPath = relPath
	if (!finalPath.match(/\.(png|jpg|jpeg)$/i)) {
		finalPath = `${finalPath}.${imageFormat === "jpeg" ? "jpg" : imageFormat}`
	}

	const imageBuffer = Buffer.from(base64Data, "base64")
	const absolutePath = path.resolve(cwd, finalPath)
	const directory = path.dirname(absolutePath)
	await fs.mkdir(directory, { recursive: true })
	await fs.writeFile(absolutePath, imageBuffer)

	if (finalPath) {
		await getFileContextTracker().trackFileContext(finalPath, "roo_edited")
	}

	task.didEditFile = true
	task.recordToolUsage("generate_image")

	const fullImagePath = path.join(cwd, finalPath)
	const cacheBuster = Date.now()
	const imageUri = vscode.Uri.file(fullImagePath).toString()
	const finalUri = imageUri.includes("?") ? `${imageUri}&t=${cacheBuster}` : `${imageUri}?t=${cacheBuster}`

	pushToolResult(formatResponse.toolResult(getReadablePath(cwd, finalPath)))
	return { imageUri: finalUri, fullImagePath }
}

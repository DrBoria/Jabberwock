import path from "path"

import type { ITaskModel } from "@features/chat/task/store"
import { RecordSource } from "@features/foundation/time-machine/file-context/FileContextTrackerTypes"
import { extractTextFromFile } from "@integrations/misc/extract-text"
import { SUPPORTED_BINARY_FORMATS } from "@integrations/misc/extract-text/helpers"
import { addLineNumbers } from "@integrations/misc/extract-text/helpers"

import {
	isSupportedImageFormat,
	validateImageForProcessing,
	processImageFile,
	type ImageMemoryTracker,
} from "@features/chat/tools/helpers/generate-image/imageHelpers"
import { systemBroadcast } from "@features/chat/task/messages/actions/say"

import { getFileContextTracker } from "@features/foundation/time-machine/actions/getTimeMachine"

import type { FileResult } from "./readFileHelpers"
import { getErrorMessage } from "./readFileHelpers"

// ─── Image File Processing ────────────────────────────────────────────────────────

export async function handleImageFileProcessing(
	task: ITaskModel,
	relPath: string,
	fullPath: string,
	supportsImages: boolean,
	maxImageFileSize: number,
	maxTotalImageSize: number,
	imageMemoryTracker: ImageMemoryTracker,
	updateFileResult: (path: string, updates: Partial<FileResult>) => void,
): Promise<void> {
	try {
		const validationResult = await validateImageForProcessing(
			fullPath,
			supportsImages,
			maxImageFileSize,
			maxTotalImageSize,
			imageMemoryTracker.getTotalMemoryUsed(),
		)

		if (!validationResult.isValid) {
			await getFileContextTracker().trackFileContext(relPath, "read_tool" as RecordSource)
			updateFileResult(relPath, {
				nativeContent: `File: ${relPath}\nNote: ${validationResult.notice}`,
			})
			return
		}

		const imageResult = await processImageFile(fullPath)
		imageMemoryTracker.addMemoryUsage(imageResult.sizeInMB)
		await getFileContextTracker().trackFileContext(relPath, "read_tool" as RecordSource)

		updateFileResult(relPath, {
			nativeContent: `File: ${relPath}\nNote: ${imageResult.notice}`,
			imageDataUrl: imageResult.dataUrl,
		})
	} catch (error) {
		const errorMsg = getErrorMessage(error)
		updateFileResult(relPath, {
			status: "error",
			error: `Error reading image file: ${errorMsg}`,
			nativeContent: `File: ${relPath}\nError: ${errorMsg}`,
		})
		await systemBroadcast(task.taskId, "error", `Error reading image file ${relPath}: ${errorMsg}`)
	}
}

// ─── Supported Binary Format Handling ─────────────────────────────────────────────

export async function handleSupportedBinaryFormat(
	task: ITaskModel,
	relPath: string,
	fullPath: string,
	updateFileResult: (path: string, updates: Partial<FileResult>) => void,
): Promise<void> {
	try {
		const content = await extractTextFromFile(fullPath)
		const numberedContent = addLineNumbers(content)
		const lineCount = content.split("\n").length

		await getFileContextTracker().trackFileContext(relPath, "read_tool" as RecordSource)

		updateFileResult(relPath, {
			nativeContent:
				lineCount > 0
					? `File: ${relPath}\nLines 1-${lineCount}:\n${numberedContent}`
					: `File: ${relPath}\nNote: File is empty`,
		})
	} catch (error) {
		const errorMsg = getErrorMessage(error)
		updateFileResult(relPath, {
			status: "error",
			error: `Error extracting text: ${errorMsg}`,
			nativeContent: `File: ${relPath}\nError: ${errorMsg}`,
		})
		await systemBroadcast(task.taskId, "error", `Error extracting text from ${relPath}: ${errorMsg}`)
	}
}

// ─── Unsupported Binary Format Handling ────────────────────────────────────────────

export function handleUnsupportedBinaryFormat(
	relPath: string,
	fileExtension: string,
	updateFileResult: (path: string, updates: Partial<FileResult>) => void,
): void {
	const fileFormat = fileExtension.slice(1) || "bin"
	updateFileResult(relPath, {
		notice: `Binary file format: ${fileFormat}`,
		nativeContent: `File: ${relPath}\nBinary file (${fileFormat}) - content not displayed`,
	})
}

// ─── Binary File Dispatcher ────────────────────────────────────────────────────────

export async function handleBinaryFile(
	task: ITaskModel,
	relPath: string,
	fullPath: string,
	supportsImages: boolean,
	maxImageFileSize: number,
	maxTotalImageSize: number,
	imageMemoryTracker: ImageMemoryTracker,
	updateFileResult: (path: string, updates: Partial<FileResult>) => void,
): Promise<void> {
	const fileExtension = path.extname(relPath).toLowerCase()
	const supportedBinaryFormats = Object.keys(SUPPORTED_BINARY_FORMATS)

	if (isSupportedImageFormat(fileExtension)) {
		await handleImageFileProcessing(
			task,
			relPath,
			fullPath,
			supportsImages,
			maxImageFileSize,
			maxTotalImageSize,
			imageMemoryTracker,
			updateFileResult,
		)
		return
	}

	if (supportedBinaryFormats?.includes(fileExtension)) {
		await handleSupportedBinaryFormat(task, relPath, fullPath, updateFileResult)
		return
	}

	handleUnsupportedBinaryFormat(relPath, fileExtension, updateFileResult)
}

import path from "path"
import { isBinaryFile } from "isbinaryfile"

import type { FileEntry, LineRange } from "@jabberwock/types"
import type { SayToolData } from "@jabberwock/types"

import type { ITaskModel } from "@features/chat/task/store"
import { formatResponse } from "@features/settings/context/responses"
import { isPathOutsideWorkspace } from "@utils/io"
import { getReadablePath } from "@utils/io/path"
import { readWithSlice } from "@integrations/misc/indentation-reader"
import { DEFAULT_LINE_LIMIT } from "@features/settings/context/tools/native-tools/r/read_file"

import {
	DEFAULT_MAX_IMAGE_FILE_SIZE_MB,
	DEFAULT_MAX_TOTAL_IMAGE_SIZE_MB,
	isSupportedImageFormat,
	validateImageForProcessing,
	processImageFile,
} from "@features/chat/tools/helpers/generate-image/imageHelpers"
import { ask } from "@features/chat/task/notifications/actions/ask"
import { systemBroadcast, userBroadcast } from "@features/chat/task/messages/actions/say"

import { validateAccess } from "@utils/ignore"

import { getVirtualWorkspace, getFileContextTracker } from "@features/foundation/time-machine/actions/getTimeMachine"

import { getErrorMessage } from "./readFileHelpers"

// ─── Legacy Binary File Handling ──────────────────────────────────────────────────

async function handleLegacyBinaryFile(relPath: string, fullPath: string, supportsImages: boolean): Promise<string> {
	const fileExtension = path.extname(relPath).toLowerCase()

	if (supportsImages && isSupportedImageFormat(fileExtension)) {
		const validation = await validateImageForProcessing(
			fullPath,
			supportsImages,
			DEFAULT_MAX_IMAGE_FILE_SIZE_MB as number,
			DEFAULT_MAX_TOTAL_IMAGE_SIZE_MB,
			0,
		)
		if (!validation.isValid) {
			return `File: ${relPath}\nNotice: ${validation.notice ?? "Image validation failed"}`
		}
		await processImageFile(fullPath)
		return `File: ${relPath}\n[Image file - content processed for vision model]`
	}

	return `File: ${relPath}\nError: Cannot read binary file`
}

// ─── Legacy File Reading with Ranges ──────────────────────────────────────────────

async function readLegacyFileWithRanges(rawContent: string, lineRanges: LineRange[]): Promise<string> {
	const lines = rawContent.split("\n")
	const selectedLines: string[] = []

	for (const range of lineRanges) {
		const startIdx = Math.max(0, range.start - 1)
		const endIdx = Math.min(lines.length - 1, range.end - 1)

		for (let i = startIdx; i <= endIdx; i++) {
			selectedLines.push(`${i + 1} | ${lines[i]}`)
		}
	}

	return selectedLines.join("\n")
}

// ─── Legacy File Content Reading ──────────────────────────────────────────────────

async function readLegacyFileContent(rawContent: string, lineRanges: LineRange[] | undefined): Promise<string> {
	if (lineRanges && lineRanges.length > 0) {
		return readLegacyFileWithRanges(rawContent, lineRanges)
	}

	const result = readWithSlice(rawContent, 0, DEFAULT_LINE_LIMIT)
	let content = result.content

	if (result.wasTruncated) {
		content += `\n\n[File truncated: showing ${result.returnedLines} of ${result.totalLines} total lines]`
	}

	return content
}

// ─── Process Legacy File Entry ────────────────────────────────────────────────────

export async function processLegacyFileEntry(
	entry: FileEntry,
	task: ITaskModel,
	supportsImages: boolean,
): Promise<string> {
	const relPath = entry.path
	const fullPath = path.resolve(task.cwd, relPath)

	const accessAllowed = validateAccess(task.jabberwockIgnoreController, relPath, task.cwd)
	if (!accessAllowed) {
		await systemBroadcast(task.taskId, "rooignore_error", relPath)
		return `File: ${relPath}\nError: ${formatResponse.jabberwockIgnoreError(relPath)}`
	}

	const isOutsideWorkspace = isPathOutsideWorkspace(fullPath)
	let lineSnippet = ""
	if (entry.lineRanges) {
		lineSnippet = entry.lineRanges.map((range: LineRange) => `(lines ${range.start}-${range.end})`).join(", ")
	}

	const completeMessage = JSON.stringify({
		tool: "readFile" as const,
		path: getReadablePath(task.cwd, relPath),
		isOutsideWorkspace,
		content: fullPath,
		reason: lineSnippet || undefined,
	} satisfies SayToolData)

	const { response, text, images } = await ask(task.taskId, "tool", completeMessage, false)

	if (response !== "yesButtonClicked") {
		if (text) await userBroadcast(task.taskId, "user_feedback", text, images)
		task._state.setDidRejectTool(true)
		return `File: ${relPath}\nStatus: Denied by user`
	}

	if (text) await userBroadcast(task.taskId, "user_feedback", text, images)

	try {
		const stats = await getVirtualWorkspace().stat(fullPath)
		if (stats.isDirectory()) {
			const errorMsg = `Cannot read '${relPath}' because it is a directory.`
			await systemBroadcast(task.taskId, "error", `Error reading file ${relPath}: ${errorMsg}`)
			return `File: ${relPath}\nError: ${errorMsg}`
		}

		const isBinary = await isBinaryFile(fullPath).catch(() => false)

		if (isBinary) {
			return handleLegacyBinaryFile(relPath, fullPath, supportsImages)
		}

		const rawContent = await getVirtualWorkspace().readFile(fullPath)
		const content = await readLegacyFileContent(rawContent, entry.lineRanges)
		await getFileContextTracker().trackFileContext(relPath, "read_tool")

		return `File: ${relPath}\n${content}`
	} catch (error) {
		const errorMsg = getErrorMessage(error)
		await systemBroadcast(task.taskId, "error", `Error reading file ${relPath}: ${errorMsg}`)
		return `File: ${relPath}\nError: ${errorMsg}`
	}
}

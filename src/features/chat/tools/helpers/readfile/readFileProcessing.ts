import path from "path"
import { isBinaryFile } from "isbinaryfile"

import type { ITaskModel } from "@features/chat/task/store"
import { formatResponse } from "@features/settings/context/responses"
import { RecordSource } from "@features/foundation/time-machine/file-context/FileContextTrackerTypes"
import { readWithIndentation, readWithSlice } from "@integrations/misc/indentation-reader"
import { DEFAULT_LINE_LIMIT } from "@features/settings/context/tools/native-tools/r/read_file"
import type { PushToolResult } from "@shared/tools"

import { type ImageMemoryTracker } from "@features/chat/tools/helpers/generate-image/imageHelpers"
import { systemBroadcast } from "@features/chat/task/messages/actions/say"

import { getVirtualWorkspace, getFileContextTracker } from "@features/foundation/time-machine/actions/getTimeMachine"

import type { FileResult, InternalFileEntry } from "./readFileHelpers"
import { getErrorMessage } from "./readFileHelpers"

import { handleBinaryFile } from "./readFileBinary"

// ─── Text File Processing ─────────────────────────────────────────────────────────

function buildTruncationOutput(
	startLine: number,
	endLine: number,
	totalLines: number,
	nextOffset: number,
	limit: number,
	content: string,
): string {
	return `IMPORTANT: File content truncated.
	Status: Showing lines ${startLine}-${endLine} of ${totalLines} total lines.
	To read more: Use the read_file tool with offset=${nextOffset} and limit=${limit}.
	
	${content}`
}

function buildIndentationOutput(
	result: { content: string; wasTruncated: boolean; totalLines: number; includedRanges: [number, number][] },
	limit: number,
): string {
	if (result.wasTruncated && result.includedRanges.length > 0) {
		const [start, end] = result.includedRanges[0]
		const nextOffset = end + 1
		return buildTruncationOutput(start, end, result.totalLines, nextOffset, limit, result.content)
	}

	if (result.includedRanges.length > 0) {
		const rangeStr = result.includedRanges.map(([s, e]) => `${s}-${e}`).join(", ")
		return result.content + `\n\nIncluded ranges: ${rangeStr} (total: ${result.totalLines} lines)`
	}

	return result.content
}

function buildSliceOutput(
	result: { content: string; wasTruncated: boolean; totalLines: number; returnedLines: number },
	offset1: number,
	limit: number,
): string {
	if (result.wasTruncated) {
		const startLine = offset1
		const endLine = offset1 + result.returnedLines - 1
		const nextOffset = endLine + 1
		return buildTruncationOutput(startLine, endLine, result.totalLines, nextOffset, limit, result.content)
	}

	if (result.returnedLines === 0) {
		return "Note: File is empty"
	}

	return result.content
}

export function processTextFile(content: string, entry: InternalFileEntry): string {
	const mode = entry.mode || "slice"

	if (mode === "indentation") {
		const anchorLine = entry.anchor_line ?? entry.offset ?? 1
		const result = readWithIndentation(content, {
			anchorLine,
			maxLevels: entry.max_levels,
			includeSiblings: entry.include_siblings,
			includeHeader: entry.include_header,
			limit: entry.limit ?? DEFAULT_LINE_LIMIT,
			maxLines: entry.max_lines,
		})

		return buildIndentationOutput(result, entry.limit ?? DEFAULT_LINE_LIMIT)
	}

	const offset1 = entry.offset ?? 1
	const offset0 = Math.max(0, offset1 - 1)
	const limit = entry.limit ?? DEFAULT_LINE_LIMIT

	const result = readWithSlice(content, offset0, limit)
	return buildSliceOutput(result, offset1, limit)
}

// ─── Approved File Processing ─────────────────────────────────────────────────────

export async function processApprovedFile(
	task: ITaskModel,
	fileResult: FileResult,
	updateFileResult: (path: string, updates: Partial<FileResult>) => void,
	imageMemoryTracker: ImageMemoryTracker,
	maxImageFileSize: number,
	maxTotalImageSize: number,
): Promise<void> {
	const relPath = fileResult.path
	const fullPath = path.resolve(task.cwd, relPath)
	const entry = fileResult.entry!

	try {
		const stats = await getVirtualWorkspace().stat(fullPath)
		if (stats.isDirectory()) {
			const errorMsg = `Cannot read '${relPath}' because it is a directory. Use list_files tool instead.`
			updateFileResult(relPath, {
				status: "error",
				error: errorMsg,
				nativeContent: `File: ${relPath}\nError: ${errorMsg}`,
			})
			await systemBroadcast(task.taskId, "error", `Error reading file ${relPath}: ${errorMsg}`)
			return
		}

		const isBinary = await isBinaryFile(fullPath)

		if (isBinary) {
			await handleBinaryFile(
				task,
				relPath,
				fullPath,
				task.api!.getModel().info.supportsImages ?? false,
				maxImageFileSize,
				maxTotalImageSize,
				imageMemoryTracker,
				updateFileResult,
			)
			return
		}

		const fileContent = await getVirtualWorkspace().readFile(fullPath)
		const result = processTextFile(fileContent, entry)

		await getFileContextTracker().trackFileContext(relPath, "read_tool" as RecordSource)

		updateFileResult(relPath, {
			nativeContent: `File: ${relPath}\n${result}`,
		})
	} catch (error) {
		const errorMsg = getErrorMessage(error)
		updateFileResult(relPath, {
			status: "error",
			error: `Error reading file: ${errorMsg}`,
			nativeContent: `File: ${relPath}\nError: ${errorMsg}`,
		})
		await systemBroadcast(task.taskId, "error", `Error reading file ${relPath}: ${errorMsg}`)
	}
}

// ─── Result Assembly ──────────────────────────────────────────────────────────────

function buildFeedbackStatusMessage(
	fileResults: FileResult[],
	didRejectTool: boolean,
): { statusMessage: string; feedbackImages: string[] } {
	const deniedWithFeedback = fileResults.find((r) => r.status === "denied" && r.feedbackText)

	if (deniedWithFeedback?.feedbackText) {
		return {
			statusMessage: formatResponse.toolDeniedWithFeedback(deniedWithFeedback.feedbackText),
			feedbackImages: deniedWithFeedback.feedbackImages || [],
		}
	}

	if (didRejectTool) {
		return { statusMessage: formatResponse.toolDenied(), feedbackImages: [] }
	}

	const approvedWithFeedback = fileResults.find((r) => r.status === "approved" && r.feedbackText)
	if (approvedWithFeedback?.feedbackText) {
		return {
			statusMessage: formatResponse.toolApprovedWithFeedback(approvedWithFeedback.feedbackText),
			feedbackImages: approvedWithFeedback.feedbackImages || [],
		}
	}

	return { statusMessage: "", feedbackImages: [] }
}

export function buildAndPushResult(task: ITaskModel, fileResults: FileResult[], pushToolResult: PushToolResult): void {
	const finalResult = fileResults
		.filter((r) => r.nativeContent)
		.map((r) => r.nativeContent)
		.join("\n\n---\n\n")

	const fileImageUrls = fileResults.filter((r) => r.imageDataUrl).map((r) => r.imageDataUrl as string)

	const { statusMessage, feedbackImages } = buildFeedbackStatusMessage(fileResults, task._state.didRejectTool)

	const allImages = [...feedbackImages, ...fileImageUrls]
	const finalModelSupportsImages = task.api!.getModel().info.supportsImages ?? false
	const imagesToInclude = finalModelSupportsImages ? allImages : []

	if (statusMessage || imagesToInclude.length > 0) {
		const result = formatResponse.toolResult(
			statusMessage || finalResult,
			imagesToInclude.length > 0 ? imagesToInclude : undefined,
		)

		if (typeof result === "string") {
			pushToolResult(statusMessage ? `${result}\n${finalResult}` : result)
		} else {
			if (statusMessage) {
				const textBlock = { type: "text" as const, text: finalResult }
				pushToolResult([...result, textBlock])
			} else {
				pushToolResult(result)
			}
		}
	} else {
		pushToolResult(finalResult)
	}
}

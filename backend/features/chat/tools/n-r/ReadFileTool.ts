/**
 * ReadFileTool - Codex-inspired file reading with indentation mode support.
 *
 * Supports two modes:
 * 1. Slice mode (default): Read contiguous lines with offset/limit
 * 2. Indentation mode: Extract semantic code blocks based on indentation hierarchy
 *
 * Also supports legacy format for backward compatibility:
 * - Legacy format: { files: [{ path: string, lineRanges?: [...] }] }
 */
import path from "path"

import type { ReadFileParams, ReadFileToolParams, FileEntry } from "@jabberwock/types"
import { isLegacyReadFileParams, type SayToolData } from "@jabberwock/types"

import type { ITaskModel } from "@features/chat/task/store"
import { isPathOutsideWorkspace } from "@utils/io"
import { getReadablePath } from "@utils/io/path"
import type { ToolUse } from "@shared/tools"

import { BaseTool, ToolCallbacks } from "@features/chat/tools/a-b/BaseTool"
import { ask } from "@features/chat/task/notifications/actions/ask"
import { sayAndCreateMissingParamError } from "@features/chat/task/messages/actions/command/sayAndCreateMissingParamError"

import type { FileResult } from "@features/chat/tools/helpers/readfile"
import {
	updateFileResultInList,
	validateOffsetParam,
	buildFileEntry,
	processLegacyFileEntry,
	processNewFileResults,
	handleNewFileError,
} from "@features/chat/tools/helpers/readfile"

// ─── Tool Implementation ──────────────────────────────────────────────────────

export class ReadFileTool extends BaseTool<"read_file"> {
	readonly name = "read_file" as const

	async execute(params: ReadFileToolParams, task: ITaskModel, callbacks: ToolCallbacks): Promise<void> {
		if (isLegacyReadFileParams(params)) {
			return this.executeLegacy(params.files, task, callbacks)
		}

		return this.executeNew(params, task, callbacks)
	}

	private async executeNew(params: ReadFileParams, task: ITaskModel, callbacks: ToolCallbacks): Promise<void> {
		const { pushToolResult } = callbacks
		const filePath = params.path

		if (!filePath) {
			task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
			task.recordToolError("read_file")
			const errorMsg = await sayAndCreateMissingParamError(task.taskId, "read_file", "path")
			pushToolResult(`Error: ${errorMsg}`)
			return
		}

		if (!validateOffsetParam(params.offset, "offset", pushToolResult)) return
		if (!validateOffsetParam(params.indentation?.anchor_line, "anchor_line", pushToolResult)) return

		const fileEntry = buildFileEntry(params, filePath)
		const fileResults: FileResult[] = [{ path: filePath, status: "pending" as const, entry: fileEntry }]
		const updateFileResult = (fp: string, updates: Partial<FileResult>) =>
			updateFileResultInList(fileResults, fp, updates)

		try {
			await processNewFileResults(task, fileResults, updateFileResult, pushToolResult)
		} catch (error) {
			await handleNewFileError(error, filePath, fileResults, updateFileResult, pushToolResult, task)
		}
	}

	private async executeLegacy(fileEntries: FileEntry[], task: ITaskModel, callbacks: ToolCallbacks): Promise<void> {
		const { pushToolResult } = callbacks
		const modelInfo = task.api!.getModel().info

		console.warn("[jabberwock] [read_file] Legacy format detected - using backward compatibility path")

		if (!fileEntries || fileEntries.length === 0) {
			task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
			task.recordToolError("read_file")
			const errorMsg = await sayAndCreateMissingParamError(task.taskId, "read_file", "files")
			pushToolResult(`Error: ${errorMsg}`)
			return
		}

		const supportsImages = modelInfo.supportsImages ?? false
		const results: string[] = []

		for (const entry of fileEntries) {
			const result = await processLegacyFileEntry(entry, task, supportsImages)
			results.push(result)
		}

		pushToolResult(results.join("\n\n---\n\n"))
	}

	getReadFileToolDescription(blockName: string, blockParams: { path?: string }): string
	getReadFileToolDescription(blockName: string, nativeArgs: ReadFileParams): string
	getReadFileToolDescription(blockName: string, second: unknown): string {
		if (
			second &&
			typeof second === "object" &&
			"path" in second &&
			typeof (second as Record<string, unknown>).path === "string"
		) {
			return `[${blockName} for '${(second as Record<string, unknown>).path}']`
		}

		const blockParams = second as Record<string, unknown>
		if (blockParams?.path) {
			return `[${blockName} for '${blockParams.path}']`
		}
		return `[${blockName} with missing path]`
	}

	override async handlePartial(task: ITaskModel, block: ToolUse<"read_file">): Promise<void> {
		let filePath = ""

		if (block.nativeArgs) {
			if (isLegacyReadFileParams(block.nativeArgs)) {
				filePath = block.nativeArgs.files[0]?.path ?? ""
			} else {
				filePath = block.nativeArgs.path ?? ""
			}
		}

		const fullPath = filePath ? path.resolve(task.cwd, filePath) : ""
		const sharedMessageProps: SayToolData = {
			tool: "readFile",
			path: getReadablePath(task.cwd, filePath),
			isOutsideWorkspace: filePath ? isPathOutsideWorkspace(fullPath) : false,
		}
		const partialMessage = JSON.stringify({
			...sharedMessageProps,
			content: undefined,
		} satisfies SayToolData)
		await ask(task.taskId, "tool", partialMessage, block.partial).catch(() => {})
	}
}

export const readFileTool = new ReadFileTool()

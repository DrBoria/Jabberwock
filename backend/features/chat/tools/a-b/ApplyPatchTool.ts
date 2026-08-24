import path from "path"

import { type SayToolData } from "@jabberwock/types"

import { getReadablePath } from "@utils/io/path"
import { isPathOutsideWorkspace } from "@utils/io"
import type { ITaskModel } from "@features/chat/task/store"
import { formatResponse } from "@features/settings/context/responses"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "@shared/tools"
import { parsePatch, ParseError, processAllHunks } from "@features/foundation/time-machine/apply"
import type { ApplyPatchFileChange } from "@features/foundation/time-machine/apply"
import { ask } from "@features/chat/task/notifications/actions/ask"
import { systemBroadcast } from "@features/chat/task/messages/actions/say"
import { sayAndCreateMissingParamError } from "@features/chat/task/messages/actions/command/sayAndCreateMissingParamError"
import { getDiffViewProvider, getVirtualWorkspace } from "@features/foundation/time-machine/actions/getTimeMachine"
import { isWriteProtected } from "@utils/protect"
import { validateAccess } from "@utils/ignore"

import { handlePatchAddFile, handlePatchDeleteFile, handlePatchUpdateFile } from "@features/chat/tools/helpers/edit"

interface ApplyPatchParams {
	patch: string
}

async function parseAndValidatePatch(
	patch: string,
	task: ITaskModel,
	pushToolResult: (content: string) => void,
): Promise<ApplyPatchFileChange[] | null> {
	let parsedPatch
	try {
		parsedPatch = parsePatch(patch)
	} catch (error) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("apply_patch")
		const errorMessage =
			error instanceof ParseError
				? `Invalid patch format: ${error.message}`
				: `Failed to parse patch: ${error instanceof Error ? error.message : String(error)}`
		pushToolResult(formatResponse.toolError(errorMessage))
		return null
	}

	if (parsedPatch.hunks.length === 0) {
		pushToolResult("No file operations found in patch.")
		return null
	}

	const readFile = async (filePath: string): Promise<string> => {
		const absolutePath = path.resolve(task.cwd, filePath)
		return await getVirtualWorkspace().readFile(absolutePath, "utf8")
	}

	try {
		return await processAllHunks(parsedPatch.hunks, readFile)
	} catch (error) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("apply_patch")
		const errorMessage = `Failed to process patch: ${error instanceof Error ? error.message : String(error)}`
		pushToolResult(formatResponse.toolError(errorMessage))
		return null
	}
}

async function processPatchChanges(
	changes: ApplyPatchFileChange[],
	task: ITaskModel,
	callbacks: ToolCallbacks,
): Promise<void> {
	const { pushToolResult } = callbacks

	for (const change of changes) {
		const relPath = change.path
		const absolutePath = path.resolve(task.cwd, relPath)

		const accessAllowed = validateAccess(task.jabberwockIgnoreController, relPath, task.cwd)
		if (!accessAllowed) {
			await systemBroadcast(task.taskId, "rooignore_error", relPath)
			pushToolResult(formatResponse.jabberwockIgnoreError(relPath))
			return
		}

		const isFileWriteProtected = isWriteProtected(task.cwd, relPath)

		if (change.type === "add") {
			await handlePatchAddFile(change, absolutePath, relPath, task, callbacks, isFileWriteProtected)
		} else if (change.type === "delete") {
			await handlePatchDeleteFile(absolutePath, relPath, task, callbacks, isFileWriteProtected)
		} else if (change.type === "update") {
			await handlePatchUpdateFile(change, absolutePath, relPath, task, callbacks, isFileWriteProtected)
		}
	}
}

export class ApplyPatchTool extends BaseTool<"apply_patch"> {
	readonly name = "apply_patch" as const

	private static readonly FILE_HEADER_MARKERS = ["*** Add File: ", "*** Delete File: ", "*** Update File: "] as const

	private extractFirstPathFromPatch(patch: string | undefined): string | undefined {
		if (!patch) {
			return undefined
		}

		const lines = patch.split("\n")
		const hasTrailingNewline = patch.endsWith("\n")
		const completeLines = hasTrailingNewline ? lines : lines.slice(0, -1)

		for (const rawLine of completeLines) {
			const line = rawLine.trim()

			for (const marker of ApplyPatchTool.FILE_HEADER_MARKERS) {
				if (!line.startsWith(marker)) {
					continue
				}

				const candidatePath = line.substring(marker.length).trim()
				if (candidatePath.length > 0) {
					return candidatePath
				}
			}
		}

		return undefined
	}

	async execute(params: ApplyPatchParams, task: ITaskModel, callbacks: ToolCallbacks): Promise<void> {
		const { patch } = params
		const { handleError, pushToolResult } = callbacks

		try {
			if (!patch) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("apply_patch")
				pushToolResult(await sayAndCreateMissingParamError(task.taskId, "apply_patch", "patch"))
				return
			}

			const changes = await parseAndValidatePatch(patch, task, pushToolResult)
			if (!changes) {
				return
			}

			await processPatchChanges(changes, task, callbacks)

			task._state.setConsecutiveMistakeCount(0)
			task.recordToolUsage("apply_patch")
		} catch (error) {
			await handleError("apply patch", error as Error)
			await getDiffViewProvider().reset()
		}
	}

	override async handlePartial(task: ITaskModel, block: ToolUse<"apply_patch">): Promise<void> {
		const patch: string | undefined = block.params.patch
		const candidateRelPath = this.extractFirstPathFromPatch(patch)
		const fallbackDisplayPath = path.basename(task.cwd) || "workspace"
		const resolvedRelPath = candidateRelPath ?? ""
		const absolutePath = path.resolve(task.cwd, resolvedRelPath)
		const displayPath = candidateRelPath ? getReadablePath(task.cwd, candidateRelPath) : fallbackDisplayPath

		let patchPreview: string | undefined
		if (patch) {
			const lines = patch.split("\n").slice(0, 5)
			patchPreview = lines.join("\n") + (patch.split("\n").length > 5 ? "\n..." : "")
		}

		const sharedMessageProps: SayToolData = {
			tool: "appliedDiff",
			path: displayPath || path.basename(task.cwd) || "workspace",
			diff: patchPreview || "Parsing patch...",
			isOutsideWorkspace: isPathOutsideWorkspace(absolutePath),
		}

		await ask(task.taskId, "tool", JSON.stringify(sharedMessageProps), block.partial).catch(() => {})
	}
}

export const applyPatchTool = new ApplyPatchTool()

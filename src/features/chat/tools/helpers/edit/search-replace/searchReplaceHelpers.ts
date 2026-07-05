import path from "path"

import { formatResponse } from "@features/settings/context/responses"
import { fileExistsAtPath } from "@utils/io/fs"
import { systemBroadcast } from "@features/chat/task/messages/actions/say"
import { sayAndCreateMissingParamError } from "@features/chat/task/messages/actions/command/sayAndCreateMissingParamError"
import { validateAccess } from "@utils/ignore"
import { isWriteProtected } from "@utils/protect"
import { getVirtualWorkspace } from "@features/foundation/time-machine/actions/getTimeMachine"
import type { ITaskModel } from "@features/chat/task/store"

import type { SearchReplaceParams, ValidationResult, AccessResult, MatchResult } from "./searchReplaceHelpers.types"

export async function validateSearchReplaceParams(
	task: ITaskModel,
	params: SearchReplaceParams,
	pushToolResult: (content: string) => void,
): Promise<ValidationResult | null> {
	const { file_path, old_string, new_string } = params
	if (!file_path) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("search_replace")
		pushToolResult(await sayAndCreateMissingParamError(task.taskId, "search_replace", "file_path"))
		return null
	}
	if (!old_string) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("search_replace")
		pushToolResult(await sayAndCreateMissingParamError(task.taskId, "search_replace", "old_string"))
		return null
	}
	if (new_string === undefined) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("search_replace")
		pushToolResult(await sayAndCreateMissingParamError(task.taskId, "search_replace", "new_string"))
		return null
	}
	if (old_string === new_string) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("search_replace")
		pushToolResult(formatResponse.toolError("The 'old_string' and 'new_string' parameters must be different."))
		return null
	}
	let relPath: string
	if (path.isAbsolute(file_path)) {
		relPath = path.relative(task.cwd, file_path)
	} else {
		relPath = file_path
	}
	return { relPath }
}

export async function validateSearchReplaceAccess(
	task: ITaskModel,
	relPath: string,
	pushToolResult: (content: string) => void,
): Promise<AccessResult | null> {
	const accessAllowed = validateAccess(task.jabberwockIgnoreController, relPath, task.cwd)
	if (!accessAllowed) {
		await systemBroadcast(task.taskId, "rooignore_error", relPath)
		pushToolResult(formatResponse.jabberwockIgnoreError(relPath))
		return null
	}
	const isFileWriteProtected = isWriteProtected(task.cwd, relPath)
	const absolutePath = path.resolve(task.cwd, relPath)
	const fileExists = await fileExistsAtPath(getVirtualWorkspace(), absolutePath)
	if (!fileExists) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("search_replace")
		const errorMessage = `File not found: ${relPath}. Cannot perform search and replace on a non-existent file.`
		await systemBroadcast(task.taskId, "error", errorMessage)
		pushToolResult(formatResponse.toolError(errorMessage))
		return null
	}
	return { absolutePath, isFileWriteProtected }
}

export async function readAndMatchContent(
	absolutePath: string,
	relPath: string,
	oldString: string,
	newString: string,
	task: ITaskModel,
	pushToolResult: (content: string) => void,
): Promise<MatchResult | null> {
	let fileContent: string
	try {
		fileContent = await getVirtualWorkspace().readFile(absolutePath, "utf8")
		fileContent = fileContent.replace(/\r\n/g, "\n")
	} catch (_error) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("search_replace")
		const errorMessage = `Failed to read file '${relPath}'. Please verify file permissions and try again.`
		await systemBroadcast(task.taskId, "error", errorMessage)
		pushToolResult(formatResponse.toolError(errorMessage))
		return null
	}
	const normalizedOldString = oldString.replace(/\r\n/g, "\n")
	const normalizedNewString = newString.replace(/\r\n/g, "\n")
	const matchCount = fileContent.split(normalizedOldString).length - 1
	if (matchCount === 0) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("search_replace", "no_match")
		pushToolResult(
			formatResponse.toolError(
				"No match found for the specified 'old_string'. Please ensure it matches the file contents exactly, including whitespace and indentation.",
			),
		)
		return null
	}
	if (matchCount > 1) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("search_replace", "multiple_matches")
		pushToolResult(
			formatResponse.toolError(
				`Found ${matchCount} matches. This tool can only replace ONE occurrence at a time. Please provide more context (3-5 lines before and after) to uniquely identify the specific instance you want to change.`,
			),
		)
		return null
	}
	const newContent = fileContent.replace(normalizedOldString, normalizedNewString)
	if (newContent === fileContent) {
		pushToolResult(`No changes needed for '${relPath}'`)
		return null
	}
	return { fileContent, newContent }
}

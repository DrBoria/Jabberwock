import fs from "fs/promises"
import { type SayToolData, DEFAULT_WRITE_DELAY_MS } from "@jabberwock/types"
import { getReadablePath } from "@utils/io/path"
import { isPathOutsideWorkspace } from "@utils/io"
import type { ITaskModel } from "@features/chat/task/store"
import { formatResponse } from "@features/settings/context/responses"
import { RecordSource } from "@features/foundation/time-machine/file-context/FileContextTrackerTypes"
import { fileExistsAtPath } from "@utils/io/fs"
import { EXPERIMENT_IDS, experiments } from "@shared/experiments"
import { sanitizeUnifiedDiff, computeDiffStats } from "@features/foundation/time-machine/actions/stats"
import type { AskApproval } from "@shared/tools"
import { systemBroadcast } from "@features/chat/task/messages/actions/say"
import { sayAndCreateMissingParamError } from "@features/chat/task/messages/actions/command/sayAndCreateMissingParamError"
import { getDiffViewProvider, getFileContextTracker } from "@features/foundation/time-machine/actions/getTimeMachine"

export async function validateEditParams(
	relPath: string | undefined,
	oldString: string | undefined,
	newString: string | undefined,
	task: ITaskModel,
	pushToolResult: (content: string) => void,
): Promise<boolean> {
	if (!relPath) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("edit")
		pushToolResult(await sayAndCreateMissingParamError(task.taskId, "edit", "file_path"))
		return false
	}
	if (!oldString) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("edit")
		pushToolResult(await sayAndCreateMissingParamError(task.taskId, "edit", "old_string"))
		return false
	}
	if (newString === undefined) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("edit")
		pushToolResult(await sayAndCreateMissingParamError(task.taskId, "edit", "new_string"))
		return false
	}
	if (oldString === newString) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("edit")
		pushToolResult(
			formatResponse.toolError(
				"'old_string' and 'new_string' are identical. No changes needed. If you want to make a change, ensure 'old_string' and 'new_string' are different.",
			),
		)
		return false
	}
	return true
}

export async function readAndValidateEditFile(
	absolutePath: string,
	oldString: string,
	newString: string,
	replaceAll: boolean | undefined,
	relPath: string,
	task: ITaskModel,
	pushToolResult: (content: string) => void,
): Promise<{ fileContent: string; newContent: string } | null> {
	const fileExists = await fileExistsAtPath(absolutePath)
	if (!fileExists) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("edit")
		const errorMessage = `File not found: ${relPath}. Cannot perform edit on a non-existent file.`
		await systemBroadcast(task.taskId, "error", errorMessage)
		pushToolResult(formatResponse.toolError(errorMessage))
		return null
	}

	let fileContent: string
	try {
		fileContent = await fs.readFile(absolutePath, "utf8")
		fileContent = fileContent.replace(/\r\n/g, "\n")
	} catch {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("edit")
		const errorMessage = `Failed to read file '${relPath}'. Please verify file permissions and try again.`
		await systemBroadcast(task.taskId, "error", errorMessage)
		pushToolResult(formatResponse.toolError(errorMessage))
		return null
	}

	const normalizedOld = oldString.replace(/\r\n/g, "\n")
	const normalizedNew = newString.replace(/\r\n/g, "\n")
	const matchCount = fileContent.split(normalizedOld).length - 1

	if (matchCount === 0) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("edit", "no_match")
		pushToolResult(
			formatResponse.toolError(
				`No match found for 'old_string' in ${relPath}. Make sure the text to find appears exactly in the file, including whitespace and indentation.`,
			),
		)
		return null
	}

	if (!replaceAll && matchCount > 1) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("edit")
		pushToolResult(
			formatResponse.toolError(
				`Found ${matchCount} matches of 'old_string' in the file. Use 'replace_all: true' to replace all occurrences, or provide more context in 'old_string' to make it unique.`,
			),
		)
		return null
	}

	let newContent: string
	if (replaceAll) {
		const searchPattern = new RegExp(escapeRegExp(normalizedOld), "g")
		newContent = fileContent.replace(searchPattern, () => normalizedNew)
	} else {
		newContent = fileContent.replace(normalizedOld, () => normalizedNew)
	}

	if (newContent === fileContent) {
		pushToolResult(`No changes needed for '${relPath}'`)
		return null
	}

	return { fileContent, newContent }
}

export async function requestEditApprovalAndSave(
	relPath: string,
	absolutePath: string,
	fileContent: string,
	newContent: string,
	isFileWriteProtected: boolean,
	task: ITaskModel,
	askApproval: AskApproval,
	pushToolResult: (content: string) => void,
): Promise<void> {
	getDiffViewProvider().editType = "modify"
	getDiffViewProvider().originalContent = fileContent

	const diff = formatResponse.createPrettyPatch(relPath, fileContent, newContent)
	if (!diff) {
		pushToolResult(`No changes needed for '${relPath}'`)
		await getDiffViewProvider().reset()
		return
	}

	const diagnosticsEnabled = true
	const writeDelayMs = DEFAULT_WRITE_DELAY_MS
	const isPreventFocusDisruptionEnabled = experiments.isEnabled({}, EXPERIMENT_IDS.PREVENT_FOCUS_DISRUPTION)

	const sanitizedDiff = sanitizeUnifiedDiff(diff)
	const diffStats = computeDiffStats(sanitizedDiff) || undefined
	const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)

	const sharedMessageProps: SayToolData = {
		tool: "appliedDiff",
		path: getReadablePath(task.cwd, relPath),
		diff: sanitizedDiff,
		isOutsideWorkspace,
	}

	const completeMessage = JSON.stringify({
		...sharedMessageProps,
		content: sanitizedDiff,
		isProtected: isFileWriteProtected,
		diffStats,
	} satisfies SayToolData)

	if (!isPreventFocusDisruptionEnabled) {
		await getDiffViewProvider().open(relPath)
		await getDiffViewProvider().update(newContent, true)
		getDiffViewProvider().scrollToFirstDiff()
	}

	const didApprove = await askApproval("tool", completeMessage, undefined, isFileWriteProtected)

	if (!didApprove) {
		if (!isPreventFocusDisruptionEnabled) {
			await getDiffViewProvider().revertChanges()
		}
		pushToolResult("Changes were rejected by the user.")
		await getDiffViewProvider().reset()
		return
	}

	if (isPreventFocusDisruptionEnabled) {
		await getDiffViewProvider().saveDirectly(relPath, newContent, false, diagnosticsEnabled, writeDelayMs)
	} else {
		await getDiffViewProvider().saveChanges(diagnosticsEnabled, writeDelayMs)
	}

	if (relPath) {
		await getFileContextTracker().trackFileContext(relPath, "roo_edited" as RecordSource)
	}

	task.didEditFile = true

	const message = await getDiffViewProvider().pushToolWriteResult(task, task.cwd, false)
	pushToolResult(message)
}

function escapeRegExp(input: string): string {
	return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

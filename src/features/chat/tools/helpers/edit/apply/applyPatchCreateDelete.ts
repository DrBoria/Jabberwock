import { type SayToolData, DEFAULT_WRITE_DELAY_MS } from "@jabberwock/types"

import { getReadablePath } from "@utils/io/path"
import { isPathOutsideWorkspace } from "@utils/io"
import type { ITaskModel } from "@features/chat/task/store"
import { formatResponse } from "@features/settings/context/responses"
import { RecordSource } from "@features/foundation/time-machine/file-context/FileContextTrackerTypes"
import { fileExistsAtPath } from "@utils/io/fs"
import { EXPERIMENT_IDS, experiments } from "@shared/experiments"
import { sanitizeUnifiedDiff, computeDiffStats } from "@features/foundation/time-machine/actions/stats"
import type { ToolCallbacks } from "@features/chat/tools/a-b/BaseTool"
import type { ApplyPatchFileChange } from "@features/foundation/time-machine/apply"
import { systemBroadcast } from "@features/chat/task/messages/actions/say"
import {
	getDiffViewProvider,
	getVirtualWorkspace,
	getFileContextTracker,
} from "@features/foundation/time-machine/actions/getTimeMachine"

export async function handlePatchAddFile(
	change: ApplyPatchFileChange,
	absolutePath: string,
	relPath: string,
	task: ITaskModel,
	callbacks: ToolCallbacks,
	isFileWriteProtected: boolean,
): Promise<void> {
	const { askApproval, pushToolResult } = callbacks

	const fileExists = await fileExistsAtPath(getVirtualWorkspace(), absolutePath)
	if (fileExists) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("apply_patch")
		const errorMessage = `File already exists: ${relPath}. Use Update File instead.`
		await systemBroadcast(task.taskId, "error", errorMessage)
		pushToolResult(formatResponse.toolError(errorMessage))
		return
	}

	const newContent = change.newContent || ""
	const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)

	getDiffViewProvider().editType = "create"
	getDiffViewProvider().originalContent = undefined

	const diff = formatResponse.createPrettyPatch(relPath, "", newContent)

	const diagnosticsEnabled = true
	const writeDelayMs = DEFAULT_WRITE_DELAY_MS
	const isPreventFocusDisruptionEnabled = experiments.isEnabled({}, EXPERIMENT_IDS.PREVENT_FOCUS_DISRUPTION)

	const sanitizedDiff = sanitizeUnifiedDiff(diff || "")
	const diffStats = computeDiffStats(sanitizedDiff) || undefined

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
		await getDiffViewProvider().saveDirectly(relPath, newContent, true, diagnosticsEnabled, writeDelayMs)
	} else {
		await getDiffViewProvider().saveChanges(diagnosticsEnabled, writeDelayMs)
	}

	await getFileContextTracker().trackFileContext(relPath, "roo_edited" as RecordSource)
	task.didEditFile = true

	const message = await getDiffViewProvider().pushToolWriteResult(task, task.cwd, true)
	pushToolResult(message)
	await getDiffViewProvider().reset()
}

export async function handlePatchDeleteFile(
	absolutePath: string,
	relPath: string,
	task: ITaskModel,
	callbacks: ToolCallbacks,
	isFileWriteProtected: boolean,
): Promise<void> {
	const { askApproval, pushToolResult } = callbacks

	const fileExists = await fileExistsAtPath(absolutePath)
	if (!fileExists) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("apply_patch")
		const errorMessage = `File not found: ${relPath}. Cannot delete a non-existent file.`
		await systemBroadcast(task.taskId, "error", errorMessage)
		pushToolResult(formatResponse.toolError(errorMessage))
		return
	}

	const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)

	const sharedMessageProps: SayToolData = {
		tool: "appliedDiff",
		path: getReadablePath(task.cwd, relPath),
		diff: `File will be deleted: ${relPath}`,
		isOutsideWorkspace,
	}

	const completeMessage = JSON.stringify({
		...sharedMessageProps,
		content: `Delete file: ${relPath}`,
		isProtected: isFileWriteProtected,
	} satisfies SayToolData)

	const didApprove = await askApproval("tool", completeMessage, undefined, isFileWriteProtected)

	if (!didApprove) {
		pushToolResult("Delete operation was rejected by the user.")
		return
	}

	try {
		await getVirtualWorkspace().unlink(absolutePath)
	} catch (error) {
		const errorMessage = `Failed to delete file '${relPath}': ${error instanceof Error ? error.message : String(error)}`
		await systemBroadcast(task.taskId, "error", errorMessage)
		pushToolResult(formatResponse.toolError(errorMessage))
		return
	}

	task.didEditFile = true
	pushToolResult(`Successfully deleted ${relPath}`)
}

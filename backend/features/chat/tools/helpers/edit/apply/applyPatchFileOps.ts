import path from "path"

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
import { isWriteProtected } from "@utils/protect"
import { validateAccess } from "@utils/ignore"

async function handlePatchFileMove(
	change: ApplyPatchFileChange,
	absolutePath: string,
	task: ITaskModel,
	isPreventFocusDisruptionEnabled: boolean,
	diagnosticsEnabled: boolean,
	writeDelayMs: number,
): Promise<boolean> {
	if (!change.movePath) {
		return false
	}

	const moveAbsolutePath = path.resolve(task.cwd, change.movePath)

	const moveAccessAllowed = validateAccess(task.jabberwockIgnoreController, change.movePath, task.cwd)
	if (!moveAccessAllowed) {
		await systemBroadcast(task.taskId, "rooignore_error", change.movePath)
		return false
	}

	const isMovePathWriteProtected = isWriteProtected(task.cwd, change.movePath)
	if (isMovePathWriteProtected) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("apply_patch")
		const errorMessage = `Cannot move file to write-protected path: ${change.movePath}`
		await systemBroadcast(task.taskId, "error", errorMessage)
		return false
	}

	const isMoveOutsideWorkspace = isPathOutsideWorkspace(moveAbsolutePath)
	if (isMoveOutsideWorkspace) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("apply_patch")
		const errorMessage = `Cannot move file to path outside workspace: ${change.movePath}`
		await systemBroadcast(task.taskId, "error", errorMessage)
		return false
	}

	const newContent = change.newContent || ""

	if (isPreventFocusDisruptionEnabled) {
		await getDiffViewProvider().saveDirectly(change.movePath, newContent, false, diagnosticsEnabled, writeDelayMs)
	} else {
		const parentDir = path.dirname(moveAbsolutePath)
		await getVirtualWorkspace().mkdir(parentDir, { recursive: true })
		await getVirtualWorkspace().writeFile(moveAbsolutePath, newContent, "utf8")
	}

	try {
		await getVirtualWorkspace().unlink(absolutePath)
	} catch (error) {
		console.error(`[jabberwock] Failed to delete original file after move: ${error}`)
	}

	await getFileContextTracker().trackFileContext(change.movePath, "roo_edited" as RecordSource)

	return true
}

async function saveUpdatedFile(
	relPath: string,
	newContent: string,
	isPreventFocusDisruptionEnabled: boolean,
	diagnosticsEnabled: boolean,
	writeDelayMs: number,
): Promise<void> {
	if (isPreventFocusDisruptionEnabled) {
		await getDiffViewProvider().saveDirectly(relPath, newContent, false, diagnosticsEnabled, writeDelayMs)
	} else {
		await getDiffViewProvider().saveChanges(diagnosticsEnabled, writeDelayMs)
	}

	await getFileContextTracker().trackFileContext(relPath, "roo_edited" as RecordSource)
}

export async function handlePatchUpdateFile(
	change: ApplyPatchFileChange,
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
		const errorMessage = `File not found: ${relPath}. Cannot update a non-existent file.`
		await systemBroadcast(task.taskId, "error", errorMessage)
		pushToolResult(formatResponse.toolError(errorMessage))
		return
	}

	const originalContent = change.originalContent || ""
	const newContent = change.newContent || ""
	const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)

	getDiffViewProvider().editType = "modify"
	getDiffViewProvider().originalContent = originalContent

	const diff = formatResponse.createPrettyPatch(relPath, originalContent, newContent)
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

	const sharedMessageProps: SayToolData = {
		tool: "appliedDiff",
		path: getReadablePath(task.cwd, relPath),
		diff: sanitizedDiff,
		originalContent,
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

	const didMove = await handlePatchFileMove(
		change,
		absolutePath,
		task,
		isPreventFocusDisruptionEnabled,
		diagnosticsEnabled,
		writeDelayMs,
	)

	if (didMove) {
		await getDiffViewProvider().reset()
		task.didEditFile = true
		const message = await getDiffViewProvider().pushToolWriteResult(task, task.cwd, false)
		pushToolResult(message)
		return
	}

	await saveUpdatedFile(relPath, newContent, isPreventFocusDisruptionEnabled, diagnosticsEnabled, writeDelayMs)

	task.didEditFile = true

	const message = await getDiffViewProvider().pushToolWriteResult(task, task.cwd, false)
	pushToolResult(message)
	await getDiffViewProvider().reset()
}

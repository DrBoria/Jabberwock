import fs from "fs/promises"
import path from "path"

import { type SayToolData, DEFAULT_WRITE_DELAY_MS } from "@jabberwock/types"

import { getReadablePath } from "../../../utils/path"
import { isPathOutsideWorkspace } from "../../../utils/pathUtils"
import type { ITaskModel } from "../../../features/chat/task/store"
import { formatResponse } from "../../settings/context/responses"
import { RecordSource } from "../../../features/foundation/time-machine/file-context/FileContextTrackerTypes"
import { fileExistsAtPath } from "../../../utils/fs"
import { EXPERIMENT_IDS, experiments } from "../../../shared/experiments"
import { sanitizeUnifiedDiff, computeDiffStats } from "../../../features/foundation/time-machine/actions/stats"
import type { ToolUse } from "../../../shared/tools"

import { BaseTool, ToolCallbacks } from "./BaseTool"
import { ask } from "../task/notifications/actions/ask"
import { systemBroadcast } from "../task/messages/actions/say"
import { sayAndCreateMissingParamError } from "../task/messages/actions/missingParamError"

import {
	getDiffViewProvider,
	getFileContextTracker,
} from "../../../features/foundation/time-machine/actions/getTimeMachine"

import { isWriteProtected } from "@utils/protect"
import { validateAccess } from "@utils/ignore"

interface EditParams {
	file_path: string
	old_string: string
	new_string: string
	replace_all?: boolean
}

export class EditTool extends BaseTool<"edit"> {
	readonly name = "edit" as const

	async execute(params: EditParams, task: ITaskModel, callbacks: ToolCallbacks): Promise<void> {
		const { file_path: relPath, old_string: oldString, new_string: newString, replace_all: replaceAll } = params
		const { askApproval, handleError, pushToolResult } = callbacks

		try {
			// Validate required parameters
			if (!relPath) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("edit")
				pushToolResult(await sayAndCreateMissingParamError(task.taskId, "edit", "file_path"))
				return
			}

			if (!oldString) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("edit")
				pushToolResult(await sayAndCreateMissingParamError(task.taskId, "edit", "old_string"))
				return
			}

			if (newString === undefined) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("edit")
				pushToolResult(await sayAndCreateMissingParamError(task.taskId, "edit", "new_string"))
				return
			}

			// Check old_string !== new_string
			if (oldString === newString) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("edit")
				pushToolResult(
					formatResponse.toolError(
						"'old_string' and 'new_string' are identical. No changes needed. If you want to make a change, ensure 'old_string' and 'new_string' are different.",
					),
				)
				return
			}

			const accessAllowed = validateAccess(task.jabberwockIgnoreController, relPath, task.cwd)

			if (!accessAllowed) {
				await systemBroadcast(task.taskId, "rooignore_error", relPath)
				pushToolResult(formatResponse.jabberwockIgnoreError(relPath))
				return
			}

			// Check if file is write-protected
			const isFileWriteProtected = isWriteProtected(task.cwd, relPath)

			const absolutePath = path.resolve(task.cwd, relPath)

			const fileExists = await fileExistsAtPath(absolutePath)
			if (!fileExists) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("edit")
				const errorMessage = `File not found: ${relPath}. Cannot perform edit on a non-existent file.`
				await systemBroadcast(task.taskId, "error", errorMessage)
				pushToolResult(formatResponse.toolError(errorMessage))
				return
			}

			let fileContent: string
			try {
				fileContent = await fs.readFile(absolutePath, "utf8")
				// Normalize line endings to LF for consistent matching
				fileContent = fileContent.replace(/\r\n/g, "\n")
			} catch (error) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("edit")
				const errorMessage = `Failed to read file '${relPath}'. Please verify file permissions and try again.`
				await systemBroadcast(task.taskId, "error", errorMessage)
				pushToolResult(formatResponse.toolError(errorMessage))
				return
			}

			// Normalize line endings in old_string/new_string to match file content
			const normalizedOld = oldString.replace(/\r\n/g, "\n")
			const normalizedNew = newString.replace(/\r\n/g, "\n")

			// Count occurrences of old_string in file content
			const matchCount = fileContent.split(normalizedOld).length - 1

			if (matchCount === 0) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("edit", "no_match")
				pushToolResult(
					formatResponse.toolError(
						`No match found for 'old_string' in ${relPath}. Make sure the text to find appears exactly in the file, including whitespace and indentation.`,
					),
				)
				return
			}

			// Uniqueness check when replace_all is not enabled
			if (!replaceAll && matchCount > 1) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("edit")
				pushToolResult(
					formatResponse.toolError(
						`Found ${matchCount} matches of 'old_string' in the file. Use 'replace_all: true' to replace all occurrences, or provide more context in 'old_string' to make it unique.`,
					),
				)
				return
			}

			// Apply the replacement
			let newContent: string
			if (replaceAll) {
				// Replace all occurrences
				const searchPattern = new RegExp(escapeRegExp(normalizedOld), "g")
				newContent = fileContent.replace(searchPattern, () => normalizedNew)
			} else {
				// Replace single occurrence (already verified uniqueness above)
				newContent = fileContent.replace(normalizedOld, () => normalizedNew)
			}

			// Check if any changes were made
			if (newContent === fileContent) {
				pushToolResult(`No changes needed for '${relPath}'`)
				return
			}

			task._state.setConsecutiveMistakeCount(0)

			// Initialize diff view
			getDiffViewProvider().editType = "modify"
			getDiffViewProvider().originalContent = fileContent

			// Generate and validate diff
			const diff = formatResponse.createPrettyPatch(relPath, fileContent, newContent)
			if (!diff) {
				pushToolResult(`No changes needed for '${relPath}'`)
				await getDiffViewProvider().reset()
				return
			}

			// Check if preventFocusDisruption experiment is enabled
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

			// Show diff view if focus disruption prevention is disabled
			if (!isPreventFocusDisruptionEnabled) {
				await getDiffViewProvider().open(relPath)
				await getDiffViewProvider().update(newContent, true)
				getDiffViewProvider().scrollToFirstDiff()
			}

			const didApprove = await askApproval("tool", completeMessage, undefined, isFileWriteProtected)

			if (!didApprove) {
				// Revert changes if diff view was shown
				if (!isPreventFocusDisruptionEnabled) {
					await getDiffViewProvider().revertChanges()
				}
				pushToolResult("Changes were rejected by the user.")
				await getDiffViewProvider().reset()
				return
			}

			// Save the changes
			if (isPreventFocusDisruptionEnabled) {
				// Direct file write without diff view or opening the file
				await getDiffViewProvider().saveDirectly(relPath, newContent, false, diagnosticsEnabled, writeDelayMs)
			} else {
				// Call saveChanges to update the DiffViewProvider properties
				await getDiffViewProvider().saveChanges(diagnosticsEnabled, writeDelayMs)
			}

			// Track file edit operation
			if (relPath) {
				await getFileContextTracker().trackFileContext(relPath, "roo_edited" as RecordSource)
			}

			task.didEditFile = true

			// Get the formatted response message
			const message = await getDiffViewProvider().pushToolWriteResult(task, task.cwd, false)
			pushToolResult(message)

			// Record successful tool usage and cleanup
			task.recordToolUsage("edit")
			await getDiffViewProvider().reset()
			this.resetPartialState()
		} catch (error) {
			await handleError("edit", error as Error)
			await getDiffViewProvider().reset()
			this.resetPartialState()
		}
	}

	override async handlePartial(task: ITaskModel, block: ToolUse<"edit">): Promise<void> {
		const relPath: string | undefined = block.params.file_path

		// Wait for path to stabilize before showing UI (prevents truncated paths)
		if (!this.hasPathStabilized(relPath)) {
			return
		}

		// relPath is guaranteed non-null after hasPathStabilized
		const absolutePath = path.resolve(task.cwd, relPath!)
		const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)

		const sharedMessageProps: SayToolData = {
			tool: "appliedDiff",
			path: getReadablePath(task.cwd, relPath!),
			diff: block.params.old_string ? "1 edit operation" : undefined,
			isOutsideWorkspace,
		}

		await ask(task.taskId, "tool", JSON.stringify(sharedMessageProps), block.partial).catch(() => {})
	}
}

/**
 * Escapes special regex characters in a string
 * @param input String to escape regex characters in
 * @returns Escaped string safe for regex pattern matching
 */
function escapeRegExp(input: string): string {
	return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export const editTool = new EditTool()
export const searchAndReplaceTool = editTool // alias for backward compat

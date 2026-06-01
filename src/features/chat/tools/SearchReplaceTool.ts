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
	getVirtualWorkspace,
	getFileContextTracker,
} from "../../../features/foundation/time-machine/actions/getTimeMachine"

import { isWriteProtected } from "@utils/protect"
import { validateAccess } from "@utils/ignore"

interface SearchReplaceParams {
	file_path: string
	old_string: string
	new_string: string
}

export class SearchReplaceTool extends BaseTool<"search_replace"> {
	readonly name = "search_replace" as const

	async execute(params: SearchReplaceParams, task: ITaskModel, callbacks: ToolCallbacks): Promise<void> {
		const { file_path, old_string, new_string } = params
		const { askApproval, handleError, pushToolResult } = callbacks

		try {
			// Validate required parameters
			if (!file_path) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("search_replace")
				pushToolResult(await sayAndCreateMissingParamError(task.taskId, "search_replace", "file_path"))
				return
			}

			if (!old_string) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("search_replace")
				pushToolResult(await sayAndCreateMissingParamError(task.taskId, "search_replace", "old_string"))
				return
			}

			if (new_string === undefined) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("search_replace")
				pushToolResult(await sayAndCreateMissingParamError(task.taskId, "search_replace", "new_string"))
				return
			}

			// Validate that old_string and new_string are different
			if (old_string === new_string) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("search_replace")
				pushToolResult(
					formatResponse.toolError("The 'old_string' and 'new_string' parameters must be different."),
				)
				return
			}

			// Determine relative path - file_path can be absolute or relative
			let relPath: string
			if (path.isAbsolute(file_path)) {
				relPath = path.relative(task.cwd, file_path)
			} else {
				relPath = file_path
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

			const fileExists = await fileExistsAtPath(getVirtualWorkspace(), absolutePath)
			if (!fileExists) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("search_replace")
				const errorMessage = `File not found: ${relPath}. Cannot perform search and replace on a non-existent file.`
				await systemBroadcast(task.taskId, "error", errorMessage)
				pushToolResult(formatResponse.toolError(errorMessage))
				return
			}

			let fileContent: string
			try {
				fileContent = await getVirtualWorkspace().readFile(absolutePath, "utf8")
				// Normalize line endings to LF for consistent matching
				fileContent = fileContent.replace(/\r\n/g, "\n")
			} catch (error) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("search_replace")
				const errorMessage = `Failed to read file '${relPath}'. Please verify file permissions and try again.`
				await systemBroadcast(task.taskId, "error", errorMessage)
				pushToolResult(formatResponse.toolError(errorMessage))
				return
			}

			// Normalize line endings in search/replace strings to match file content
			const normalizedOldString = old_string.replace(/\r\n/g, "\n")
			const normalizedNewString = new_string.replace(/\r\n/g, "\n")

			// Check for exact match (literal string, not regex)
			const matchCount = fileContent.split(normalizedOldString).length - 1

			if (matchCount === 0) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("search_replace", "no_match")
				pushToolResult(
					formatResponse.toolError(
						`No match found for the specified 'old_string'. Please ensure it matches the file contents exactly, including whitespace and indentation.`,
					),
				)
				return
			}

			if (matchCount > 1) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("search_replace", "multiple_matches")
				pushToolResult(
					formatResponse.toolError(
						`Found ${matchCount} matches for the specified 'old_string'. This tool can only replace ONE occurrence at a time. Please provide more context (3-5 lines before and after) to uniquely identify the specific instance you want to change.`,
					),
				)
				return
			}

			// Apply the single replacement
			const newContent = fileContent.replace(normalizedOldString, normalizedNewString)

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
			task.recordToolUsage("search_replace")
			await getDiffViewProvider().reset()
			this.resetPartialState()
		} catch (error) {
			await handleError("search and replace", error as Error)
			await getDiffViewProvider().reset()
			this.resetPartialState()
		}
	}

	override async handlePartial(task: ITaskModel, block: ToolUse<"search_replace">): Promise<void> {
		const filePath: string | undefined = block.params.file_path
		const oldString: string | undefined = block.params.old_string

		// Wait for path to stabilize before showing UI (prevents truncated paths)
		if (!this.hasPathStabilized(filePath)) {
			return
		}

		let operationPreview: string | undefined
		if (oldString) {
			// Show a preview of what will be replaced
			const preview = oldString.length > 50 ? oldString.substring(0, 50) + "..." : oldString
			operationPreview = `replacing: "${preview}"`
		}

		// Determine relative path for display (filePath is guaranteed non-null after hasPathStabilized)
		let relPath = filePath!
		if (path.isAbsolute(relPath)) {
			relPath = path.relative(task.cwd, relPath)
		}

		const absolutePath = path.resolve(task.cwd, relPath)
		const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)

		const sharedMessageProps: SayToolData = {
			tool: "appliedDiff",
			path: getReadablePath(task.cwd, relPath),
			diff: operationPreview,
			isOutsideWorkspace,
		}

		await ask(task.taskId, "tool", JSON.stringify(sharedMessageProps), block.partial).catch(() => {})
	}
}

export const searchReplaceTool = new SearchReplaceTool()

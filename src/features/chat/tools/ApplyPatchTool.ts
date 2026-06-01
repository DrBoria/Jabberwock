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
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../../shared/tools"
import { parsePatch, ParseError, processAllHunks } from "../../../features/foundation/time-machine/apply"
import type { ApplyPatchFileChange } from "../../../features/foundation/time-machine/apply"
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

interface ApplyPatchParams {
	patch: string
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
		const { askApproval, handleError, pushToolResult } = callbacks

		try {
			// Validate required parameters
			if (!patch) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("apply_patch")
				pushToolResult(await sayAndCreateMissingParamError(task.taskId, "apply_patch", "patch"))
				return
			}

			// Parse the patch
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
				return
			}

			if (parsedPatch.hunks.length === 0) {
				pushToolResult("No file operations found in patch.")
				return
			}

			// Process each hunk
			const readFile = async (filePath: string): Promise<string> => {
				const absolutePath = path.resolve(task.cwd, filePath)
				return await getVirtualWorkspace().readFile(absolutePath, "utf8")
			}

			let changes: ApplyPatchFileChange[]
			try {
				changes = await processAllHunks(parsedPatch.hunks, readFile)
			} catch (error) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("apply_patch")
				const errorMessage = `Failed to process patch: ${error instanceof Error ? error.message : String(error)}`
				pushToolResult(formatResponse.toolError(errorMessage))
				return
			}

			// Process each file change
			for (const change of changes) {
				const relPath = change.path
				const absolutePath = path.resolve(task.cwd, relPath)

				// Check access permissions
				const accessAllowed = validateAccess(task.jabberwockIgnoreController, relPath, task.cwd)
				if (!accessAllowed) {
					await systemBroadcast(task.taskId, "rooignore_error", relPath)
					pushToolResult(formatResponse.jabberwockIgnoreError(relPath))
					return
				}

				// Check if file is write-protected
				const isFileWriteProtected = isWriteProtected(task.cwd, relPath)

				if (change.type === "add") {
					// Create new file
					await this.handleAddFile(change, absolutePath, relPath, task, callbacks, isFileWriteProtected)
				} else if (change.type === "delete") {
					// Delete file
					await this.handleDeleteFile(absolutePath, relPath, task, callbacks, isFileWriteProtected)
				} else if (change.type === "update") {
					// Update file
					await this.handleUpdateFile(change, absolutePath, relPath, task, callbacks, isFileWriteProtected)
				}
			}

			task._state.setConsecutiveMistakeCount(0)
			task.recordToolUsage("apply_patch")
		} catch (error) {
			await handleError("apply patch", error as Error)
			await getDiffViewProvider().reset()
		}
	}

	private async handleAddFile(
		change: ApplyPatchFileChange,
		absolutePath: string,
		relPath: string,
		task: ITaskModel,
		callbacks: ToolCallbacks,
		isFileWriteProtected: boolean,
	): Promise<void> {
		const { askApproval, pushToolResult } = callbacks

		// Check if file already exists
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

		// Initialize diff view for new file
		getDiffViewProvider().editType = "create"
		getDiffViewProvider().originalContent = undefined

		const diff = formatResponse.createPrettyPatch(relPath, "", newContent)

		// Check experiment settings
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

		// Show diff view if focus disruption prevention is disabled
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

		// Save the changes
		if (isPreventFocusDisruptionEnabled) {
			await getDiffViewProvider().saveDirectly(relPath, newContent, true, diagnosticsEnabled, writeDelayMs)
		} else {
			await getDiffViewProvider().saveChanges(diagnosticsEnabled, writeDelayMs)
		}

		// Track file edit operation
		await getFileContextTracker().trackFileContext(relPath, "roo_edited" as RecordSource)
		task.didEditFile = true

		const message = await getDiffViewProvider().pushToolWriteResult(task, task.cwd, true)
		pushToolResult(message)
		await getDiffViewProvider().reset()
	}

	private async handleDeleteFile(
		absolutePath: string,
		relPath: string,
		task: ITaskModel,
		callbacks: ToolCallbacks,
		isFileWriteProtected: boolean,
	): Promise<void> {
		const { askApproval, pushToolResult } = callbacks

		// Check if file exists
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

		// Delete the file
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

	private async handleUpdateFile(
		change: ApplyPatchFileChange,
		absolutePath: string,
		relPath: string,
		task: ITaskModel,
		callbacks: ToolCallbacks,
		isFileWriteProtected: boolean,
	): Promise<void> {
		const { askApproval, pushToolResult } = callbacks

		// Check if file exists
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

		// Initialize diff view
		getDiffViewProvider().editType = "modify"
		getDiffViewProvider().originalContent = originalContent

		// Generate and validate diff
		const diff = formatResponse.createPrettyPatch(relPath, originalContent, newContent)
		if (!diff) {
			pushToolResult(`No changes needed for '${relPath}'`)
			await getDiffViewProvider().reset()
			return
		}

		// Check experiment settings
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

		// Show diff view if focus disruption prevention is disabled
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

		// Handle file move if specified
		if (change.movePath) {
			const moveAbsolutePath = path.resolve(task.cwd, change.movePath)

			// Validate destination path access permissions
			const moveAccessAllowed = validateAccess(task.jabberwockIgnoreController, change.movePath, task.cwd)
			if (!moveAccessAllowed) {
				await systemBroadcast(task.taskId, "rooignore_error", change.movePath)
				pushToolResult(formatResponse.jabberwockIgnoreError(change.movePath))
				await getDiffViewProvider().reset()
				return
			}

			// Check if destination path is write-protected
			const isMovePathWriteProtected = isWriteProtected(task.cwd, change.movePath)
			if (isMovePathWriteProtected) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("apply_patch")
				const errorMessage = `Cannot move file to write-protected path: ${change.movePath}`
				await systemBroadcast(task.taskId, "error", errorMessage)
				pushToolResult(formatResponse.toolError(errorMessage))
				await getDiffViewProvider().reset()
				return
			}

			// Check if destination path is outside workspace
			const isMoveOutsideWorkspace = isPathOutsideWorkspace(moveAbsolutePath)
			if (isMoveOutsideWorkspace) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("apply_patch")
				const errorMessage = `Cannot move file to path outside workspace: ${change.movePath}`
				await systemBroadcast(task.taskId, "error", errorMessage)
				pushToolResult(formatResponse.toolError(errorMessage))
				await getDiffViewProvider().reset()
				return
			}

			// Save new content to the new path
			if (isPreventFocusDisruptionEnabled) {
				await getDiffViewProvider().saveDirectly(
					change.movePath,
					newContent,
					false,
					diagnosticsEnabled,
					writeDelayMs,
				)
			} else {
				// Write to new path and delete old file
				const parentDir = path.dirname(moveAbsolutePath)
				await getVirtualWorkspace().mkdir(parentDir, { recursive: true })
				await getVirtualWorkspace().writeFile(moveAbsolutePath, newContent, "utf8")
			}

			// Delete the original file
			try {
				await getVirtualWorkspace().unlink(absolutePath)
			} catch (error) {
				console.error(`[jabberwock] Failed to delete original file after move: ${error}`)
			}

			await getFileContextTracker().trackFileContext(change.movePath, "roo_edited" as RecordSource)

			await getFileContextTracker().trackFileContext(change.movePath, "roo_edited" as RecordSource)
		} else {
			// Save changes to the same file
			if (isPreventFocusDisruptionEnabled) {
				await getDiffViewProvider().saveDirectly(relPath, newContent, false, diagnosticsEnabled, writeDelayMs)
			} else {
				await getDiffViewProvider().saveChanges(diagnosticsEnabled, writeDelayMs)
			}

			await getFileContextTracker().trackFileContext(relPath, "roo_edited" as RecordSource)
		}

		task.didEditFile = true

		const message = await getDiffViewProvider().pushToolWriteResult(task, task.cwd, false)
		pushToolResult(message)
		await getDiffViewProvider().reset()
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
			// Show first few lines of the patch
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

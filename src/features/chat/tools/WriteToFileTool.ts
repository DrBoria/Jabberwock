import path from "path"
import delay from "delay"

import { type SayToolData, DEFAULT_WRITE_DELAY_MS } from "@jabberwock/types"

import type { ITaskModel } from "../../../features/chat/task/store"
import { formatResponse } from "../../settings/context/responses"
import { RecordSource } from "../../../features/foundation/time-machine/file-context/FileContextTrackerTypes"
import { fileExistsAtPath, createDirectoriesForFile } from "../../../utils/fs"
import { stripLineNumbers, everyLineHasLineNumbers } from "../../../integrations/misc/extract-text"
import { getReadablePath } from "../../../utils/path"
import { isPathOutsideWorkspace } from "../../../utils/pathUtils"
import { unescapeHtmlEntities } from "../../../utils/text-normalization"
import { EXPERIMENT_IDS, experiments } from "../../../shared/experiments"
import {
	convertNewFileToUnifiedDiff,
	computeDiffStats,
	sanitizeUnifiedDiff,
} from "../../../features/foundation/time-machine/actions/stats"
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

interface WriteToFileParams {
	path: string
	content: string
}

export class WriteToFileTool extends BaseTool<"write_to_file"> {
	readonly name = "write_to_file" as const

	async execute(params: WriteToFileParams, task: ITaskModel, callbacks: ToolCallbacks): Promise<void> {
		const { pushToolResult, handleError, askApproval } = callbacks
		const relPath = params.path
		let newContent = params.content

		if (!relPath) {
			task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
			task.recordToolError("write_to_file")
			pushToolResult(await sayAndCreateMissingParamError(task.taskId, "write_to_file", "path"))
			await getDiffViewProvider().reset()
			return
		}

		if (newContent === undefined) {
			task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
			task.recordToolError("write_to_file")
			pushToolResult(await sayAndCreateMissingParamError(task.taskId, "write_to_file", "content"))
			await getDiffViewProvider().reset()
			return
		}

		const accessAllowed = validateAccess(task.jabberwockIgnoreController, relPath, task.cwd)

		if (!accessAllowed) {
			await systemBroadcast(task.taskId, "rooignore_error", relPath)
			pushToolResult(formatResponse.jabberwockIgnoreError(relPath))
			return
		}

		const isFileWriteProtected = isWriteProtected(task.cwd, relPath)

		let fileExists: boolean
		const absolutePath = path.resolve(task.cwd, relPath)

		if (getDiffViewProvider().editType !== undefined) {
			fileExists = getDiffViewProvider().editType === "modify"
		} else {
			fileExists = await fileExistsAtPath(getVirtualWorkspace(), absolutePath)
			getDiffViewProvider().editType = fileExists ? "modify" : "create"
		}

		// Create parent directories early for new files to prevent ENOENT errors
		// in subsequent operations (e.g., diffViewProvider.open, fs.readFile)
		if (!fileExists) {
			await createDirectoriesForFile(absolutePath, getVirtualWorkspace())
		}

		if (newContent.startsWith("```")) {
			newContent = newContent.split("\n").slice(1).join("\n")
		}

		if (newContent.endsWith("```")) {
			newContent = newContent.split("\n").slice(0, -1).join("\n")
		}

		if (!task.api!.getModel().id.includes("claude")) {
			newContent = unescapeHtmlEntities(newContent)
		}

		const fullPath = relPath ? path.resolve(task.cwd, relPath) : ""
		const isOutsideWorkspace = isPathOutsideWorkspace(fullPath)

		const sharedMessageProps: SayToolData = {
			tool: fileExists ? "editedExistingFile" : "newFileCreated",
			path: getReadablePath(task.cwd, relPath),
			content: newContent,
			isOutsideWorkspace,
			isProtected: isFileWriteProtected,
		}

		try {
			task._state.setConsecutiveMistakeCount(0)

			const diagnosticsEnabled = true
			const writeDelayMs = DEFAULT_WRITE_DELAY_MS
			const isPreventFocusDisruptionEnabled = experiments.isEnabled({}, EXPERIMENT_IDS.PREVENT_FOCUS_DISRUPTION)

			if (isPreventFocusDisruptionEnabled) {
				getDiffViewProvider().editType = fileExists ? "modify" : "create"
				if (fileExists) {
					const absolutePath = path.resolve(task.cwd, relPath)
					getDiffViewProvider().originalContent = await getVirtualWorkspace().readFile(absolutePath)
				} else {
					getDiffViewProvider().originalContent = ""
				}

				let unified = fileExists
					? formatResponse.createPrettyPatch(relPath, getDiffViewProvider().originalContent, newContent)
					: convertNewFileToUnifiedDiff(newContent, relPath)
				unified = sanitizeUnifiedDiff(unified)
				const completeMessage = JSON.stringify({
					...sharedMessageProps,
					content: unified,
					diffStats: computeDiffStats(unified) || undefined,
				} satisfies SayToolData)

				const didApprove = await askApproval("tool", completeMessage, undefined, isFileWriteProtected)

				if (!didApprove) {
					return
				}

				await getDiffViewProvider().saveDirectly(relPath, newContent, false, diagnosticsEnabled, writeDelayMs)
			} else {
				if (!getDiffViewProvider().isEditing) {
					const partialMessage = JSON.stringify(sharedMessageProps)
					await ask(task.taskId, "tool", partialMessage, true).catch(() => {})
					await getDiffViewProvider().open(relPath)
				}

				await getDiffViewProvider().update(
					everyLineHasLineNumbers(newContent) ? stripLineNumbers(newContent) : newContent,
					true,
				)

				await delay(300)
				getDiffViewProvider().scrollToFirstDiff()

				let unified = fileExists
					? formatResponse.createPrettyPatch(relPath, getDiffViewProvider().originalContent, newContent)
					: convertNewFileToUnifiedDiff(newContent, relPath)
				unified = sanitizeUnifiedDiff(unified)
				const completeMessage = JSON.stringify({
					...sharedMessageProps,
					content: unified,
					diffStats: computeDiffStats(unified) || undefined,
				} satisfies SayToolData)

				const didApprove = await askApproval("tool", completeMessage, undefined, isFileWriteProtected)

				if (!didApprove) {
					await getDiffViewProvider().revertChanges()
					return
				}

				await getDiffViewProvider().saveChanges(diagnosticsEnabled, writeDelayMs)
			}

			if (relPath) {
				await getFileContextTracker().trackFileContext(relPath, "roo_edited" as RecordSource)
			}

			task.didEditFile = true

			const message = await getDiffViewProvider().pushToolWriteResult(task, task.cwd, !fileExists)

			pushToolResult(message)

			await getDiffViewProvider().reset()
			this.resetPartialState()

			return
		} catch (error) {
			await handleError("writing file", error as Error)
			await getDiffViewProvider().reset()
			this.resetPartialState()
			return
		}
	}

	override async handlePartial(task: ITaskModel, block: ToolUse<"write_to_file">): Promise<void> {
		const relPath: string | undefined = block.params.path
		let newContent: string | undefined = block.params.content

		// Wait for path to stabilize before showing UI (prevents truncated paths)
		if (!this.hasPathStabilized(relPath) || newContent === undefined) {
			return
		}

		const isPreventFocusDisruptionEnabled = experiments.isEnabled({}, EXPERIMENT_IDS.PREVENT_FOCUS_DISRUPTION)

		if (isPreventFocusDisruptionEnabled) {
			return
		}

		// relPath is guaranteed non-null after hasPathStabilized
		let fileExists: boolean
		const absolutePath = path.resolve(task.cwd, relPath!)

		if (getDiffViewProvider().editType !== undefined) {
			fileExists = getDiffViewProvider().editType === "modify"
		} else {
			fileExists = await fileExistsAtPath(getVirtualWorkspace(), absolutePath)
			getDiffViewProvider().editType = fileExists ? "modify" : "create"
		}

		// Create parent directories early for new files to prevent ENOENT errors
		// in subsequent operations (e.g., diffViewProvider.open)
		if (!fileExists) {
			await createDirectoriesForFile(absolutePath, getVirtualWorkspace())
		}

		const isFileWriteProtected = isWriteProtected(task.cwd, relPath!)
		const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)

		const sharedMessageProps: SayToolData = {
			tool: fileExists ? "editedExistingFile" : "newFileCreated",
			path: getReadablePath(task.cwd, relPath!),
			content: newContent || "",
			isOutsideWorkspace,
			isProtected: isFileWriteProtected,
		}

		const partialMessage = JSON.stringify(sharedMessageProps)
		await ask(task.taskId, "tool", partialMessage, block.partial).catch(() => {})

		if (newContent) {
			if (!getDiffViewProvider().isEditing) {
				await getDiffViewProvider().open(relPath!)
			}

			// Guard against calling update before open() has fully initialized
			// the diff view provider (activeLineController and fadedOverlayController).
			// This can happen when handlePartial is called multiple times concurrently
			// during streaming, before the first open() call completes.
			if (!getDiffViewProvider().isFullyInitialized()) {
				return
			}

			await getDiffViewProvider().update(
				everyLineHasLineNumbers(newContent) ? stripLineNumbers(newContent) : newContent,
				false,
			)
		}
	}
}

export const writeToFileTool = new WriteToFileTool()

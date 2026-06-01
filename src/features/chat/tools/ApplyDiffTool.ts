import path from "path"

import { type SayToolData, DEFAULT_WRITE_DELAY_MS } from "@jabberwock/types"
import { TelemetryService, getTelemetryService, hasTelemetryService } from "@jabberwock/telemetry"

import { getReadablePath } from "../../../utils/path"
import type { ITaskModel } from "../../../features/chat/task/store"
import { formatResponse } from "../../settings/context/responses"
import { fileExistsAtPath } from "../../../utils/fs"
import { RecordSource } from "../../../features/foundation/time-machine/file-context/FileContextTrackerTypes"
import { unescapeHtmlEntities } from "../../../utils/text-normalization"
import { EXPERIMENT_IDS, experiments } from "../../../shared/experiments"
import { computeDiffStats, sanitizeUnifiedDiff } from "../../../features/foundation/time-machine/actions/stats"
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

interface ApplyDiffParams {
	path: string
	diff: string
}

export class ApplyDiffTool extends BaseTool<"apply_diff"> {
	readonly name = "apply_diff" as const

	async execute(params: ApplyDiffParams, task: ITaskModel, callbacks: ToolCallbacks): Promise<void> {
		const { askApproval, handleError, pushToolResult } = callbacks
		let { path: relPath, diff: diffContent } = params

		if (diffContent && !task.api!.getModel().id.includes("claude")) {
			diffContent = unescapeHtmlEntities(diffContent)
		}

		try {
			if (!relPath) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("apply_diff")
				pushToolResult(await sayAndCreateMissingParamError(task.taskId, "apply_diff", "path"))
				return
			}

			if (!diffContent) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("apply_diff")
				pushToolResult(await sayAndCreateMissingParamError(task.taskId, "apply_diff", "diff"))
				return
			}

			const accessAllowed = validateAccess(task.jabberwockIgnoreController, relPath, task.cwd)

			if (!accessAllowed) {
				await systemBroadcast(task.taskId, "rooignore_error", relPath)
				pushToolResult(formatResponse.jabberwockIgnoreError(relPath))
				return
			}

			const absolutePath = path.resolve(task.cwd, relPath)
			const fileExists = await fileExistsAtPath(absolutePath, getVirtualWorkspace())

			if (!fileExists) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("apply_diff")
				const formattedError = `File does not exist at path: ${absolutePath}\n\n<error_details>\nThe specified file could not be found. Please verify the file path and try again.\n</error_details>`
				await systemBroadcast(task.taskId, "error", formattedError)
				task._state.setDidToolFailInCurrentTurn(true)
				pushToolResult(formattedError)
				return
			}

			const originalContent: string = await getVirtualWorkspace().readFile(absolutePath, "utf-8")

			// Apply the diff to the original content
			const diffResult = (await task.diffStrategy?.applyDiff(
				originalContent,
				diffContent,
				parseInt(params.diff.match(/:start_line:(\d+)/)?.[1] ?? ""),
			)) ?? {
				success: false,
				error: "No diff strategy available",
			}

			if (!diffResult.success) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				const currentCount = (task._state.consecutiveMistakeCountForApplyDiff[relPath] || 0) + 1
				task._state.setConsecutiveMistakeCountForApplyDiff({
					...task._state.consecutiveMistakeCountForApplyDiff,
					[relPath]: currentCount,
				})
				let formattedError = ""
				getTelemetryService().captureDiffApplicationError(task.taskId, currentCount)

				if (diffResult.failParts && diffResult.failParts.length > 0) {
					for (const failPart of diffResult.failParts) {
						if (failPart.success) {
							continue
						}

						const errorDetails = failPart["details"] ? JSON.stringify(failPart["details"], null, 2) : ""

						formattedError = `<error_details>\n${
							failPart["error"]
						}${errorDetails ? `\n\nDetails:\n${errorDetails}` : ""}\n</error_details>`
					}
				} else {
					const errorDetails = diffResult["details"] ? JSON.stringify(diffResult["details"], null, 2) : ""

					formattedError = `Unable to apply diff to file: ${absolutePath}\n\n<error_details>\n${
						diffResult["error"]
					}${errorDetails ? `\n\nDetails:\n${errorDetails}` : ""}\n</error_details>`
				}

				if (currentCount >= 2) {
					await systemBroadcast(task.taskId, "diff_error", formattedError)
				}

				task.recordToolError("apply_diff", formattedError)

				pushToolResult(formattedError)
				return
			}

			task._state.setConsecutiveMistakeCount(0)
			task._state.deleteConsecutiveMistakeCountForApplyDiffKey(relPath)

			// Generate backend-unified diff for display in chat/webview
			const unifiedPatchRaw = formatResponse.createPrettyPatch(relPath, originalContent, diffResult.content)
			const unifiedPatch = sanitizeUnifiedDiff(unifiedPatchRaw)
			const diffStats = computeDiffStats(unifiedPatch) || undefined

			// Check if preventFocusDisruption experiment is enabled
			const diagnosticsEnabled = true
			const writeDelayMs = DEFAULT_WRITE_DELAY_MS
			const isPreventFocusDisruptionEnabled = experiments.isEnabled({}, EXPERIMENT_IDS.PREVENT_FOCUS_DISRUPTION)

			// Check if file is write-protected
			const isFileWriteProtected = isWriteProtected(task.cwd, relPath)

			const sharedMessageProps: SayToolData = {
				tool: "appliedDiff",
				path: getReadablePath(task.cwd, relPath),
				diff: diffContent,
			}

			if (isPreventFocusDisruptionEnabled) {
				// Direct file write without diff view
				const completeMessage = JSON.stringify({
					...sharedMessageProps,
					diff: diffContent,
					content: unifiedPatch,
					originalContent,
					diffStats,
					isProtected: isFileWriteProtected,
				} satisfies SayToolData)

				let toolProgressStatus

				if (task.diffStrategy && task.diffStrategy.getProgressStatus) {
					const block: ToolUse<"apply_diff"> = {
						type: "tool_use",
						name: "apply_diff",
						params: { path: relPath, diff: diffContent },
						partial: false,
					}
					toolProgressStatus = task.diffStrategy.getProgressStatus(block, diffResult)
				}

				const didApprove = await askApproval("tool", completeMessage, toolProgressStatus, isFileWriteProtected)

				if (!didApprove) {
					return
				}

				// Save directly without showing diff view or opening the file
				getDiffViewProvider()!.editType = "modify"
				getDiffViewProvider()!.originalContent = originalContent
				await getDiffViewProvider()!.saveDirectly(
					relPath,
					diffResult.content,
					false,
					diagnosticsEnabled,
					writeDelayMs,
				)
			} else {
				// Original behavior with diff view
				// Show diff view before asking for approval
				getDiffViewProvider()!.editType = "modify"
				await getDiffViewProvider()!.open(relPath)
				await getDiffViewProvider()!.update(diffResult.content, true)
				getDiffViewProvider()!.scrollToFirstDiff()

				const completeMessage = JSON.stringify({
					...sharedMessageProps,
					diff: diffContent,
					content: unifiedPatch,
					originalContent,
					diffStats,
					isProtected: isFileWriteProtected,
				} satisfies SayToolData)

				let toolProgressStatus

				if (task.diffStrategy && task.diffStrategy.getProgressStatus) {
					const block: ToolUse<"apply_diff"> = {
						type: "tool_use",
						name: "apply_diff",
						params: { path: relPath, diff: diffContent },
						partial: false,
					}
					toolProgressStatus = task.diffStrategy.getProgressStatus(block, diffResult)
				}

				const didApprove = await askApproval("tool", completeMessage, toolProgressStatus, isFileWriteProtected)

				if (!didApprove) {
					await getDiffViewProvider()!.revertChanges()
					return
				}

				// Call saveChanges to update the DiffViewProvider properties
				await getDiffViewProvider()!.saveChanges(diagnosticsEnabled, writeDelayMs)
			}

			// Track file edit operation
			if (relPath) {
				await getFileContextTracker().trackFileContext(relPath, "roo_edited" as RecordSource)
			}

			// Used to determine if we should wait for busy terminal to update before sending api request
			task.didEditFile = true
			let partFailHint = ""

			if (diffResult.failParts && diffResult.failParts.length > 0) {
				partFailHint = `But unable to apply all diff parts to file: ${absolutePath}. Use the read_file tool to check the newest file version and re-apply diffs.\n`
			}

			// Get the formatted response message
			const message = await getDiffViewProvider()!.pushToolWriteResult(task, task.cwd, !fileExists)

			// Check for single SEARCH/REPLACE block warning
			const searchBlocks = (diffContent.match(/<<<<<<< SEARCH/g) || []).length
			const singleBlockNotice =
				searchBlocks === 1
					? "\n<notice>Making multiple related changes in a single apply_diff is more efficient. If other changes are needed in this file, please include them as additional SEARCH/REPLACE blocks.</notice>"
					: ""

			if (partFailHint) {
				pushToolResult(partFailHint + message + singleBlockNotice)
			} else {
				pushToolResult(message + singleBlockNotice)
			}

			await getDiffViewProvider()!.reset()
			this.resetPartialState()

			return
		} catch (error) {
			await handleError("applying diff", error as Error)
			await getDiffViewProvider()!.reset()
			this.resetPartialState()
			return
		}
	}

	override async handlePartial(task: ITaskModel, block: ToolUse<"apply_diff">): Promise<void> {
		const relPath: string | undefined = block.params.path
		const diffContent: string | undefined = block.params.diff

		// Wait for path to stabilize before showing UI (prevents truncated paths)
		if (!this.hasPathStabilized(relPath)) {
			return
		}

		const sharedMessageProps: SayToolData = {
			tool: "appliedDiff",
			path: getReadablePath(task.cwd, relPath),
			diff: diffContent,
		}

		let toolProgressStatus

		if (task.diffStrategy && task.diffStrategy.getProgressStatus) {
			toolProgressStatus = task.diffStrategy.getProgressStatus(block)
		}

		if (toolProgressStatus && Object.keys(toolProgressStatus).length === 0) {
			return
		}

		await ask(task.taskId, "tool", JSON.stringify(sharedMessageProps), block.partial, toolProgressStatus).catch(
			() => {},
		)
	}
}

export const applyDiffTool = new ApplyDiffTool()

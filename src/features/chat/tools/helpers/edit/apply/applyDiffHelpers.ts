import { type SayToolData, type ToolProgressStatus, DEFAULT_WRITE_DELAY_MS } from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"

import { getReadablePath } from "@utils/io/path"
import { unescapeHtmlEntities } from "@utils/text"
import { computeDiffStats, sanitizeUnifiedDiff } from "@features/foundation/time-machine/actions/stats"
import { RecordSource } from "@features/foundation/time-machine/file-context/FileContextTrackerTypes"
import type { ITaskModel } from "@features/chat/task/store"
import type { ToolUse } from "@shared/tools"
import { formatResponse } from "@features/settings/context/responses"
import { getFileContextTracker, getDiffViewProvider } from "@features/foundation/time-machine/actions/getTimeMachine"

import { isWriteProtected } from "@utils/protect"
import { ask } from "@features/chat/task/notifications/actions/ask/ask"

import type { DiffResult } from "@shared/tools"

export function escapeDiffContentIfNeeded(diffContent: string, task: ITaskModel): string {
	if (diffContent && !task.api!.getModel().id.includes("claude")) {
		return unescapeHtmlEntities(diffContent)
	}

	return diffContent
}

export function buildDiffFailureError(
	diffResult: DiffResult,
	absolutePath: string,
	task: ITaskModel,
	currentCount: number,
): string {
	getTelemetryService().captureDiffApplicationError(task.taskId, currentCount)

	if (diffResult.failParts && diffResult.failParts.length > 0) {
		return formatFailPartsError(diffResult)
	}

	return formatSingleDiffError(diffResult, absolutePath)
}

function formatFailPartsError(diffResult: DiffResult): string {
	if (!diffResult.failParts) {
		return ""
	}

	for (const failPart of diffResult.failParts) {
		if (failPart.success) {
			continue
		}

		const errorDetails = failPart.details ? JSON.stringify(failPart.details, null, 2) : ""

		return `<error_details>\n${failPart.error ?? ""}${errorDetails ? `\n\nDetails:\n${errorDetails}` : ""}\n</error_details>`
	}

	return ""
}

function formatSingleDiffError(diffResult: DiffResult, absolutePath: string): string {
	const errorDetails =
		"details" in diffResult && diffResult.details ? JSON.stringify(diffResult.details, null, 2) : ""

	return `Unable to apply diff to file: ${absolutePath}\n\n<error_details>\n${"error" in diffResult ? (diffResult.error ?? "") : ""}${errorDetails ? `\n\nDetails:\n${errorDetails}` : ""}\n</error_details>`
}

export function buildProgressStatus(
	task: ITaskModel,
	relPath: string,
	diffContent: string,
	diffResult?: DiffResult,
): ToolProgressStatus | undefined {
	if (task.diffStrategy && task.diffStrategy.getProgressStatus) {
		const block: ToolUse<"apply_diff"> = {
			type: "tool_use",
			name: "apply_diff",
			params: { path: relPath, diff: diffContent },
			partial: false,
		}

		return task.diffStrategy.getProgressStatus(block, diffResult)
	}

	return undefined
}

export function buildSharedMessageProps(task: ITaskModel, relPath: string, diff: string): SayToolData {
	return {
		tool: "appliedDiff",
		path: getReadablePath(task.cwd, relPath),
		diff,
	}
}

export function buildApprovalMessage(
	sharedMessageProps: SayToolData,
	originalContent: string,
	diffResult: DiffResult,
	task: ITaskModel,
	relPath: string,
): string {
	if (!diffResult.success) {
		return ""
	}

	const unifiedPatchRaw = formatResponse.createPrettyPatch(relPath, originalContent, diffResult.content)
	const unifiedPatch = sanitizeUnifiedDiff(unifiedPatchRaw)
	const diffStats = computeDiffStats(unifiedPatch) || undefined
	const isFileWriteProtected = isWriteProtected(task.cwd, relPath)

	return JSON.stringify({
		...sharedMessageProps,
		diff: diffResult.content,
		content: unifiedPatch,
		originalContent,
		diffStats,
		isProtected: isFileWriteProtected,
	} satisfies SayToolData)
}

export async function buildApplyDiffResult(
	diffResult: DiffResult,
	relPath: string,
	absolutePath: string,
	fileExists: boolean,
	task: ITaskModel,
	diffContent: string,
): Promise<string> {
	if (relPath) {
		await getFileContextTracker().trackFileContext(relPath, "roo_edited" as RecordSource)
	}

	task.didEditFile = true

	let partFailHint = ""

	if (diffResult.failParts && diffResult.failParts.length > 0) {
		partFailHint = `But unable to apply all diff parts to file: ${absolutePath}. Use the read_file tool to check the newest file version and re-apply diffs.\n`
	}

	const message = await getDiffViewProvider()!.pushToolWriteResult(task, task.cwd, !fileExists)

	const searchBlocks = (diffContent.match(/<<<<<<< SEARCH/g) || []).length
	const singleBlockNotice =
		searchBlocks === 1
			? "\n<notice>Making multiple related changes in a single apply_diff is more efficient. If other changes are needed in this file, please include them as additional SEARCH/REPLACE blocks.</notice>"
			: ""

	return partFailHint ? partFailHint + message + singleBlockNotice : message + singleBlockNotice
}

export async function saveDiffDirectly(
	relPath: string,
	diffResult: DiffResult,
	originalContent: string,
): Promise<void> {
	if (!diffResult.success) {
		return
	}

	const diagnosticsEnabled = true
	const writeDelayMs = DEFAULT_WRITE_DELAY_MS

	getDiffViewProvider()!.editType = "modify"
	getDiffViewProvider()!.originalContent = originalContent

	await getDiffViewProvider()!.saveDirectly(relPath, diffResult.content, false, diagnosticsEnabled, writeDelayMs)
}

export async function saveDiffWithView(
	relPath: string,
	diffResult: DiffResult,
	_originalContent: string,
): Promise<void> {
	if (!diffResult.success) {
		return
	}

	const diagnosticsEnabled = true
	const writeDelayMs = DEFAULT_WRITE_DELAY_MS

	getDiffViewProvider()!.editType = "modify"
	await getDiffViewProvider()!.open(relPath)
	await getDiffViewProvider()!.update(diffResult.content, true)
	getDiffViewProvider()!.scrollToFirstDiff()

	await getDiffViewProvider()!.saveChanges(diagnosticsEnabled, writeDelayMs)
}

export async function handleApplyDiffPartial(
	task: ITaskModel,
	block: ToolUse<"apply_diff">,
	hasPathStabilized: (path: string | undefined) => boolean,
): Promise<void> {
	const relPath: string | undefined = block.params.path
	const diffContent: string | undefined = block.params.diff

	if (!hasPathStabilized(relPath)) {
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

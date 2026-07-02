import path from "path"
import { type SayToolData, DEFAULT_WRITE_DELAY_MS } from "@jabberwock/types"
import { formatResponse } from "@features/settings/context/responses"
import { getReadablePath } from "@utils/io/path"
import { isPathOutsideWorkspace } from "@utils/io"
import { EXPERIMENT_IDS, experiments } from "@shared/experiments"
import { sanitizeUnifiedDiff, computeDiffStats } from "@features/foundation/time-machine/actions/stats"
import { getDiffViewProvider, getFileContextTracker } from "@features/foundation/time-machine/actions/getTimeMachine"
import { isWriteProtected } from "@utils/protect"
import type { ITaskModel } from "@features/chat/task/store"
import type { ToolCallbacks } from "@features/chat/tools/a-b/BaseTool"

export async function applySearchReplaceDiff(
	task: ITaskModel,
	relPath: string,
	fileContent: string,
	newContent: string,
	callbacks: Pick<ToolCallbacks, "askApproval" | "pushToolResult">,
): Promise<void> {
	const { askApproval, pushToolResult } = callbacks
	const absolutePath = path.resolve(task.cwd, relPath)
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
	const isFileWriteProtected = isWriteProtected(task.cwd, relPath)
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
	await getFileContextTracker().trackFileContext(relPath, "roo_edited" as const)
	task.didEditFile = true
	const message = await getDiffViewProvider().pushToolWriteResult(task, task.cwd, false)
	pushToolResult(message)
	task.recordToolUsage("search_replace")
	await getDiffViewProvider().reset()
}

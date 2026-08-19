import { DEFAULT_WRITE_DELAY_MS } from "@jabberwock/types"
import type { AskApproval } from "@shared/tools"
import type { ITaskModel } from "@features/chat/task/store"
import { formatResponse } from "@features/settings/context/responses"
import { RecordSource } from "@features/foundation/time-machine/file-context/FileContextTrackerTypes"
import { EXPERIMENT_IDS, experiments } from "@shared/experiments"
import {
	resetEditFileMistakeCount,
	buildEditApprovalMessage,
} from "@features/chat/tools/helpers/edit/core/editFileHelpers"
import { getDiffViewProvider, getFileContextTracker } from "@features/foundation/time-machine/actions/getTimeMachine"

export async function finalizeEditFileSave(
	relPath: string,
	newContent: string,
	isNewFile: boolean,
	diagnosticsEnabled: boolean,
	writeDelayMs: number,
	isPreventFocusDisruptionEnabled: boolean,
	task: ITaskModel,
	pushToolResult: (content: string) => void,
	expectedRepl: number,
	resetPartialState: () => void,
): Promise<void> {
	if (isPreventFocusDisruptionEnabled) {
		await getDiffViewProvider().saveDirectly(relPath, newContent, isNewFile, diagnosticsEnabled, writeDelayMs)
	} else {
		await getDiffViewProvider().saveChanges(diagnosticsEnabled, writeDelayMs)
	}

	if (relPath) {
		await getFileContextTracker().trackFileContext(relPath, "roo_edited" as RecordSource)
	}

	task.didEditFile = true

	const replacementInfo = !isNewFile && expectedRepl > 1 ? ` (${expectedRepl} replacements)` : ""
	const message = await getDiffViewProvider().pushToolWriteResult(task, task.cwd, isNewFile)

	pushToolResult(message + replacementInfo)
	task.recordToolUsage("edit_file")
	await getDiffViewProvider().reset()
	resetPartialState()
}

export async function handleEditFileApprovalAndSave(
	relPath: string,
	absolutePath: string,
	newContent: string,
	currentContent: string | null,
	isNewFile: boolean,
	task: ITaskModel,
	askApproval: AskApproval,
	pushToolResult: (content: string) => void,
	isFileWriteProtected: boolean,
	expectedRepl: number,
	resetPartialState: () => void,
): Promise<void> {
	resetEditFileMistakeCount(task, relPath)

	getDiffViewProvider().editType = isNewFile ? "create" : "modify"
	getDiffViewProvider().originalContent = currentContent || ""

	const diff = formatResponse.createPrettyPatch(relPath, currentContent || "", newContent)
	const diagnosticsEnabled = true
	const writeDelayMs = DEFAULT_WRITE_DELAY_MS
	const isPreventFocusDisruptionEnabled = experiments.isEnabled({}, EXPERIMENT_IDS.PREVENT_FOCUS_DISRUPTION)
	const completeMessage = buildEditApprovalMessage(
		task,
		relPath,
		absolutePath,
		currentContent,
		newContent,
		isNewFile,
		isFileWriteProtected,
		diff || "",
	)

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

	await finalizeEditFileSave(
		relPath,
		newContent,
		isNewFile,
		diagnosticsEnabled,
		writeDelayMs,
		isPreventFocusDisruptionEnabled,
		task,
		pushToolResult,
		expectedRepl,
		resetPartialState,
	)
}

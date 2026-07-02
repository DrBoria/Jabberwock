import path from "path"
import delay from "delay"

import { type SayToolData, DEFAULT_WRITE_DELAY_MS } from "@jabberwock/types"

import type { ITaskModel } from "@features/chat/task/store"
import type { ToolCallbacks } from "@features/chat/tools/a-b/BaseTool"
import { formatResponse } from "@features/settings/context/responses"
import { stripLineNumbers, everyLineHasLineNumbers } from "@integrations/misc/extract-text/helpers"
import {
	convertNewFileToUnifiedDiff,
	computeDiffStats,
	sanitizeUnifiedDiff,
} from "@features/foundation/time-machine/actions/stats"
import { getDiffViewProvider, getVirtualWorkspace } from "@features/foundation/time-machine/actions/getTimeMachine"
import { ask } from "@features/chat/task/notifications/actions/ask"

export async function executeWriteToFileFocusDisruption(
	fileExists: boolean,
	relPath: string,
	newContent: string,
	sharedMessageProps: SayToolData,
	askApproval: ToolCallbacks["askApproval"],
	isFileWriteProtected: boolean,
	task: ITaskModel,
): Promise<boolean> {
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
		return false
	}

	const diagnosticsEnabled = true
	const writeDelayMs = DEFAULT_WRITE_DELAY_MS
	await getDiffViewProvider().saveDirectly(relPath, newContent, false, diagnosticsEnabled, writeDelayMs)

	return true
}

export async function executeWriteToFileNormal(
	fileExists: boolean,
	relPath: string,
	newContent: string,
	sharedMessageProps: SayToolData,
	askApproval: ToolCallbacks["askApproval"],
	task: ITaskModel,
	isFileWriteProtected: boolean,
): Promise<boolean> {
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
		return false
	}

	const diagnosticsEnabled = true
	const writeDelayMs = DEFAULT_WRITE_DELAY_MS
	await getDiffViewProvider().saveChanges(diagnosticsEnabled, writeDelayMs)

	return true
}

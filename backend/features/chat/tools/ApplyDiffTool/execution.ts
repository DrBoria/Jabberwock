import { EXPERIMENT_IDS } from "@shared/core/experiments"
import { experiments as exp } from "@shared/core/experiments"
import type { DiffResult } from "@shared/tools"
import type { ToolCallbacks } from "@features/chat"
import { isWriteProtected } from "@utils/protect"
import type { ITaskModel } from "@features/chat/task"
import { emitBroadcast } from "@features/chat/task/messages/actions/say"
import { getDiffViewProvider } from "@features/foundation/time-machine"
import {
	buildDiffFailureError,
	buildProgressStatus,
	buildSharedMessageProps,
	buildApprovalMessage,
	buildApplyDiffResult,
	saveDiffDirectly,
	saveDiffWithView,
} from "@features/chat/tools/engine/edit/index"

export async function handleDiffFailure(
	diffResult: DiffResult,
	absolutePath: string,
	relPath: string,
	task: ITaskModel,
	pushToolResult: (content: string) => void,
): Promise<void> {
	task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
	const currentCount = (task._state.consecutiveMistakeCountForApplyDiff[relPath] || 0) + 1
	task._state.setConsecutiveMistakeCountForApplyDiff({
		...task._state.consecutiveMistakeCountForApplyDiff,
		[relPath]: currentCount,
	})

	const formattedError = buildDiffFailureError(diffResult, absolutePath, task, currentCount)

	if (currentCount >= 2) {
		await emitBroadcast("system", task.taskId, "diff_error", formattedError)
	}

	task.recordToolError("apply_diff", formattedError)
	pushToolResult(formattedError)
}

async function requestApproval(
	sharedMessageProps: ReturnType<typeof buildSharedMessageProps>,
	originalContent: string,
	diffResult: DiffResult,
	task: ITaskModel,
	relPath: string,
	askApproval: ToolCallbacks["askApproval"],
): Promise<boolean> {
	if (!diffResult.success) {
		return false
	}

	const completeMessage = buildApprovalMessage(sharedMessageProps, originalContent, diffResult, task, relPath)
	const toolProgressStatus = buildProgressStatus(task, relPath, diffResult.content, diffResult)

	const isFileWriteProtected = isWriteProtected(task.cwd, relPath)

	return askApproval("tool", completeMessage, toolProgressStatus, isFileWriteProtected)
}

export async function applyDiffWithApproval(
	diffResult: DiffResult,
	canonicalDiff: string,
	relPath: string,
	absolutePath: string,
	originalContent: string,
	task: ITaskModel,
	askApproval: ToolCallbacks["askApproval"],
	pushToolResult: (content: string) => void,
	resetPartialState: () => void,
): Promise<void> {
	if (!diffResult.success) {
		return
	}

	task._state.setConsecutiveMistakeCount(0)
	task._state.deleteConsecutiveMistakeCountForApplyDiffKey(relPath)

	const sharedMessageProps = buildSharedMessageProps(task, relPath, canonicalDiff)
	const isPreventFocusDisruptionEnabled = exp.isEnabled({}, EXPERIMENT_IDS.PREVENT_FOCUS_DISRUPTION)

	if (isPreventFocusDisruptionEnabled) {
		const didApprove = await requestApproval(
			sharedMessageProps,
			originalContent,
			diffResult,
			task,
			relPath,
			askApproval,
		)

		if (!didApprove) {
			return
		}

		await saveDiffDirectly(relPath, diffResult, originalContent)
	} else {
		getDiffViewProvider()!.editType = "modify"
		await getDiffViewProvider()!.open(relPath)
		await getDiffViewProvider()!.update(diffResult.content, true)
		getDiffViewProvider()!.scrollToFirstDiff()

		const didApprove = await requestApproval(
			sharedMessageProps,
			originalContent,
			diffResult,
			task,
			relPath,
			askApproval,
		)

		if (!didApprove) {
			await getDiffViewProvider()!.revertChanges()
			return
		}

		await saveDiffWithView(relPath, diffResult, originalContent)
	}

	const result = await buildApplyDiffResult(diffResult, relPath, absolutePath, true, task, canonicalDiff)

	pushToolResult(result)
	await getDiffViewProvider()!.reset()
	resetPartialState()
}

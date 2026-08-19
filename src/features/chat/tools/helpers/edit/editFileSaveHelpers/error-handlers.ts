import type { ITaskModel } from "@features/chat/task/store"
import { systemBroadcast } from "@features/chat/task/messages/actions/say"
import {
	resetEditFileMistakeCount,
	type ReplacementError,
	formatReplacementError,
} from "@features/chat/tools/helpers/edit/core/editFileHelpers"

export function recordEditFileFailure(relPath: string, formattedError: string, task: ITaskModel): void {
	const currentCount = (task._state.consecutiveMistakeCountForEditFile[relPath] || 0) + 1
	task._state.setConsecutiveMistakeCountForEditFile({
		...task._state.consecutiveMistakeCountForEditFile,
		[relPath]: currentCount,
	})

	if (currentCount >= 2) {
		systemBroadcast(task.taskId, "diff_error", formattedError)
	}
}

export async function handleEditFileReplacementError(
	error: ReplacementError,
	relPath: string,
	task: ITaskModel,
	pushToolResult: (content: string) => void,
	finalizePartialToolAsk: (relPath: string, task: ITaskModel) => Promise<void>,
): Promise<void> {
	task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
	task._state.setDidToolFailInCurrentTurn(true)
	const formattedError = formatReplacementError(error)
	await finalizePartialToolAsk(relPath, task)
	recordEditFileFailure(relPath, formattedError, task)
	task.recordToolError("edit_file", formattedError)
	pushToolResult(formattedError)
}

export async function handleEditFileNoChanges(
	relPath: string,
	task: ITaskModel,
	pushToolResult: (content: string) => void,
	finalizePartialToolAsk: (relPath: string, task: ITaskModel) => Promise<void>,
): Promise<void> {
	resetEditFileMistakeCount(task, relPath)
	await finalizePartialToolAsk(relPath, task)
	pushToolResult(`No changes needed for '${relPath}'`)
}

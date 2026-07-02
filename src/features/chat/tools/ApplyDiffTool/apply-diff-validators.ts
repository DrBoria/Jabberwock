import { fileExistsAtPath } from "@utils/io/fs"
import { validateAccess } from "@utils/ignore"
import { formatResponse } from "@features/settings/context/responses"
import { systemBroadcast } from "@features/chat/task/messages/actions/say"
import { sayAndCreateMissingParamError } from "@features/chat/task/messages/actions/command/sayAndCreateMissingParamError"
import { getVirtualWorkspace } from "@features/foundation/time-machine/actions/getTimeMachine"
import { escapeDiffContentIfNeeded } from "@features/chat/tools/helpers/edit"
import type { ITaskModel } from "@features/chat/task/store"

export async function validateInputs(
	relPath: string | undefined,
	diffContent: string | undefined,
	task: ITaskModel,
	pushToolResult: (content: string) => void,
): Promise<{ relPath: string; diffContent: string } | null> {
	if (!relPath) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("apply_diff")
		pushToolResult(await sayAndCreateMissingParamError(task.taskId, "apply_diff", "path"))
		return null
	}

	if (!diffContent) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("apply_diff")
		pushToolResult(await sayAndCreateMissingParamError(task.taskId, "apply_diff", "diff"))
		return null
	}

	return { relPath, diffContent: escapeDiffContentIfNeeded(diffContent, task) }
}

export async function checkAccess(
	relPath: string,
	absolutePath: string,
	task: ITaskModel,
	pushToolResult: (content: string) => void,
): Promise<boolean> {
	const accessAllowed = validateAccess(task.jabberwockIgnoreController, relPath, task.cwd)

	if (!accessAllowed) {
		await systemBroadcast(task.taskId, "rooignore_error", relPath)
		pushToolResult(formatResponse.jabberwockIgnoreError(relPath))
		return true
	}

	const fileExists = await fileExistsAtPath(absolutePath, getVirtualWorkspace())

	if (!fileExists) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("apply_diff")
		const formattedError = `File does not exist at path: ${absolutePath}\n\n<error_details>\nThe specified file could not be found. Please verify the file path and try again.\n</error_details>`
		await systemBroadcast(task.taskId, "error", formattedError)
		task._state.setDidToolFailInCurrentTurn(true)
		pushToolResult(formattedError)
		return true
	}

	return false
}

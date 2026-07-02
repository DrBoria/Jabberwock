import type { ITaskModel } from "@features/chat/task/store"
import { systemBroadcast } from "@features/chat/task/messages/actions/say"
import { getVirtualWorkspace } from "@features/foundation/time-machine/actions/getTimeMachine"
import {
	detectLineEnding,
	normalizeToLF,
	buildFileExistsError,
	buildReadFileError,
	buildFileNotFoundError,
	type LineEnding,
} from "@features/chat/tools/helpers/edit/core/editFileHelpers"

export async function readEditFileState(
	fileExists: boolean,
	absolutePath: string,
	oldString: string,
	relPath: string,
	task: ITaskModel,
	finalizePartialToolAsk: (relPath: string, task: ITaskModel) => Promise<void>,
	recordReadFailure: (relPath: string, formattedError: string, task: ITaskModel) => Promise<void>,
): Promise<{
	currentContent: string | null
	currentContentLF: string | null
	originalEol: LineEnding
	isNewFile: boolean
} | null> {
	if (fileExists) {
		try {
			const currentContent = await getVirtualWorkspace().readFile(absolutePath)
			const originalEol = detectLineEnding(currentContent)
			const currentContentLF = normalizeToLF(currentContent)

			if (oldString === "") {
				await finalizePartialToolAsk(relPath, task)
				await recordReadFailure(relPath, buildFileExistsError(absolutePath), task)
				return null
			}

			return { currentContent, currentContentLF, originalEol, isNewFile: false }
		} catch (error) {
			await finalizePartialToolAsk(relPath, task)
			const errorDetails = error instanceof Error ? error.message : String(error)
			await recordReadFailure(relPath, buildReadFileError(absolutePath, errorDetails), task)
			return null
		}
	}

	if (oldString === "") {
		return { currentContent: null, currentContentLF: null, originalEol: "\n", isNewFile: true }
	}

	await finalizePartialToolAsk(relPath, task)
	const formattedError = buildFileNotFoundError(absolutePath)
	await systemBroadcast(task.taskId, "error", formattedError)
	await recordReadFailure(relPath, formattedError, task)
	return null
}

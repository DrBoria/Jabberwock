import path from "path"

import type { ITaskModel } from "@features/chat/task/store"
import { formatResponse } from "@features/settings/context/responses"
import { fileExistsAtPath, createDirectoriesForFile } from "@utils/io/fs"
import { validateAccess } from "@utils/ignore"
import { isPathOutsideWorkspace } from "@utils/io"
import { isWriteProtected } from "@utils/protect"
import { systemBroadcast } from "@features/chat/task/messages/actions/say"
import { sayAndCreateMissingParamError } from "@features/chat/task/messages/actions/command/sayAndCreateMissingParamError"
import { getDiffViewProvider, getVirtualWorkspace } from "@features/foundation/time-machine/actions/getTimeMachine"

export async function validateWriteToFilePreConditions(
	relPath: string | undefined,
	newContent: string | undefined,
	task: ITaskModel,
	pushToolResult: (content: string) => void,
): Promise<{ relPath: string; newContent: string; isFileWriteProtected: boolean } | null> {
	if (!relPath) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("write_to_file")
		pushToolResult(await sayAndCreateMissingParamError(task.taskId, "write_to_file", "path"))
		await getDiffViewProvider().reset()
		return null
	}

	if (newContent === undefined) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("write_to_file")
		pushToolResult(await sayAndCreateMissingParamError(task.taskId, "write_to_file", "content"))
		await getDiffViewProvider().reset()
		return null
	}

	const accessAllowed = validateAccess(task.jabberwockIgnoreController, relPath, task.cwd)
	if (!accessAllowed) {
		await systemBroadcast(task.taskId, "rooignore_error", relPath)
		pushToolResult(formatResponse.jabberwockIgnoreError(relPath))
		return null
	}

	const isFileWriteProtected = isWriteProtected(task.cwd, relPath)

	return { relPath, newContent, isFileWriteProtected }
}

export async function prepareWriteToFileExistence(relPath: string, absolutePath: string): Promise<boolean> {
	let fileExists: boolean
	if (getDiffViewProvider().editType !== undefined) {
		fileExists = getDiffViewProvider().editType === "modify"
	} else {
		fileExists = await fileExistsAtPath(getVirtualWorkspace(), absolutePath)
		getDiffViewProvider().editType = fileExists ? "modify" : "create"
	}

	if (!fileExists) {
		await createDirectoriesForFile(absolutePath, getVirtualWorkspace())
	}

	return fileExists
}

export async function prepareWriteToFilePartialContext(
	relPath: string | undefined,
	task: ITaskModel,
): Promise<{
	fileExists: boolean
	isFileWriteProtected: boolean
	isOutsideWorkspace: boolean
	absolutePath: string
} | null> {
	if (!relPath) {
		return null
	}

	const absolutePath = path.resolve(task.cwd, relPath)
	let fileExists: boolean

	if (getDiffViewProvider().editType !== undefined) {
		fileExists = getDiffViewProvider().editType === "modify"
	} else {
		fileExists = await fileExistsAtPath(getVirtualWorkspace(), absolutePath)
		getDiffViewProvider().editType = fileExists ? "modify" : "create"
	}

	if (!fileExists) {
		await createDirectoriesForFile(absolutePath, getVirtualWorkspace())
	}

	const isFileWriteProtected = isWriteProtected(task.cwd, relPath)
	const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)

	return { fileExists, isFileWriteProtected, isOutsideWorkspace, absolutePath }
}

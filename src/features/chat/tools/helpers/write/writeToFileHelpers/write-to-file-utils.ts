import path from "path"

import { type SayToolData } from "@jabberwock/types"

import type { ITaskModel } from "@features/chat/task/store"
import { formatResponse } from "@features/settings/context/responses"
import { RecordSource } from "@features/foundation/time-machine/file-context/FileContextTrackerTypes"
import { getReadablePath } from "@utils/io/path"
import { isPathOutsideWorkspace } from "@utils/io"
import { unescapeHtmlEntities } from "@utils/text"
import { ask } from "@features/chat/task/notifications/actions/ask"
import { stripLineNumbers, everyLineHasLineNumbers } from "@integrations/misc/extract-text/helpers"
import { getDiffViewProvider, getFileContextTracker } from "@features/foundation/time-machine/actions/getTimeMachine"

export function processWriteToFileContent(newContent: string, task: ITaskModel): string {
	let content = newContent

	if (content.startsWith("```")) {
		content = content.split("\n").slice(1).join("\n")
	}

	if (content.endsWith("```")) {
		content = content.split("\n").slice(0, -1).join("\n")
	}

	if (!task.api!.getModel().id.includes("claude")) {
		content = unescapeHtmlEntities(content)
	}

	return content
}

export function buildWriteToFileSharedProps(
	relPath: string,
	fileExists: boolean,
	newContent: string,
	task: ITaskModel,
	isFileWriteProtected: boolean,
): SayToolData {
	const fullPath = path.resolve(task.cwd, relPath)
	const isOutsideWorkspace = isPathOutsideWorkspace(fullPath)

	return {
		tool: fileExists ? "editedExistingFile" : "newFileCreated",
		path: getReadablePath(task.cwd, relPath),
		content: newContent,
		isOutsideWorkspace,
		isProtected: isFileWriteProtected,
	}
}

export async function finalizeWriteToFile(
	relPath: string,
	task: ITaskModel,
	pushToolResult: (content: string) => void,
	isNewFile: boolean,
): Promise<void> {
	if (relPath) {
		await getFileContextTracker().trackFileContext(relPath, "roo_edited" as RecordSource)
	}

	task.didEditFile = true

	const message = await getDiffViewProvider().pushToolWriteResult(task, task.cwd, isNewFile)
	pushToolResult(message)
}

export function resetWriteToFileState(resetPartialState: () => void): void {
	getDiffViewProvider().reset()
	resetPartialState()
}

export async function updateWriteToFileDiffView(
	relPath: string,
	newContent: string | undefined,
	sharedMessageProps: SayToolData,
	task: ITaskModel,
	partial: boolean,
): Promise<void> {
	const partialMessage = JSON.stringify(sharedMessageProps)
	await ask(task.taskId, "tool", partialMessage, partial).catch(() => {})

	if (newContent) {
		if (!getDiffViewProvider().isEditing) {
			await getDiffViewProvider().open(relPath)
		}

		if (!getDiffViewProvider().isFullyInitialized()) {
			return
		}

		await getDiffViewProvider().update(
			everyLineHasLineNumbers(newContent) ? stripLineNumbers(newContent) : newContent,
			false,
		)
	}
}

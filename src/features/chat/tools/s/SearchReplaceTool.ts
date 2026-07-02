import path from "path"

import type { ITaskModel } from "@features/chat/task/store"
import type { ToolUse } from "@shared/tools"
import { getReadablePath } from "@utils/io/path"
import { isPathOutsideWorkspace } from "@utils/io"

import { BaseTool, ToolCallbacks } from "@features/chat/tools/a-b/BaseTool"
import { ask } from "@features/chat/task/notifications/actions/ask"
import { getDiffViewProvider } from "@features/foundation/time-machine/actions/getTimeMachine"

import {
	validateSearchReplaceParams,
	validateSearchReplaceAccess,
	readAndMatchContent,
	applySearchReplaceDiff,
} from "@features/chat/tools/helpers/edit"

interface SearchReplaceParams {
	file_path: string
	old_string: string
	new_string: string
}

export class SearchReplaceTool extends BaseTool<"search_replace"> {
	readonly name = "search_replace" as const

	async execute(params: SearchReplaceParams, task: ITaskModel, callbacks: ToolCallbacks): Promise<void> {
		const { file_path, old_string, new_string } = params
		const { askApproval, handleError, pushToolResult } = callbacks

		try {
			const validationResult = await validateSearchReplaceParams(
				task,
				{ file_path, old_string, new_string },
				pushToolResult,
			)
			if (!validationResult) return

			const { relPath } = validationResult

			const accessResult = await validateSearchReplaceAccess(task, relPath, pushToolResult)
			if (!accessResult) return

			const { absolutePath, isFileWriteProtected } = accessResult

			const matchResult = await readAndMatchContent(
				absolutePath,
				relPath,
				old_string,
				new_string,
				task,
				pushToolResult,
			)
			if (!matchResult) return

			task._state.setConsecutiveMistakeCount(0)

			await applySearchReplaceDiff(task, relPath, matchResult.fileContent, matchResult.newContent, {
				askApproval,
				pushToolResult,
			})
		} catch (error) {
			await handleError("search and replace", error as Error)
			await getDiffViewProvider().reset()
			this.resetPartialState()
		}
	}

	override async handlePartial(task: ITaskModel, block: ToolUse<"search_replace">): Promise<void> {
		const filePath: string | undefined = block.params.file_path
		const oldString: string | undefined = block.params.old_string

		// Wait for path to stabilize before showing UI (prevents truncated paths)
		if (!this.hasPathStabilized(filePath)) {
			return
		}

		let operationPreview: string | undefined
		if (oldString) {
			// Show a preview of what will be replaced
			const preview = oldString.length > 50 ? oldString.substring(0, 50) + "..." : oldString
			operationPreview = `replacing: "${preview}"`
		}

		// Determine relative path for display (filePath is guaranteed non-null after hasPathStabilized)
		let relPath = filePath!
		if (path.isAbsolute(relPath)) {
			relPath = path.relative(task.cwd, relPath)
		}

		const absolutePath = path.resolve(task.cwd, relPath)
		const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)

		const sharedMessageProps = {
			tool: "appliedDiff" as const,
			path: getReadablePath(task.cwd, relPath),
			diff: operationPreview,
			isOutsideWorkspace,
		}

		await ask(task.taskId, "tool", JSON.stringify(sharedMessageProps), block.partial).catch(() => {})
	}
}

export const searchReplaceTool = new SearchReplaceTool()

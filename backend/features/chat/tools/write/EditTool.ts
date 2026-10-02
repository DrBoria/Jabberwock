import path from "path"
import { type SayToolData } from "@jabberwock/types"
import { getReadablePath } from "@utils/io/main"
import { isPathOutsideWorkspace } from "@utils/io"
import type { ITaskModel } from "@features/chat/task"
import { formatResponse } from "@features/settings"
import type { ToolUse } from "@shared/tools"
import { ToolCallbacks } from "@features/chat"
import { createTool } from "@features/chat/tools/tool"
import { ask } from "@features/chat/task/notifications/actions/ask"
import { emitBroadcast } from "@features/chat/task/messages/actions/say"
import { validateAccess } from "@utils/ignore"
import { isWriteProtected } from "@utils/protect"
import { getDiffViewProvider } from "@features/foundation/time-machine"
import {
	validateEditParams,
	readAndValidateEditFile,
	requestEditApprovalAndSave,
} from "@features/chat/tools/engine/edit/index"

interface EditParams {
	file_path: string
	old_string: string
	new_string: string
	replace_all?: boolean
}

export const editTool = createTool<"edit">({
	name: "edit" as const,

	async execute(params: EditParams, task: ITaskModel, callbacks: ToolCallbacks): Promise<void> {
		const { file_path: relPath, old_string: oldString, new_string: newString, replace_all: replaceAll } = params
		const { askApproval, handleError, pushToolResult } = callbacks

		try {
			if (!(await validateEditParams(relPath, oldString, newString, task, pushToolResult))) return

			const accessAllowed = validateAccess(task.jabberwockIgnoreController, relPath, task.cwd)
			if (!accessAllowed) {
				await emitBroadcast("system", task.taskId, "rooignore_error", relPath)
				pushToolResult(formatResponse.jabberwockIgnoreError(relPath))
				return
			}

			const absolutePath = path.resolve(task.cwd, relPath)
			const isFileWriteProtected = isWriteProtected(task.cwd, relPath)

			const result = await readAndValidateEditFile(
				absolutePath,
				oldString,
				newString,
				replaceAll,
				relPath,
				task,
				pushToolResult,
			)
			if (!result) return

			task._state.setConsecutiveMistakeCount(0)

			await requestEditApprovalAndSave(
				relPath,
				absolutePath,
				result.fileContent,
				result.newContent,
				isFileWriteProtected,
				task,
				askApproval,
				pushToolResult,
			)

			task.recordToolUsage("edit")
			await getDiffViewProvider().reset()
			this.resetPartialState()
		} catch (error) {
			await handleError("edit", error as Error)
			await getDiffViewProvider().reset()
			this.resetPartialState()
		}
	},

	async handlePartial(task: ITaskModel, block: ToolUse<"edit">): Promise<void> {
		const relPath: string | undefined = block.params.file_path
		if (!this.hasPathStabilized(relPath)) return

		const absolutePath = path.resolve(task.cwd, relPath!)
		const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)

		const sharedMessageProps: SayToolData = {
			tool: "appliedDiff",
			path: getReadablePath(task.cwd, relPath!),
			diff: block.params.old_string ? "1 edit operation" : undefined,
			isOutsideWorkspace,
		}

		await ask(task.taskId, "tool", JSON.stringify(sharedMessageProps), block.partial).catch(() => {})
	},
})
export const searchAndReplaceTool = editTool

import path from "path"
import { type SayToolData } from "@jabberwock/types"
import { getReadablePath } from "@utils/io/main"
import { isPathOutsideWorkspace } from "@utils/io"
import type { ITaskModel } from "@features/chat/task"
import { formatResponse } from "@features/settings"
import { fileExistsAtPath } from "@utils/io/fs"
import type { ToolUse } from "@shared/tools"
import { createTool, ToolCallbacks } from "@features/chat/tools/tool"
import { ask } from "@features/chat/task/notifications/actions/ask"
import { emitBroadcast } from "@features/chat/task/messages/actions/say"
import { sayAndCreateMissingParamError } from "@features/chat/task/messages/actions/command/sayAndCreateMissingParamError"
import { getDiffViewProvider, getVirtualWorkspace } from "@features/foundation/time-machine"
import { isWriteProtected } from "@utils/protect"
import { validateAccess } from "@utils/ignore"
import { normalizeToLF, coerceStringParam, resolveRelativePath } from "@features/chat"
import {
	recordEditFileFailure,
	handleEditFilePartial,
	readEditFileState,
} from "@features/chat/tools/engine/edit/editFileSaveHelpers/index"
import type { EditFileParams } from "./types"
import { handleFileEdit } from "./handle-edit"

interface EditFileExtras {
	didSendPartialToolAsk: boolean
	partialToolAskRelPath: string | undefined
	checkAccessAllowed(relPath: string, task: ITaskModel): boolean
	finalizePartialToolAsk(relPath: string, task: ITaskModel): Promise<void>
	recordReadFailure(relPath: string, formattedError: string, task: ITaskModel): Promise<void>
}

export const editFileTool = createTool<"edit_file", EditFileExtras>({
	name: "edit_file" as const,
	didSendPartialToolAsk: false as boolean,
	partialToolAskRelPath: undefined as string | undefined,

	async execute(params: EditFileParams, task: ITaskModel, callbacks: ToolCallbacks): Promise<void> {
		const file_path = params.file_path
		const old_string = coerceStringParam(params.old_string)
		const new_string = coerceStringParam(params.new_string)
		const expected_replacements = params.expected_replacements ?? 1
		const { askApproval, handleError, pushToolResult } = callbacks
		let relPathForErrorHandling: string | undefined

		try {
			if (!file_path) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("edit_file")
				task._state.setDidToolFailInCurrentTurn(true)
				pushToolResult(await sayAndCreateMissingParamError(task.taskId, "edit_file", "file_path"))
				return
			}

			const relPath = resolveRelativePath(file_path, task.cwd)
			relPathForErrorHandling = relPath

			if (!this.checkAccessAllowed(relPath, task)) {
				await this.finalizePartialToolAsk(relPath, task)
				task._state.setDidToolFailInCurrentTurn(true)
				await emitBroadcast("system", task.taskId, "rooignore_error", relPath)
				pushToolResult(formatResponse.jabberwockIgnoreError(relPath))
				return
			}

			const isFileWriteProtected = isWriteProtected(task.cwd, relPath)
			const absolutePath = path.resolve(task.cwd, relPath)
			const fileExists = await fileExistsAtPath(getVirtualWorkspace(), absolutePath)
			const fileState = await readEditFileState(
				fileExists,
				absolutePath,
				old_string,
				relPath,
				task,
				(r, t) => this.finalizePartialToolAsk(r, t),
				(r, f, t) => this.recordReadFailure(r, f, t),
			)

			if (fileState === null) {
				return
			}

			const { currentContent, currentContentLF, originalEol, isNewFile } = fileState
			const oldLF = normalizeToLF(old_string)
			const newLF = normalizeToLF(new_string)
			const expectedRepl = Math.max(1, expected_replacements)

			await handleFileEdit(
				isNewFile,
				currentContentLF,
				currentContent,
				originalEol,
				oldLF,
				newLF,
				expectedRepl,
				absolutePath,
				relPath,
				task,
				askApproval,
				pushToolResult,
				isFileWriteProtected,
				new_string,
				() => this.resetPartialState(),
				(r, t) => this.finalizePartialToolAsk(r, t),
			)
		} catch (error) {
			if (relPathForErrorHandling) {
				await this.finalizePartialToolAsk(relPathForErrorHandling, task)
			}
			await handleError("edit_file", error as Error)
			await getDiffViewProvider().reset()
			task._state.setDidToolFailInCurrentTurn(true)
		} finally {
			this.didSendPartialToolAsk = false
			this.partialToolAskRelPath = undefined
			this.resetPartialState()
		}
	},

	checkAccessAllowed(relPath: string, task: ITaskModel): boolean {
		return validateAccess(task.jabberwockIgnoreController, relPath, task.cwd)
	},

	async finalizePartialToolAsk(relPath: string, task: ITaskModel): Promise<void> {
		if (!this.didSendPartialToolAsk) {
			return
		}

		if (this.partialToolAskRelPath && this.partialToolAskRelPath !== relPath) {
			return
		}

		const absolutePath = path.resolve(task.cwd, relPath)
		const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)
		const sharedMessageProps: SayToolData = {
			tool: "appliedDiff",
			path: getReadablePath(task.cwd, relPath),
			diff: undefined,
			isOutsideWorkspace,
		}

		await ask(task.taskId, "tool", JSON.stringify(sharedMessageProps), false).catch(() => {})
	},

	async recordReadFailure(relPath: string, formattedError: string, task: ITaskModel): Promise<void> {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task._state.setDidToolFailInCurrentTurn(true)
		recordEditFileFailure(relPath, formattedError, task)
		task.recordToolError("edit_file", formattedError)
	},

	async handlePartial(task: ITaskModel, block: ToolUse<"edit_file">): Promise<void> {
		const filePath: string | undefined = block.params.file_path
		const oldString: string | undefined = block.params.old_string
		await handleEditFilePartial(
			task,
			filePath,
			oldString,
			block.partial,
			(p) => this.hasPathStabilized(p),
			(relPath) => {
				this.didSendPartialToolAsk = true
				this.partialToolAskRelPath = relPath
			},
		)
	},
})

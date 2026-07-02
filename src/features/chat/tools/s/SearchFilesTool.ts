import path from "path"

import { type SayToolData } from "@jabberwock/types"

import type { ITaskModel } from "@features/chat/task/store"
import { getReadablePath } from "@utils/io/path"
import { isPathOutsideWorkspace } from "@utils/io"
import { regexSearchFiles } from "@services/ripgrep"
import type { ToolUse } from "@shared/tools"

import { BaseTool, ToolCallbacks } from "@features/chat/tools/a-b/BaseTool"
import { ask } from "@features/chat/task/notifications/actions/ask"
import { sayAndCreateMissingParamError } from "@features/chat/task/messages/actions/command/sayAndCreateMissingParamError"

interface SearchFilesParams {
	path: string
	regex: string
	file_pattern?: string | null
}

export class SearchFilesTool extends BaseTool<"search_files"> {
	readonly name = "search_files" as const

	async execute(params: SearchFilesParams, task: ITaskModel, callbacks: ToolCallbacks): Promise<void> {
		const { askApproval, handleError, pushToolResult } = callbacks

		const relDirPath = params.path
		const regex = params.regex
		const filePattern = params.file_pattern || undefined

		if (!relDirPath) {
			task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
			task.recordToolError("search_files")
			task._state.setDidToolFailInCurrentTurn(true)
			pushToolResult(await sayAndCreateMissingParamError(task.taskId, "search_files", "path"))
			return
		}

		if (!regex) {
			task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
			task.recordToolError("search_files")
			task._state.setDidToolFailInCurrentTurn(true)
			pushToolResult(await sayAndCreateMissingParamError(task.taskId, "search_files", "regex"))
			return
		}

		task._state.setConsecutiveMistakeCount(0)

		const absolutePath = path.resolve(task.cwd, relDirPath)
		const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)

		const sharedMessageProps: SayToolData = {
			tool: "searchFiles",
			path: getReadablePath(task.cwd, relDirPath),
			regex: regex,
			filePattern: filePattern,
			isOutsideWorkspace,
		}

		try {
			const results = await regexSearchFiles(
				task.cwd,
				absolutePath,
				regex,
				filePattern,
				task.jabberwockIgnoreController,
			)

			const completeMessage = JSON.stringify({ ...sharedMessageProps, content: results } satisfies SayToolData)
			const didApprove = await askApproval("tool", completeMessage)

			if (!didApprove) {
				return
			}

			pushToolResult(results)
		} catch (error) {
			await handleError("searching files", error as Error)
		}
	}

	override async handlePartial(task: ITaskModel, block: ToolUse<"search_files">): Promise<void> {
		const relDirPath = block.params.path
		const regex = block.params.regex
		const filePattern = block.params.file_pattern

		const absolutePath = relDirPath ? path.resolve(task.cwd, relDirPath) : task.cwd
		const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)

		const sharedMessageProps: SayToolData = {
			tool: "searchFiles",
			path: getReadablePath(task.cwd, relDirPath ?? ""),
			regex: regex ?? "",
			filePattern: filePattern ?? "",
			isOutsideWorkspace,
		}

		const partialMessage = JSON.stringify({ ...sharedMessageProps, content: "" } satisfies SayToolData)
		await ask(task.taskId, "tool", partialMessage, block.partial).catch(() => {})
	}
}

export const searchFilesTool = new SearchFilesTool()

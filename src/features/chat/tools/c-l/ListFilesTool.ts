import * as path from "path"

import { type SayToolData } from "@jabberwock/types"

import type { ITaskModel } from "@features/chat/task/store"
import { formatResponse } from "@features/settings/context/responses"
import { listFiles } from "@services/glob/list-files"
import { getReadablePath } from "@utils/io/path"
import { isPathOutsideWorkspace } from "@utils/io"
import type { ToolUse } from "@shared/tools"

import { BaseTool, ToolCallbacks } from "@features/chat/tools/a-b/BaseTool"
import { ask } from "@features/chat/task/notifications/actions/ask"
import { sayAndCreateMissingParamError } from "@features/chat/task/messages/actions/command/sayAndCreateMissingParamError"

import { getVirtualWorkspace } from "@features/foundation/time-machine/actions/getTimeMachine"

interface ListFilesParams {
	path: string
	recursive?: boolean
}

export class ListFilesTool extends BaseTool<"list_files"> {
	readonly name = "list_files" as const

	async execute(params: ListFilesParams, task: ITaskModel, callbacks: ToolCallbacks): Promise<void> {
		const { path: relDirPath, recursive } = params
		const { askApproval, handleError, pushToolResult } = callbacks

		try {
			if (!relDirPath) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("list_files")
				task._state.setDidToolFailInCurrentTurn(true)
				pushToolResult(await sayAndCreateMissingParamError(task.taskId, "list_files", "path"))
				return
			}

			task._state.setConsecutiveMistakeCount(0)

			const absolutePath = path.resolve(task.cwd, relDirPath)
			const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)

			const [files, didHitLimit] = await listFiles(absolutePath, recursive || false, 200, getVirtualWorkspace())
			const showJabberwockIgnoredFiles = false

			const result = formatResponse.formatFilesList(
				absolutePath,
				files,
				didHitLimit,
				task.jabberwockIgnoreController,
				showJabberwockIgnoredFiles as boolean,
				task.cwd,
			)

			const sharedMessageProps: SayToolData = {
				tool: !recursive ? "listFilesTopLevel" : "listFilesRecursive",
				path: getReadablePath(task.cwd, relDirPath),
				isOutsideWorkspace,
			}

			const completeMessage = JSON.stringify({ ...sharedMessageProps, content: result } satisfies SayToolData)
			const didApprove = await askApproval("tool", completeMessage)

			if (!didApprove) {
				return
			}

			pushToolResult(result)
		} catch (error) {
			await handleError("listing files", error instanceof Error ? error : new Error(String(error)))
		}
	}

	override async handlePartial(task: ITaskModel, block: ToolUse<"list_files">): Promise<void> {
		const relDirPath: string | undefined = block.params.path
		const recursiveRaw: string | undefined = block.params.recursive
		const recursive = recursiveRaw?.toLowerCase() === "true"

		const absolutePath = relDirPath ? path.resolve(task.cwd, relDirPath) : task.cwd
		const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)

		const sharedMessageProps: SayToolData = {
			tool: !recursive ? "listFilesTopLevel" : "listFilesRecursive",
			path: getReadablePath(task.cwd, relDirPath ?? ""),
			isOutsideWorkspace,
		}

		const partialMessage = JSON.stringify({ ...sharedMessageProps, content: "" } satisfies SayToolData)
		await ask(task.taskId, "tool", partialMessage, block.partial).catch(() => {})
	}
}

export const listFilesTool = new ListFilesTool()

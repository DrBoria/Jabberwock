import * as fs from "fs/promises"

import type { ITaskModel } from "@features/chat/task/store"

import { BaseTool, ToolCallbacks } from "@features/chat/tools/a-b/BaseTool"
import { agentBroadcast, systemBroadcast } from "@features/chat/task/messages/actions/say"
import {
	DEFAULT_LIMIT,
	validateReadCommandOutputParams,
	readArtifact,
	searchInArtifact,
} from "@features/chat/tools/helpers/readoutput"

interface ReadCommandOutputParams {
	artifact_id: string
	search?: string
	offset?: number
	limit?: number
}

export class ReadCommandOutputTool extends BaseTool<"read_command_output"> {
	readonly name = "read_command_output" as const

	async execute(params: ReadCommandOutputParams, task: ITaskModel, callbacks: ToolCallbacks): Promise<void> {
		const { pushToolResult } = callbacks
		const { artifact_id, search, offset = 0, limit = DEFAULT_LIMIT } = params

		const artifactInfo = await validateReadCommandOutputParams(task, artifact_id, pushToolResult)
		if (!artifactInfo) return

		const { artifactPath, totalSize } = artifactInfo

		if (offset < 0 || offset >= totalSize) {
			const errorMsg = `Invalid offset: ${offset}. File size is ${totalSize} bytes. Offset must be between 0 and ${totalSize - 1}.`
			await systemBroadcast(task.taskId, "error", errorMsg)
			pushToolResult(`Error: ${errorMsg}`)
			return
		}

		try {
			let result: string
			let readStart = 0
			let readEnd = 0
			let matchCount: number | undefined

			if (search) {
				const searchResult = await searchInArtifact(artifactPath, search, totalSize, limit)
				result = searchResult.content
				matchCount = searchResult.matchCount
				readEnd = totalSize
			} else {
				result = await readArtifact(artifactPath, offset, limit, totalSize)
				readStart = offset
				readEnd = Math.min(offset + limit, totalSize)
			}

			await agentBroadcast(
				task.taskId,
				"tool",
				JSON.stringify({
					tool: "readCommandOutput",
					readStart,
					readEnd,
					totalBytes: totalSize,
					...(search && { searchPattern: search, matchCount }),
				}),
			)

			task._state.setConsecutiveMistakeCount(0)
			pushToolResult(result)
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error)
			await systemBroadcast(task.taskId, "error", `Error reading command output: ${errorMsg}`)
			task._state.setDidToolFailInCurrentTurn(true)
			pushToolResult(`Error reading command output: ${errorMsg}`)
		}
	}
}

export const readCommandOutputTool = new ReadCommandOutputTool()

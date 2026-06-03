import * as vscode from "vscode"
import path from "path"

import type { ITaskModel } from "../../../features/chat/task/store"
import { CodeIndexManager, getCodeIndexManager } from "../../../services/code-index/manager"
import { getWorkspacePath } from "../../../utils/path"
import { formatResponse } from "../../settings/context/responses"
import { VectorStoreSearchResult } from "../../../services/code-index/interfaces"
import type { ToolUse } from "../../../shared/tools"

import { BaseTool, ToolCallbacks } from "./BaseTool"
import { ask } from "../task/notifications/actions/ask"
import { systemBroadcast } from "../task/messages/actions/say"
import { sayAndCreateMissingParamError } from "../task/messages/actions/missingParamError"

interface CodebaseSearchParams {
	query: string
	path?: string
}

export class CodebaseSearchTool extends BaseTool<"codebase_search"> {
	readonly name = "codebase_search" as const

	async execute(params: CodebaseSearchParams, task: ITaskModel, callbacks: ToolCallbacks): Promise<void> {
		const { askApproval, handleError, pushToolResult } = callbacks
		const { query, path: directoryPrefix } = params

		const workspacePath = task.cwd && task.cwd.trim() !== "" ? task.cwd : getWorkspacePath()

		if (!workspacePath) {
			await handleError("codebase_search", new Error("Could not determine workspace path."))
			return
		}

		if (!query) {
			task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
			task._state.setDidToolFailInCurrentTurn(true)
			pushToolResult(await sayAndCreateMissingParamError(task.taskId, "codebase_search", "query"))
			return
		}

		const sharedMessageProps = {
			tool: "codebaseSearch",
			query: query,
			path: directoryPrefix,
			isOutsideWorkspace: false,
		}

		const didApprove = await askApproval("tool", JSON.stringify(sharedMessageProps))
		if (!didApprove) {
			pushToolResult(formatResponse.toolDenied())
			return
		}

		task._state.setConsecutiveMistakeCount(0)

		try {
			const context = task.providerRef!.deref()?.context
			if (!context) {
				throw new Error("Extension context is not available.")
			}

			const manager = getCodeIndexManager(context as vscode.ExtensionContext)

			if (!manager) {
				throw new Error("CodeIndexManager is not available.")
			}

			if (!manager.isFeatureEnabled) {
				throw new Error("Code Indexing is disabled in the settings.")
			}
			if (!manager.isFeatureConfigured) {
				throw new Error("Code Indexing is not configured (Missing OpenAI Key or Qdrant URL).")
			}

			const searchResults: VectorStoreSearchResult[] = await manager.searchIndex(query, directoryPrefix)

			if (!searchResults || searchResults.length === 0) {
				pushToolResult(`No relevant code snippets found for the query: "${query}"`)
				return
			}

			const jsonResult = {
				query,
				results: [],
			} as {
				query: string
				results: Array<{
					filePath: string
					score: number
					startLine: number
					endLine: number
					codeChunk: string
				}>
			}

			searchResults.forEach((result) => {
				if (!result.payload) return
				if (!("filePath" in result.payload)) return

				const relativePath = vscode.workspace.asRelativePath(result.payload.filePath, false)

				jsonResult.results.push({
					filePath: relativePath,
					score: result.score,
					startLine: result.payload.startLine,
					endLine: result.payload.endLine,
					codeChunk: result.payload.codeChunk.trim(),
				})
			})

			const payload = { tool: "codebaseSearch", content: jsonResult }
			await systemBroadcast(task.taskId, "codebase_search_result", JSON.stringify(payload))

			const output = `Query: ${query}
Results:

${jsonResult.results
	.map(
		(result) => `File path: ${result.filePath}
Score: ${result.score}
Lines: ${result.startLine}-${result.endLine}
Code Chunk: ${result.codeChunk}
`,
	)
	.join("\n")}`

			pushToolResult(output)
		} catch (error) {
			await handleError("codebase_search", error instanceof Error ? error : new Error(String(error)))
		}
	}

	override async handlePartial(task: ITaskModel, block: ToolUse<"codebase_search">): Promise<void> {
		const query: string | undefined = block.params.query
		const directoryPrefix: string | undefined = block.params.path

		const sharedMessageProps = {
			tool: "codebaseSearch",
			query: query,
			path: directoryPrefix,
			isOutsideWorkspace: false,
		}

		await ask(task.taskId, "tool", JSON.stringify(sharedMessageProps), block.partial).catch(() => {})
	}
}

export const codebaseSearchTool = new CodebaseSearchTool()

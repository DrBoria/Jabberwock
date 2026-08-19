import * as vscode from "vscode"

import type { ITaskModel } from "@features/chat/task/store"
import { CodeIndexManager } from "@services/code-index/manager/manager"
import { getCodeIndexManager } from "@services/code-index/manager/manager.factory"
import { getWorkspacePath } from "@utils/io/path"
import { formatResponse } from "@features/settings/context/responses"
import { VectorStoreSearchResult } from "@services/code-index/interfaces"
import type { ToolUse } from "@shared/tools"

import { BaseTool, ToolCallbacks } from "@features/chat/tools/a-b/BaseTool"
import { ask } from "@features/chat/task/notifications/actions/ask"
import { systemBroadcast } from "@features/chat/task/messages/actions/say"
import { sayAndCreateMissingParamError } from "@features/chat/task/messages/actions/command/sayAndCreateMissingParamError"
import { getProvider } from "@features/foundation/webview/providerRegistry"

interface CodebaseSearchParams {
	query: string
	path?: string
}

/**
 * Resolves and validates the CodeIndexManager, throwing if unavailable.
 */
function resolveCodeIndexManager(): CodeIndexManager {
	const context = getProvider().context as vscode.ExtensionContext
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

	return manager
}

/**
 * Processes raw search results into the structured JSON format.
 */
function processSearchResults(
	searchResults: VectorStoreSearchResult[],
	query: string,
): {
	query: string
	results: Array<{
		filePath: string
		score: number
		startLine: number
		endLine: number
		codeChunk: string
	}>
} {
	const jsonResult: {
		query: string
		results: Array<{
			filePath: string
			score: number
			startLine: number
			endLine: number
			codeChunk: string
		}>
	} = { query, results: [] }

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

	return jsonResult
}

/**
 * Formats search results into a human-readable output string.
 */
function formatSearchOutput(jsonResult: {
	query: string
	results: Array<{
		filePath: string
		score: number
		startLine: number
		endLine: number
		codeChunk: string
	}>
}): string {
	return `Query: ${jsonResult.query}
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

		const didApprove = await askApproval(
			"tool",
			JSON.stringify({
				tool: "codebaseSearch",
				query,
				path: directoryPrefix,
				isOutsideWorkspace: false,
			}),
		)
		if (!didApprove) {
			pushToolResult(formatResponse.toolDenied())
			return
		}

		task._state.setConsecutiveMistakeCount(0)

		try {
			const manager = resolveCodeIndexManager()
			const searchResults: VectorStoreSearchResult[] = await manager.searchIndex(query, directoryPrefix)

			if (!searchResults || searchResults.length === 0) {
				pushToolResult(`No relevant code snippets found for the query: "${query}"`)
				return
			}

			const jsonResult = processSearchResults(searchResults, query)
			const payload = { tool: "codebaseSearch", content: jsonResult }
			await systemBroadcast(task.taskId, "codebase_search_result", JSON.stringify(payload))

			pushToolResult(formatSearchOutput(jsonResult))
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

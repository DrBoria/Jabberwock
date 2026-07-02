import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import { searchWorkspaceFiles } from "@services/search/file-search"
import { filterPaths, readIgnoreFile } from "@utils/ignore"

/**
 * Handles textarea.files.search.requested intent — searches workspace files.
 */
export function registerOnTextareaFilesSearchRequested(bus: IntentBus): void {
	bus.register(IntentType.TextareaFilesSearchRequested, async (intent, ctx) => {
		const provider = ctx.provider
		const { query, requestId } = intent.payload as { query: string; requestId?: string }

		if (!provider) {
			return
		}

		const currentCline = ctx.rootStore.chat.activeTask
		const workspacePath = currentCline?.cwd

		if (!workspacePath) {
			await provider.postMessageToWebview({
				type: "fileSearchResults",
				results: [],
				requestId,
				error: "No workspace path available",
			})
			return
		}

		try {
			const results = await searchWorkspaceFiles(query || "", workspacePath, 20)

			const currentTask = ctx.rootStore.chat.activeTask
			let ignorePatterns = currentTask?.jabberwockIgnoreController

			if (!ignorePatterns) {
				ignorePatterns = await readIgnoreFile(workspacePath)
			}

			const showJabberwockIgnoredFiles = false

			let filteredResults = results
			if (!showJabberwockIgnoredFiles) {
				const allowedPaths = filterPaths(
					ignorePatterns,
					results.map((r) => r.path),
					workspacePath,
				)
				filteredResults = results.filter((r) => allowedPaths.includes(r.path))
			}

			await provider.postMessageToWebview({
				type: "fileSearchResults",
				results: filteredResults,
				requestId,
			})
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)

			await provider.postMessageToWebview({
				type: "fileSearchResults",
				results: [],
				error: errorMessage,
				requestId,
			})
		}
	})
}

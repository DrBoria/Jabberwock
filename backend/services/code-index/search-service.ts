import * as path from "path"
import { VectorStoreSearchResult } from "./interfaces"
import { IEmbedder } from "./interfaces/embedder"
import { IVectorStore } from "./interfaces/vector-store"
import { CodeIndexConfigManager } from "./config"
import { CodeIndexStateManager } from "./state-manager"
import { getTelemetryService } from "@jabberwock/telemetry"
import { TelemetryEventName } from "@jabberwock/types"

/**
 * Service responsible for searching the code index.
 */
export function CodeIndexSearchService(
	configManager: CodeIndexConfigManager,
	stateManager: CodeIndexStateManager,
	embedder: IEmbedder,
	vectorStore: IVectorStore,
) {
	const handler = {
		configManager,
		stateManager,
		embedder,
		vectorStore,
		async searchIndex(query: string, directoryPrefix?: string): Promise<VectorStoreSearchResult[]> {
			if (!handler.configManager.isFeatureEnabled || !handler.configManager.isFeatureConfigured) {
				throw new Error("Code index feature is disabled or not configured.")
			}
			const minScore = handler.configManager.currentSearchMinScore
			const maxResults = handler.configManager.currentSearchMaxResults
			const currentState = handler.stateManager.getCurrentStatus().systemStatus
			if (currentState !== "Indexed" && currentState !== "Indexing") {
				// Allow search during Indexing too
				throw new Error(`Code index is not ready for search. Current state: ${currentState}`)
			}
			try {
				// Generate embedding for query
				const embeddingResponse = await handler.embedder.createEmbeddings([query])
				const vector = embeddingResponse?.embeddings[0]
				if (!vector) {
					throw new Error("Failed to generate embedding for query.")
				}
				// Handle directory prefix
				let normalizedPrefix: string | undefined
				if (directoryPrefix) {
					normalizedPrefix = path.normalize(directoryPrefix)
				}
				// Perform search
				const results = await handler.vectorStore.search(vector, normalizedPrefix, minScore, maxResults)
				return results
			} catch (error) {
				console.error("[jabberwock] [CodeIndexSearchService] Error during search:", error)
				handler.stateManager.setSystemState("Error", `Search failed: ${(error as Error).message}`)
				// Capture telemetry for the error
				getTelemetryService().captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
					error: (error as Error).message,
					stack: (error as Error).stack,
					location: "searchIndex",
				})
				throw error // Re-throw the error after setting state
			}
		},
	}
	return handler
}
export type CodeIndexSearchService = ReturnType<typeof CodeIndexSearchService>

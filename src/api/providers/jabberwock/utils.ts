import { Package } from "@shared/package"
import type { ApiHandlerCreateMessageMetadata } from "@api/index"
import { getModels } from "@api/providers/fetchers/modelCache"

import type { RooUsage, StreamYield } from "./types"

export function emitUsageYields(lastUsage: RooUsage, model: { id: string; info: { isFree?: boolean } }): StreamYield[] {
	const isFreeModel = model.info.isFree ?? false

	const promptTokens = lastUsage.prompt_tokens || 0
	const cacheWrite = lastUsage.cache_creation_input_tokens || 0
	const cacheRead = lastUsage.prompt_tokens_details?.cached_tokens || 0
	const nonCached = Math.max(0, promptTokens - cacheWrite - cacheRead)

	return [
		{
			type: "usage" as const,
			inputTokens: nonCached,
			outputTokens: lastUsage.completion_tokens || 0,
			cacheWriteTokens: cacheWrite,
			cacheReadTokens: cacheRead,
			totalCost: isFreeModel ? 0 : (lastUsage.cost ?? 0),
		},
	]
}

export function buildHeaders(metadata?: ApiHandlerCreateMessageMetadata): Record<string, string> {
	const headers: Record<string, string> = {
		"X-Jabberwock-App-Version": Package.version,
	}

	if (metadata?.taskId) {
		headers["X-Jabberwock-Task-ID"] = metadata.taskId
	}

	return headers
}

export function logStreamError(error: unknown, modelId: string | undefined, hasTaskId: boolean): void {
	const errorContext = {
		error: error instanceof Error ? error.message : String(error),
		stack: error instanceof Error ? error.stack : undefined,
		modelId,
		hasTaskId,
	}

	console.error(`[jabberwock] [RooHandler] Error during message streaming: ${JSON.stringify(errorContext)}`)
}

export async function loadDynamicModels(baseURL: string, apiKey?: string): Promise<void> {
	try {
		await getModels({
			provider: "jabberwock",
			baseUrl: baseURL,
			apiKey,
		})
	} catch (error) {
		console.error("[jabberwock] [RooHandler] Error loading dynamic models:", {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
			baseURL,
			hasApiKey: Boolean(apiKey),
		})
	}
}

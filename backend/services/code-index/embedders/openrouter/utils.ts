import { TelemetryEventName } from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"

import { HttpError, formatEmbeddingError } from "@services/code-index/shared/validateContent"
import {
	MAX_ITEM_TOKENS,
	INITIAL_RETRY_DELAY_MS as INITIAL_DELAY_MS,
	MAX_BATCH_RETRIES as MAX_RETRIES,
} from "@services/code-index/constants"
import { t } from "@i18n"

import type { GlobalRateLimitState } from "./rate-limit"
import { getGlobalRateLimitDelay, updateGlobalRateLimitState } from "./rate-limit"

export function captureOpenRouterTelemetry(error: unknown, attempts: number): void {
	getTelemetryService().captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
		error: error instanceof Error ? error.message : String(error),
		stack: error instanceof Error ? error.stack : undefined,
		location: "OpenRouterEmbedder:_embedBatchWithRetries",
		attempt: attempts + 1,
	})
}

export async function handleOpenRouterRetryError(
	error: unknown,
	attempts: number,
	rateLimitState: GlobalRateLimitState,
): Promise<void> {
	captureOpenRouterTelemetry(error, attempts)

	const hasMoreAttempts = attempts < MAX_RETRIES - 1
	const httpError = error as HttpError

	if (httpError?.status === 429 && hasMoreAttempts) {
		await updateGlobalRateLimitState(rateLimitState)

		const baseDelay = INITIAL_DELAY_MS * Math.pow(2, attempts)
		const globalDelay = await getGlobalRateLimitDelay(rateLimitState)
		const delayMs = Math.max(baseDelay, globalDelay)

		console.warn(t("embeddings:rateLimitRetry", { delayMs, attempt: attempts + 1, maxRetries: MAX_RETRIES }))
		await new Promise((resolve) => setTimeout(resolve, delayMs))
		return
	}

	console.error(`[jabberwock] OpenRouter embedder error (attempt ${attempts + 1}/${MAX_RETRIES}):`, error)

	throw formatEmbeddingError(error, MAX_RETRIES)
}

export function applyQueryPrefix(texts: string[], queryPrefix: string | undefined): string[] {
	if (!queryPrefix) {
		return texts
	}

	return texts.map((text, index) => {
		if (text.startsWith(queryPrefix)) {
			return text
		}
		const prefixedText = `${queryPrefix}${text}`
		const estimatedTokens = Math.ceil(prefixedText.length / 4)
		if (estimatedTokens > MAX_ITEM_TOKENS) {
			console.warn(
				t("embeddings:textWithPrefixExceedsTokenLimit", {
					index,
					estimatedTokens,
					maxTokens: MAX_ITEM_TOKENS,
				}),
			)
			return text
		}
		return prefixedText
	})
}

import { TelemetryEventName } from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"
import { MAX_ITEM_TOKENS } from "@services/code-index/constants"
import { sanitizeErrorMessage } from "@services/code-index/shared/sanitizeInput"
import { t } from "@i18n"

export function extractErrorName(error: unknown): string | undefined {
	if (typeof error !== "object" || error === null) {
		return undefined
	}
	if (!("name" in error)) {
		return undefined
	}
	const val = error.name
	return typeof val === "string" ? val : undefined
}

export function extractErrorMessage(error: unknown): string | undefined {
	if (typeof error !== "object" || error === null) {
		return undefined
	}
	if (!("message" in error)) {
		return undefined
	}
	const val = error.message
	return typeof val === "string" ? val : undefined
}

export function extractErrorCode(error: unknown): string | undefined {
	if (typeof error !== "object" || error === null) {
		return undefined
	}
	if (!("code" in error)) {
		return undefined
	}
	const val = error.code
	return typeof val === "string" ? val : undefined
}

export function isOllamaConnectionFailed(errMessage: string | undefined, errCode: string | undefined): boolean {
	if (errCode === "ECONNREFUSED") {
		return true
	}
	if (typeof errMessage !== "string") {
		return false
	}
	if (errMessage.includes("fetch failed")) {
		return true
	}
	if (errMessage.includes("ECONNREFUSED")) {
		return true
	}
	return false
}

export function isOllamaHostNotFound(errCode: string | undefined, errMessage: string | undefined): boolean {
	if (errCode === "ENOTFOUND") {
		return true
	}
	if (typeof errMessage !== "string") {
		return false
	}
	if (errMessage.includes("ENOTFOUND")) {
		return true
	}
	return false
}

export function captureOllamaError(error: unknown, baseUrl: string): Error {
	getTelemetryService().captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
		error: sanitizeErrorMessage(error instanceof Error ? error.message : String(error)),
		stack: error instanceof Error ? sanitizeErrorMessage(error.stack || "") : undefined,
		location: "OllamaEmbedder:createEmbeddings",
	})

	console.error("[jabberwock] Ollama embedding failed:", error)

	return mapEmbeddingError(error, baseUrl)
}

export function applyQueryPrefix(text: string, index: number, queryPrefix: string): string {
	if (text.startsWith(queryPrefix)) {
		return text
	}

	const prefixedText = `${queryPrefix}${text}`
	const estimatedTokens = Math.ceil(prefixedText.length / 4)
	if (estimatedTokens > MAX_ITEM_TOKENS) {
		console.warn(
			`[jabberwock] ${t("embeddings:textWithPrefixExceedsTokenLimit", {
				index,
				estimatedTokens,
				maxTokens: MAX_ITEM_TOKENS,
			})}`,
		)
		return text
	}

	return prefixedText
}

export function mapEmbeddingError(error: unknown, baseUrl: string): Error {
	const errName = extractErrorName(error)
	const errMessage = extractErrorMessage(error)
	const errCode = extractErrorCode(error)

	if (errName === "AbortError") {
		return new Error(t("embeddings:validation.connectionFailed"))
	}

	const isFetchFailed = typeof errMessage === "string" && errMessage.includes("fetch failed")
	if (isFetchFailed || errCode === "ECONNREFUSED") {
		return new Error(t("embeddings:ollama.serviceNotRunning", { baseUrl }))
	}

	if (errCode === "ENOTFOUND") {
		return new Error(t("embeddings:ollama.hostNotFound", { baseUrl }))
	}

	const displayMessage = errMessage ?? String(error)
	return new Error(t("embeddings:ollama.embeddingFailed", { message: displayMessage }))
}

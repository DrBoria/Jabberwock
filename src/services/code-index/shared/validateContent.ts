import { t } from "@i18n"
import { serializeError } from "serialize-error"

/**
 * HTTP error interface for embedder errors
 */
export interface HttpError extends Error {
	status?: number
	response?: {
		status?: number
	}
}

/**
 * Common error types that can occur during embedder validation
 */
export interface ValidationError {
	status?: number
	message?: string
	name?: string
	code?: string
}

/**
 * Maps HTTP status codes to appropriate error messages
 */
export function getErrorMessageForStatus(status: number | undefined, embedderType: string): string | undefined {
	switch (status) {
		case 401:
		case 403:
			return t("embeddings:validation.authenticationFailed")
		case 404:
			return embedderType === "openai"
				? t("embeddings:validation.modelNotAvailable")
				: t("embeddings:validation.invalidEndpoint")
		case 429:
			return t("embeddings:validation.serviceUnavailable")
		default:
			if (status && status >= 400 && status < 600) {
				return t("embeddings:validation.configurationError")
			}
			return undefined
	}
}

function tryExtractNumericStatus(obj: Record<string, unknown>, key: string): number | undefined {
	const value = obj[key]
	if (value !== undefined && typeof value === "number") {
		return value
	}
	return undefined
}

function tryExtractResponseStatus(obj: Record<string, unknown>): number | undefined {
	const response = obj.response as Record<string, unknown> | undefined
	if (response?.status !== undefined && typeof response.status === "number") {
		return response.status
	}
	return undefined
}

function tryExtractStatusFromMessage(obj: Record<string, unknown>): number | undefined {
	const message = obj.message
	if (typeof message !== "string") {
		return undefined
	}
	const match = message.match(/HTTP (\d+):/)
	if (!match) {
		return undefined
	}
	return parseInt(match[1], 10)
}

/**
 * Extracts status code from various error formats
 */
export function extractStatusCode(error: unknown): number | undefined {
	const errorRecord = error as Record<string, unknown>

	const directStatus = tryExtractNumericStatus(errorRecord, "status")
	if (directStatus !== undefined) return directStatus

	const responseStatus = tryExtractResponseStatus(errorRecord)
	if (responseStatus !== undefined) return responseStatus

	const messageMatch = tryExtractStatusFromMessage(errorRecord)
	if (messageMatch !== undefined) return messageMatch

	const serialized = serializeError(error) as Record<string, unknown>
	const serializedStatus = tryExtractNumericStatus(serialized, "status")
	if (serializedStatus !== undefined) return serializedStatus

	const serializedResponseStatus = tryExtractResponseStatus(serialized)
	if (serializedResponseStatus !== undefined) return serializedResponseStatus

	return undefined
}

/**
 * Extracts error message from various error formats
 */
export function extractErrorMessage(error: unknown): string {
	const errorRecord = error as Record<string, unknown>
	const message = errorRecord.message
	if (typeof message === "string") {
		return message
	}

	if (typeof error === "string") {
		return error
	}

	if (error && typeof error === "object" && "toString" in error) {
		try {
			return String(error)
		} catch {
			return "Unknown error"
		}
	}

	// Use serialize-error as fallback for complex objects
	const serialized = serializeError(error) as Record<string, unknown>
	const serializedMessage = serialized.message
	if (typeof serializedMessage === "string") {
		return serializedMessage
	}

	return "Unknown error"
}

function checkConnectionError(errorMessage: string): { valid: boolean; error: string } | undefined {
	if (
		errorMessage.includes("ENOTFOUND") ||
		errorMessage.includes("ECONNREFUSED") ||
		errorMessage.includes("ETIMEDOUT") ||
		errorMessage === "AbortError" ||
		errorMessage.includes("HTTP 0:") ||
		errorMessage === "No response"
	) {
		return { valid: false, error: t("embeddings:validation.connectionFailed") }
	}
	return undefined
}

/**
 * Standard validation error handler for embedder configuration validation
 * Returns a consistent error response based on the error type
 */
export function handleValidationError(
	error: unknown,
	embedderType: string,
	customHandlers?: {
		beforeStandardHandling?: (error: unknown) => { valid: boolean; error: string } | undefined
	},
): { valid: boolean; error: string } {
	const serializedError = serializeError(error)

	if (customHandlers?.beforeStandardHandling) {
		const customResult = customHandlers.beforeStandardHandling(error)
		if (customResult) return customResult
	}

	const statusCode = extractStatusCode(serializedError)
	const errorMessage = extractErrorMessage(serializedError)

	const statusError = getErrorMessageForStatus(statusCode, embedderType)
	if (statusError) {
		return { valid: false, error: statusError }
	}

	if (!errorMessage) {
		return { valid: false, error: t("embeddings:validation.configurationError") }
	}

	const connectionError = checkConnectionError(errorMessage)
	if (connectionError) {
		return connectionError
	}

	if (errorMessage.includes("Failed to parse response JSON")) {
		return { valid: false, error: t("embeddings:validation.invalidResponse") }
	}

	if (errorMessage !== "Unknown error") {
		return { valid: false, error: errorMessage }
	}

	return { valid: false, error: t("embeddings:validation.configurationError") }
}

/**
 * Wraps an async validation function with standard error handling
 */
export async function withValidationErrorHandling<T extends { valid: boolean; error?: string }>(
	validationFn: () => Promise<T>,
	embedderType: string,
	customHandlers?: Parameters<typeof handleValidationError>[2],
): Promise<{ valid: boolean; error?: string }> {
	try {
		return await validationFn()
	} catch (error) {
		return handleValidationError(error, embedderType, customHandlers)
	}
}

/**
 * Formats an embedding error message based on the error type and context
 */
export function formatEmbeddingError(error: unknown, maxRetries: number): Error {
	const errorMessage = extractErrorMessage(error)
	const statusCode = extractStatusCode(error)

	if (statusCode === 401) {
		return new Error(t("embeddings:authenticationFailed"))
	} else if (statusCode) {
		return new Error(t("embeddings:failedWithStatus", { attempts: maxRetries, statusCode, errorMessage }))
	} else {
		return new Error(t("embeddings:failedWithError", { attempts: maxRetries, errorMessage }))
	}
}

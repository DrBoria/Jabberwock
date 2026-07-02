/**
 * General error handler for API provider errors
 * Transforms technical errors into user-friendly messages while preserving metadata
 *
 * This utility ensures consistent error handling across all API providers:
 * - Preserves HTTP status codes for UI-aware error display
 * - Maintains error details for retry logic (e.g., RetryInfo for 429 errors)
 * - Provides consistent error message formatting
 * - Enables telemetry and debugging with complete error context
 */

import i18n from "@i18n/setup"

/**
 * Handles API provider errors and transforms them into user-friendly messages
 * while preserving important metadata for retry logic and UI display.
 *
 * @param error - The error to handle
 * @param providerName - The name of the provider for context in error messages
 * @param options - Optional configuration for error handling
 * @returns A wrapped Error with preserved metadata (status, errorDetails, code)
 *
 * @example
 * // Basic usage
 * try {
 *   await apiClient.createMessage(...)
 * } catch (error) {
 *   throw handleProviderError(error, "OpenAI")
 * }
 *
 * @example
 * // With custom message prefix
 * catch (error) {
 *   throw handleProviderError(error, "Anthropic", { messagePrefix: "streaming" })
 * }
 */
/**
 * Extended metadata that may be present on API error objects.
 * Providers attach HTTP status, structured details, error codes, and AWS metadata.
 */
interface ErrorMetadata {
	status?: number
	errorDetails?: unknown
	code?: string | number
	$metadata?: object
	error?: {
		metadata?: {
			raw?: string
		}
	}
}

function getErrorMessage(error: unknown): string {
	const anyErr = error as ErrorMetadata
	return anyErr?.error?.metadata?.raw || (error instanceof Error ? error.message : "") || ""
}

function buildErrorMessage(
	msg: string,
	providerName: string,
	messagePrefix: string,
	options?: { messageTransformer?: (msg: string) => string },
): string {
	if (msg.includes("Cannot convert argument to a ByteString")) {
		return i18n.t("common:errors.api.invalidKeyInvalidChars")
	}
	if (options?.messageTransformer) {
		return options.messageTransformer(msg)
	}
	return `${providerName} ${messagePrefix} error: ${msg}`
}

function copyMetadata(error: Error): void {
	const anyErr = error as ErrorMetadata
	Object.assign(error, {
		...(anyErr.status !== undefined && { status: anyErr.status }),
		...(anyErr.errorDetails !== undefined && { errorDetails: anyErr.errorDetails }),
		...(anyErr.code !== undefined && { code: anyErr.code }),
		...(anyErr.$metadata !== undefined && { $metadata: anyErr.$metadata }),
	})
}

function logApiError(providerName: string, msg: string, error: Error): void {
	const anyErr = error as ErrorMetadata
	console.error(`[jabberwock] [${providerName}] API error:`, {
		message: msg,
		name: error.name,
		stack: error.stack,
		status: anyErr.status,
	})
}

function handleErrorInstance(
	error: Error,
	providerName: string,
	messagePrefix: string,
	options?: { messageTransformer?: (msg: string) => string },
): Error {
	const msg = getErrorMessage(error)

	logApiError(providerName, msg, error)

	const finalMessage = buildErrorMessage(msg, providerName, messagePrefix, options)
	const wrapped = new Error(finalMessage)

	copyMetadata(wrapped)

	return wrapped
}

function handleNonError(error: unknown, providerName: string, messagePrefix: string): Error {
	console.error(`[jabberwock] [${providerName}] Non-Error exception:`, error)
	const wrapped = new Error(`${providerName} ${messagePrefix} error: ${String(error)}`)

	const anyErr = error as ErrorMetadata
	if (typeof anyErr?.status === "number") {
		Object.assign(wrapped, { status: anyErr.status })
	}

	return wrapped
}

export function handleProviderError(
	error: unknown,
	providerName: string,
	options?: {
		/** Custom message prefix (default: "completion") */
		messagePrefix?: string
		/** Custom message transformer */
		messageTransformer?: (msg: string) => string
	},
): Error {
	const messagePrefix = options?.messagePrefix || "completion"

	if (error instanceof Error) {
		return handleErrorInstance(error, providerName, messagePrefix, options)
	}

	return handleNonError(error, providerName, messagePrefix)
}

/**
 * Specialized handler for OpenAI-compatible providers
 * Re-exports with OpenAI-specific defaults for backward compatibility
 */

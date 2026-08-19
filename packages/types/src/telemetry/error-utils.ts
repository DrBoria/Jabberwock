/**
 * Expected API error codes that should not be reported to telemetry.
 * These are normal/expected errors that users can't do much about.
 */
export const EXPECTED_API_ERROR_CODES = new Set([
	402, // Payment required - billing issues
	429, // Rate limit - expected when hitting API limits
])

/**
 * Patterns in error messages that indicate expected errors (rate limits, etc.)
 * These are checked when no numeric error code is available.
 */
const EXPECTED_ERROR_MESSAGE_PATTERNS = [
	/^429\b/, // Message starts with "429"
	/rate limit/i, // Contains "rate limit" (case insensitive)
]

/**
 * Interface representing the error structure from OpenAI SDK.
 * OpenAI SDK errors (APIError, AuthenticationError, RateLimitError, etc.)
 * have a numeric `status` property and may contain nested error metadata.
 *
 * @see https://github.com/openai/openai-node/blob/master/src/error.ts
 */
interface OpenAISdkError {
	/** HTTP status code of the error response */
	status: number
	/** Optional error code (may be numeric or string) */
	code?: number | string
	/** Primary error message */
	message: string
	/** Nested error object containing additional details from the API response */
	error?: {
		message?: string
		metadata?: {
			/** Raw error message from upstream provider (e.g., OpenRouter upstream errors) */
			raw?: string
		}
	}
}

function isNonNullObject(error: unknown): error is Record<string, unknown> {
	return typeof error === "object" && error !== null
}

/**
 * Type guard to check if an error object is an OpenAI SDK error.
 * OpenAI SDK errors (APIError and subclasses) have: status, code, message properties.
 */
function isOpenAISdkError(error: unknown): error is OpenAISdkError {
	if (!isNonNullObject(error)) {
		return false
	}
	if (!("status" in error)) {
		return false
	}
	return typeof (error as unknown as OpenAISdkError).status === "number"
}

/**
 * Extracts the HTTP status code from an error object.
 * Supports OpenAI SDK errors that have a status property.
 * @param error - The error to extract status from
 * @returns The status code if available, undefined otherwise
 */
export function getErrorStatusCode(error: unknown): number | undefined {
	if (isOpenAISdkError(error)) {
		return error.status
	}
	return undefined
}

/**
 * Extracts a message from a JSON payload embedded in an error string.
 * Handles cases like "503 {"error":{"message":"actual error message"}}"
 * or just '{"error":{"message":"actual error message"}}'
 *
 * @param message - The message string that may contain JSON
 * @returns The extracted message from the JSON payload, or undefined if not found
 */
export function extractMessageFromJsonPayload(message: string): string | undefined {
	// Find the first occurrence of '{' which may indicate JSON content
	const jsonStartIndex = message.indexOf("{")
	if (jsonStartIndex === -1) {
		return undefined
	}

	const potentialJson = message.slice(jsonStartIndex)

	try {
		const parsed = JSON.parse(potentialJson)

		// Handle structure: {"error":{"message":"..."}} or {"error":{"code":"","message":"..."}}
		if (parsed?.error?.message && typeof parsed.error.message === "string") {
			return parsed.error.message
		}

		// Handle structure: {"message":"..."}
		if (parsed?.message && typeof parsed.message === "string") {
			return parsed.message
		}
	} catch {
		// JSON parsing failed - not valid JSON
	}

	return undefined
}

function getSdkErrorMessage(error: OpenAISdkError): string {
	return error.error?.metadata?.raw ?? error.error?.message ?? error.message
}

function getObjectErrorMessage(error: unknown): string | undefined {
	if (!isNonNullObject(error)) {
		return undefined
	}
	if (!("message" in error)) {
		return undefined
	}
	const msgValue = (error as { message: unknown }).message
	if (typeof msgValue !== "string") {
		return undefined
	}
	return msgValue
}

/**
 * Extracts the most descriptive error message from an error object.
 * Prioritizes nested metadata (upstream provider errors) over the standard message.
 * Also handles JSON payloads embedded in error messages.
 * @param error - The error to extract message from
 * @returns The best available error message, or undefined if not extractable
 */
export function getErrorMessage(error: unknown): string | undefined {
	let message: string | undefined

	if (isOpenAISdkError(error)) {
		message = getSdkErrorMessage(error)
	} else if (error instanceof Error) {
		message = error.message
	} else {
		message = getObjectErrorMessage(error)
	}

	if (!message) {
		return undefined
	}

	const extractedMessage = extractMessageFromJsonPayload(message)
	if (extractedMessage) {
		return extractedMessage
	}

	return message
}

/**
 * Helper to check if an API error should be reported to telemetry.
 * Filters out expected errors like rate limits by checking both error codes and messages.
 * @param errorCode - The HTTP error code (if available)
 * @param errorMessage - The error message (if available)
 * @returns true if the error should be reported, false if it should be filtered out
 */
export function shouldReportApiErrorToTelemetry(errorCode?: number, errorMessage?: string): boolean {
	// Check numeric error code
	if (errorCode !== undefined && EXPECTED_API_ERROR_CODES.has(errorCode)) {
		return false
	}

	// Check error message for expected patterns (e.g., "429 Rate limit exceeded")
	if (errorMessage) {
		for (const pattern of EXPECTED_ERROR_MESSAGE_PATTERNS) {
			if (pattern.test(errorMessage)) {
				return false
			}
		}
	}

	return true
}

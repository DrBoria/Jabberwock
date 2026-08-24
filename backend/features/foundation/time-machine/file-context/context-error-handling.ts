import { APIError } from "openai"

/**
 * Shape of unknown error objects from various providers for context-window checks.
 * All fields are optional since we're accessing potentially missing properties.
 */
interface ErrorResponseShape {
	status?: unknown
	code?: unknown
	error?: {
		status?: unknown
		message?: unknown
		error?: {
			type?: string
			message?: string
			code?: string
		}
	}
	response?: {
		status?: unknown
	}
	message?: unknown
	name?: string
}

export function checkContextWindowExceededError(error: unknown): boolean {
	return (
		checkIsOpenAIContextWindowError(error) ||
		checkIsOpenRouterContextWindowError(error) ||
		checkIsAnthropicContextWindowError(error)
	)
}

function checkIsOpenRouterContextWindowError(error: unknown): boolean {
	try {
		if (!error || typeof error !== "object") {
			return false
		}

		const err = error as ErrorResponseShape
		const status = resolveErrorStatus(err)
		const message = resolveErrorMessage(err)

		const CONTEXT_ERROR_PATTERNS = [
			/\bcontext\s*(?:length|window)\b/i,
			/\bmaximum\s*context\b/i,
			/\b(?:input\s*)?tokens?\s*exceed/i,
			/\btoo\s*many\s*tokens?\b/i,
		] as const

		return String(status) === "400" && CONTEXT_ERROR_PATTERNS.some((pattern) => pattern.test(message))
	} catch {
		return false
	}
}

function resolveErrorStatus(err: ErrorResponseShape): number | undefined {
	return (err.status ?? err.code ?? err.error?.status ?? err.response?.status) as number | undefined
}

function resolveErrorMessage(err: ErrorResponseShape): string {
	return String(err.message || err.error?.message || "")
}

// Docs: https://platform.openai.com/docs/guides/error-codes/api-errors
function checkIsOpenAIContextWindowError(error: unknown): boolean {
	try {
		// Check for LengthFinishReasonError
		if (error && typeof error === "object" && "name" in error && error.name === "LengthFinishReasonError") {
			return true
		}

		const KNOWN_CONTEXT_ERROR_SUBSTRINGS = ["token", "context length"] as const

		return (
			Boolean(error) &&
			error instanceof APIError &&
			error.code?.toString() === "400" &&
			KNOWN_CONTEXT_ERROR_SUBSTRINGS.some((substring) => error.message.includes(substring))
		)
	} catch {
		return false
	}
}

function checkIsAnthropicContextWindowError(response: unknown): boolean {
	try {
		if (!response || typeof response !== "object") {
			return false
		}

		const res = response as ErrorResponseShape

		if (res.error?.error?.type !== "invalid_request_error") {
			return false
		}

		return isAnthropicContextWindowMessage(res)
	} catch {
		return false
	}
}

function isAnthropicContextWindowMessage(res: ErrorResponseShape): boolean {
	const message: string = String(res.error?.error?.message || "")

	const contextWindowPatterns = [
		/prompt is too long/i,
		/maximum.*tokens/i,
		/context.*too.*long/i,
		/exceeds.*context/i,
		/token.*limit/i,
		/context_length_exceeded/i,
		/max_tokens_to_sample/i,
	]

	return contextWindowPatterns.some((pattern) => pattern.test(message))
}

const CANCELLATION_ERROR_PATTERNS = ["aborted", "aborterror", "cancelled", "canceled"]
const CANCELLATION_ERROR_NAMES = new Set(["aborterror"])
const CANCELLATION_ERROR_CODES = new Set(["ABORT_ERR", "ERR_CANCELED", "ERR_CANCELLED"])
const NO_ACTIVE_TASK_PATTERNS = [
	"no active task",
	"no task to cancel",
	"task not found",
	"unable to find task",
	"already completed",
	"already cancelled",
	"already canceled",
]
const STREAM_TEARDOWN_CODES = new Set(["EPIPE", "ECONNRESET", "ERR_STREAM_DESTROYED", "ERR_STREAM_PREMATURE_CLOSE"])
const STREAM_TEARDOWN_PATTERNS = [
	"write after end",
	"stream destroyed",
	"premature close",
	"socket hang up",
	"broken pipe",
]

export interface ExpectedControlFlowErrorContext {
	stdinStreamMode: boolean
	cancelRequested?: boolean
	shuttingDown?: boolean
	operation?: "runtime" | "client" | "cancel" | "shutdown"
}

interface ErrorMetadata {
	message: string
	normalizedMessage: string
	name?: string
	normalizedName?: string
	code?: string
}

function getErrorMetadata(error: unknown): ErrorMetadata {
	if (error instanceof Error) {
		const maybeCode = (error as Error & { code?: unknown }).code
		const code = typeof maybeCode === "string" ? maybeCode : undefined
		return {
			message: error.message,
			normalizedMessage: error.message.toLowerCase(),
			name: error.name,
			normalizedName: error.name.toLowerCase(),
			code,
		}
	}

	if (typeof error === "object" && error !== null) {
		const nameRaw = (error as { name?: unknown }).name
		const messageRaw = (error as { message?: unknown }).message
		const codeRaw = (error as { code?: unknown }).code
		const message = typeof messageRaw === "string" ? messageRaw : String(error)
		return {
			message,
			normalizedMessage: message.toLowerCase(),
			name: typeof nameRaw === "string" ? nameRaw : undefined,
			normalizedName: typeof nameRaw === "string" ? nameRaw.toLowerCase() : undefined,
			code: typeof codeRaw === "string" ? codeRaw : undefined,
		}
	}

	const message = String(error)
	return {
		message,
		normalizedMessage: message.toLowerCase(),
	}
}

/**
 * Best-effort classifier for cancellation/abort failures.
 */
export function isCancellationLikeError(error: unknown): boolean {
	const details = getErrorMetadata(error)

	if (details.code && CANCELLATION_ERROR_CODES.has(details.code)) {
		return true
	}

	if (details.normalizedName && CANCELLATION_ERROR_NAMES.has(details.normalizedName)) {
		return true
	}

	return CANCELLATION_ERROR_PATTERNS.some((pattern) => details.normalizedMessage.includes(pattern))
}

export function isNoActiveTaskLikeError(error: unknown): boolean {
	const details = getErrorMetadata(error)
	return NO_ACTIVE_TASK_PATTERNS.some((pattern) => details.normalizedMessage.includes(pattern))
}

export function isStreamTeardownLikeError(error: unknown): boolean {
	const details = getErrorMetadata(error)
	if (details.code && STREAM_TEARDOWN_CODES.has(details.code)) {
		return true
	}

	return STREAM_TEARDOWN_PATTERNS.some((pattern) => details.normalizedMessage.includes(pattern))
}

function isTeardownWithShutdown(error: unknown, context: ExpectedControlFlowErrorContext): boolean {
	return (context.shuttingDown ?? false) && isStreamTeardownLikeError(error)
}

function isCancellationOrNoActiveWithShutdown(error: unknown, context: ExpectedControlFlowErrorContext): boolean {
	return (
		((context.shuttingDown ?? false) || (context.cancelRequested ?? false)) &&
		(isCancellationLikeError(error) || isNoActiveTaskLikeError(error))
	)
}

function isRuntimeCancellation(error: unknown, context: ExpectedControlFlowErrorContext): boolean {
	return context.operation === "runtime" && isCancellationLikeError(error)
}

function isCancelShutdownNoActive(error: unknown, context: ExpectedControlFlowErrorContext): boolean {
	return (context.operation === "cancel" || context.operation === "shutdown") && isNoActiveTaskLikeError(error)
}

/**
 * Classify errors that should be treated as expected control flow rather than
 * fatal failures while handling stdin stream tasks.
 */
export function isExpectedControlFlowError(error: unknown, context: ExpectedControlFlowErrorContext): boolean {
	if (!context.stdinStreamMode) {
		return false
	}

	if (isTeardownWithShutdown(error, context)) {
		return true
	}

	if (isCancellationOrNoActiveWithShutdown(error, context)) {
		return true
	}

	if (isRuntimeCancellation(error, context)) {
		return true
	}

	if (isCancelShutdownNoActive(error, context)) {
		return true
	}

	return false
}

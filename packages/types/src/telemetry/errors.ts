/**
 * Generic API provider error class for structured error tracking via PostHog.
 * Can be reused by any API provider.
 */
export class ApiProviderError extends Error {
	constructor(
		message: string,
		public readonly provider: string,
		public readonly modelId: string,
		public readonly operation: string,
		public readonly errorCode?: number,
	) {
		super(message)
		this.name = "ApiProviderError"
	}
}

/**
 * Type guard to check if an error is an ApiProviderError.
 * Used by telemetry to automatically extract structured properties.
 */
export function isApiProviderError(error: unknown): error is ApiProviderError {
	return (
		error instanceof Error &&
		error.name === "ApiProviderError" &&
		"provider" in error &&
		"modelId" in error &&
		"operation" in error
	)
}

/**
 * Extracts properties from an ApiProviderError for telemetry.
 * Returns the structured properties that can be merged with additionalProperties.
 */
export function extractApiProviderErrorProperties(error: ApiProviderError): Record<string, unknown> {
	return {
		provider: error.provider,
		modelId: error.modelId,
		operation: error.operation,
		...(error.errorCode !== undefined && { errorCode: error.errorCode }),
	}
}

/**
 * Reason why the consecutive mistake limit was reached.
 */
export type ConsecutiveMistakeReason =
	| "no_tools_used"
	| "tool_repetition"
	| "unknown"
	| "consecutive_mistake_tools_used"

/**
 * Error class for "Jabberwock is having trouble" consecutive mistake scenarios.
 * Triggered when the task reaches the configured consecutive mistake limit.
 * Used for structured exception tracking via PostHog.
 */
export class ConsecutiveMistakeError extends Error {
	constructor(
		message: string,
		public readonly taskId: string,
		public readonly consecutiveMistakeCount: number,
		public readonly consecutiveMistakeLimit: number,
		public readonly reason: ConsecutiveMistakeReason = "unknown",
		public readonly provider?: string,
		public readonly modelId?: string,
	) {
		super(message)
		this.name = "ConsecutiveMistakeError"
	}
}

/**
 * Type guard to check if an error is a ConsecutiveMistakeError.
 * Used by telemetry to automatically extract structured properties.
 */
export function isConsecutiveMistakeError(error: unknown): error is ConsecutiveMistakeError {
	return (
		error instanceof Error &&
		error.name === "ConsecutiveMistakeError" &&
		"taskId" in error &&
		"consecutiveMistakeCount" in error &&
		"consecutiveMistakeLimit" in error
	)
}

/**
 * Extracts properties from a ConsecutiveMistakeError for telemetry.
 * Returns the structured properties that can be merged with additionalProperties.
 */
export function extractConsecutiveMistakeErrorProperties(error: ConsecutiveMistakeError): Record<string, unknown> {
	return {
		taskId: error.taskId,
		consecutiveMistakeCount: error.consecutiveMistakeCount,
		consecutiveMistakeLimit: error.consecutiveMistakeLimit,
		reason: error.reason,
		...(error.provider !== undefined && { provider: error.provider }),
		...(error.modelId !== undefined && { modelId: error.modelId }),
	}
}

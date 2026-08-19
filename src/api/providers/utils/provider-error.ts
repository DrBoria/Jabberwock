/**
 * Provider error handler factory.
 *
 * Consolidates the telemetry + ApiProviderError pattern used across
 * Anthropic, Gemini, and other providers that need structured error
 * capture alongside user-friendly error messages.
 *
 * @example
 * ```ts
 * const handleError = createErrorHandler("Anthropic")
 * // ...
 * catch (error) {
 *   handleError(error, modelId, "createMessage")
 * }
 * ```
 */

import { ApiProviderError } from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"

/**
 * Creates a provider-specific error handler that captures exceptions
 * via telemetry and re-throws the original error.
 *
 * @param providerName - Display name of the provider (e.g. "Anthropic", "Gemini")
 * @returns A function that takes (error, model, method) and never returns
 */
export function createErrorHandler(providerName: string) {
	return (error: unknown, model: string, method: "createMessage" | "completePrompt"): never => {
		const message = error instanceof Error ? error.message : String(error)

		getTelemetryService().captureException(new ApiProviderError(message, providerName, model, method))

		throw error
	}
}

/**
 * Creates a provider-specific error handler that captures exceptions
 * via telemetry and throws a new Error with a custom message template.
 *
 * @param providerName - Display name of the provider
 * @param messageTemplate - i18n key template for the error message
 * @returns A function that takes (error, model, method) and never returns
 */
export function createI18nErrorHandler(providerName: string, messageTemplate: (errorMessage: string) => string) {
	return (error: unknown, model: string, method: "createMessage" | "completePrompt"): never => {
		const message = error instanceof Error ? error.message : String(error)

		getTelemetryService().captureException(new ApiProviderError(message, providerName, model, method))

		throw new Error(messageTemplate(message))
	}
}

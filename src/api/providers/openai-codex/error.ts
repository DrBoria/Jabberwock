import { ApiProviderError } from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"

import type { OpenAiCodexModel } from "./types"

export function buildStatusCodeErrorText(status: number): string {
	const statusTextMap: Record<number, string> = {
		400: "Invalid request. Please check your input and try again.",
		401: "Authentication failed. Please check your API key.",
		403: "Access denied. You don't have permission to access this resource.",
		404: "Endpoint not found. Please check the API URL.",
		429: "Rate limit exceeded. Please wait and try again.",
		500: "Codex API service error. Please try again later.",
		502: "Codex API service error. Please try again later.",
		503: "Codex API service error. Please try again later.",
	}
	return statusTextMap[status] ?? `Codex API error (status ${status})`
}

export function parseErrorResponse(errorText: string): string {
	try {
		const errorJson = JSON.parse(errorText)
		if (errorJson.error?.message) return errorJson.error.message
		if (errorJson.message) return errorJson.message
		if (errorJson.detail) return errorJson.detail
		return errorText
	} catch {
		return errorText
	}
}

export function createProviderError(
	error: unknown,
	model: OpenAiCodexModel,
	providerName: string,
	operation: string,
): Error {
	const errorMessage = error instanceof Error ? error.message : String(error)
	const apiError = new ApiProviderError(errorMessage, providerName, model.id, operation)
	getTelemetryService().captureException(apiError)

	if (!(error instanceof Error)) {
		return new Error("Unexpected connection error with Codex API")
	}
	if (error.message.includes("Codex API")) {
		return error
	}
	return new Error(`Failed to connect to Codex API: ${error.message}`)
}

export function createStreamError(error: unknown, model: OpenAiCodexModel, providerName: string): Error {
	const errorMessage = error instanceof Error ? error.message : String(error)
	const apiError = new ApiProviderError(errorMessage, providerName, model.id, "createMessage")
	getTelemetryService().captureException(apiError)
	if (error instanceof Error) {
		return new Error(`Error processing Codex API stream: ${error.message}`)
	}
	return new Error("Unexpected stream error from Codex API")
}

import { ApiProviderError } from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"
import { t } from "i18next"

export function handleGeminiError(
	error: unknown,
	providerName: string,
	model: string,
	method: "createMessage" | "completePrompt",
): never {
	const errorMessage = error instanceof Error ? error.message : String(error)
	const apiError = new ApiProviderError(errorMessage, providerName, model, method)
	getTelemetryService().captureException(apiError)

	if (error instanceof Error) {
		const key =
			method === "createMessage"
				? "common:errors.gemini.generate_stream"
				: "common:errors.gemini.generate_complete_prompt"
		throw new Error(t(key, { error: error.message }))
	}

	throw error
}

import type { ApiStreamChunk } from "@api/transform/stream"
import { ApiProviderError } from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"
import type { ModelInfo, BedrockModelId } from "@jabberwock/types"
import { logger } from "@utils/logging"
import type { BedrockErrorMetadata } from "@api/providers/bedrock/core/types"
import { getErrorType, ERROR_TYPES, type ErrorHandlerContext } from "./error-types"

function buildErrorTemplateVars(error: unknown, ctx: ErrorHandlerContext): Record<string, string> {
	const templateVars: Record<string, string> = {}

	if (error instanceof Error) {
		templateVars.errorMessage = error.message
		templateVars.errorName = error.name

		const modelConfig = ctx.getModel()
		templateVars.modelId = modelConfig.id
		templateVars.contextWindow = String(modelConfig.info.contextWindow || "unknown")
	}

	templateVars.regionInfo = `(${ctx.clientRegion()})`

	return templateVars
}

function formatErrorMessage(error: unknown, errorType: string, ctx: ErrorHandlerContext): string {
	const definition = ERROR_TYPES[errorType] || ERROR_TYPES.GENERIC
	let template = definition.messageTemplate

	const templateVars = buildErrorTemplateVars(error, ctx)

	for (const [key, value] of Object.entries(templateVars)) {
		template = template.replace(new RegExp(`{${key}}`, "g"), value || "")
	}

	return template
}

function throwEnhancedError(error: unknown, enhancedErrorMessage: string): never {
	if (error instanceof Error) {
		const enhancedError = new Error(enhancedErrorMessage)
		enhancedError.name = error.name
		const errorRecord = error as BedrockErrorMetadata
		if ("status" in error && typeof errorRecord.status === "number") {
			Object.assign(enhancedError, { status: errorRecord.status })
		}
		if ("$metadata" in error && typeof errorRecord.$metadata === "object" && errorRecord.$metadata !== null) {
			Object.assign(enhancedError, { $metadata: errorRecord.$metadata })
		}
		throw enhancedError
	}

	throw new Error("An unknown error occurred")
}

export function handleBedrockError(
	error: unknown,
	isStreamContext: boolean,
	ctx: ErrorHandlerContext,
): string | Array<{ type: string; text?: string; inputTokens?: number; outputTokens?: number }> {
	const errorType = getErrorType(error)

	const errorMessage = formatErrorMessage(error, errorType, ctx)

	const definition = ERROR_TYPES[errorType]
	const logMethod = definition.logLevel
	const contextName = isStreamContext ? "createMessage" : "completePrompt"
	logger[logMethod](`${errorType} error in ${contextName}`, {
		ctx: "bedrock",
		customArn: ctx.options.awsCustomArn,
		errorType,
		errorMessage: error instanceof Error ? error.message : String(error),
		...(error instanceof Error && error.stack ? { errorStack: error.stack } : {}),
		...(ctx.clientRegion() ? { clientRegion: ctx.clientRegion() } : {}),
	})

	if (isStreamContext) {
		return [
			{ type: "text", text: `Error: ${errorMessage}` },
			{ type: "usage", inputTokens: 0, outputTokens: 0 },
		]
	}

	return `Bedrock completion error: ${errorMessage}`
}

export function* handleCreateMessageError(
	error: unknown,
	modelConfig: { id: BedrockModelId | string; info: ModelInfo },
	ctx: ErrorHandlerContext,
): Generator<ApiStreamChunk> {
	const errorMessage = error instanceof Error ? error.message : String(error)
	const apiError = new ApiProviderError(errorMessage, ctx.providerName, modelConfig.id, "createMessage")
	getTelemetryService().captureException(apiError)

	const errorType = getErrorType(error)

	if (errorType === "THROTTLING") {
		if (error instanceof Error) {
			throw error
		}
		throw new Error("Throttling error occurred")
	}

	const errorChunks = handleBedrockError(error, true, ctx)
	for (const chunk of errorChunks) {
		yield chunk as ApiStreamChunk
	}

	const enhancedErrorMessage = formatErrorMessage(error, errorType, ctx)
	throwEnhancedError(error, enhancedErrorMessage)
}

export function buildCompletePromptError(error: unknown, ctx: ErrorHandlerContext): Error {
	const model = ctx.getModel()
	const telemetryErrorMessage = error instanceof Error ? error.message : String(error)
	const apiError = new ApiProviderError(telemetryErrorMessage, ctx.providerName, model.id, "completePrompt")
	getTelemetryService().captureException(apiError)

	const errorResult = handleBedrockError(error, false, ctx)
	const errorMessage = errorResult as string

	const enhancedError = new Error(errorMessage)
	if (error instanceof Error) {
		enhancedError.name = error.name
		const errorRecord = error as BedrockErrorMetadata
		if ("status" in error && typeof errorRecord.status === "number") {
			Object.assign(enhancedError, { status: errorRecord.status })
		}
		if ("$metadata" in error && typeof errorRecord.$metadata === "object" && errorRecord.$metadata !== null) {
			Object.assign(enhancedError, { $metadata: errorRecord.$metadata })
		}
	}
	return enhancedError
}

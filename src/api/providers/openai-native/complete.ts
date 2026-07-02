import OpenAI from "openai"
import type { ApiHandlerOptions } from "@shared/api"
import { getTelemetryService } from "@jabberwock/telemetry"
import { type ServiceTier, type VerbosityLevel, ApiProviderError } from "@jabberwock/types"
import type { OpenAiNativeModel, ResponsesClient } from "./types"

export function buildCompletePromptBody(
	model: OpenAiNativeModel,
	prompt: string,
	reasoningEffort: string | undefined,
	verbosity: string | undefined,
	options: {
		openAiNativeServiceTier?: string
		modelTemperature?: number
		enableResponsesReasoningSummary?: boolean
	},
	getPromptCacheRetention: () => "24h" | undefined,
): Record<string, unknown> {
	const requestBody: Record<string, unknown> = {
		model: model.id,
		input: [
			{
				role: "user",
				content: [{ type: "input_text", text: prompt }],
			},
		],
		stream: false,
		store: false,
		...(reasoningEffort ? { include: ["reasoning.encrypted_content"] } : {}),
	}

	addServiceTier(requestBody, options.openAiNativeServiceTier, model)
	addReasoning(requestBody, reasoningEffort, options.enableResponsesReasoningSummary)
	addTemperature(requestBody, model, options.modelTemperature)
	addMaxTokens(requestBody, model)
	addVerbosity(requestBody, model, verbosity)
	addCacheRetention(requestBody, getPromptCacheRetention())

	return requestBody
}

function addServiceTier(
	body: Record<string, unknown>,
	serviceTier: string | undefined,
	model: OpenAiNativeModel,
): void {
	if (!serviceTier) return
	const allowedTierNames = new Set(
		model.info.tiers?.map((t) => t.name).filter((n): n is ServiceTier => n !== undefined) || [],
	)
	if (serviceTier === "default" || allowedTierNames.has(serviceTier as ServiceTier)) {
		body.service_tier = serviceTier
	}
}

function addReasoning(
	body: Record<string, unknown>,
	reasoningEffort: string | undefined,
	enableSummary?: boolean,
): void {
	if (!reasoningEffort) return
	body.reasoning = {
		effort: reasoningEffort,
		...(enableSummary ? { summary: "auto" as const } : {}),
	}
}

function addTemperature(body: Record<string, unknown>, model: OpenAiNativeModel, modelTemperature?: number): void {
	if (model.info.supportsTemperature === false) return
	body.temperature = modelTemperature ?? 0.7
}

function addMaxTokens(body: Record<string, unknown>, model: OpenAiNativeModel): void {
	if (!model.maxTokens) return
	body.max_output_tokens = model.maxTokens
}

function addVerbosity(body: Record<string, unknown>, model: OpenAiNativeModel, verbosity: string | undefined): void {
	if (model.info.supportsVerbosity !== true) return
	body.text = { verbosity: (verbosity || "medium") as VerbosityLevel }
}

function addCacheRetention(body: Record<string, unknown>, retention: "24h" | undefined): void {
	if (!retention) return
	body.prompt_cache_retention = retention
}

export function extractResponseText(response: Record<string, unknown>): string {
	const outputText = findOutputText(response)
	if (outputText !== undefined) return outputText

	if (response?.text) {
		return response.text as string
	}

	return ""
}

export function throwCompletePromptError(
	error: unknown,
	modelId: string,
	providerName: string,
	captureException: (err: unknown) => void,
	ApiProviderErrorClass: new (message: string, provider: string, model: string, operation: string) => Error,
): never {
	const errorMessage = error instanceof Error ? error.message : String(error)
	const apiError = new ApiProviderErrorClass(errorMessage, providerName, modelId, "completePrompt")
	captureException(apiError)

	if (error instanceof Error) {
		throw new Error(`OpenAI Native completion error: ${error.message}`)
	}
	throw error
}

export async function executeCompletePrompt(
	client: OpenAI,
	options: ApiHandlerOptions,
	providerName: string,
	prompt: string,
	modelAccessor: {
		getModel: () => OpenAiNativeModel & { verbosity?: string }
		getReasoningEffort: (model: OpenAiNativeModel) => string | undefined
		getPromptCacheRetention: (model: OpenAiNativeModel) => "24h" | undefined
	},
): Promise<string> {
	const abortController = new AbortController()

	try {
		const model = modelAccessor.getModel()
		const reasoningEffort = modelAccessor.getReasoningEffort(model)
		const verbosity = model.verbosity
		const requestBody = buildCompletePromptBody(
			model,
			prompt,
			reasoningEffort,
			verbosity,
			{
				openAiNativeServiceTier: options.openAiNativeServiceTier as string | undefined,
				modelTemperature: options.modelTemperature ?? undefined,
				enableResponsesReasoningSummary: options.enableResponsesReasoningSummary,
			},
			() => modelAccessor.getPromptCacheRetention(model),
		)

		const responsesClient = getResponsesClient(client)
		const response = (await responsesClient.responses.create(requestBody, {
			signal: abortController.signal,
		})) as Record<string, unknown>

		return extractResponseText(response)
	} catch (error) {
		throwCompletePromptError(
			error,
			modelAccessor.getModel().id,
			providerName,
			(err: unknown) => getTelemetryService().captureException(err as Error),
			ApiProviderError,
		)
		throw error // unreachable but satisfies TS
	}
}

function findOutputText(response: Record<string, unknown>): string | undefined {
	if (!Array.isArray(response?.output)) return undefined

	for (const outputItem of response.output as Record<string, unknown>[]) {
		const text = findOutputItemText(outputItem)
		if (text !== undefined) return text
	}

	return undefined
}

function findOutputItemText(outputItem: Record<string, unknown>): string | undefined {
	if ((outputItem.type as string) !== "message" || !outputItem.content) return undefined

	for (const content of outputItem.content as Record<string, unknown>[]) {
		if ((content.type as string) === "output_text" && content.text) {
			return content.text as string
		}
	}

	return undefined
}

function isResponsesClient(client: object): client is OpenAI & ResponsesClient {
	return (
		"responses" in client &&
		typeof (client as Record<string, unknown>).responses === "object" &&
		(client as Record<string, unknown>).responses !== null
	)
}

function getResponsesClient(client: OpenAI): ResponsesClient {
	if (isResponsesClient(client)) {
		return client
	}
	throw new Error("OpenAI client does not support Responses API")
}

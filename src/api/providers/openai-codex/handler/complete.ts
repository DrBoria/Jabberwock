import { v7 as uuidv7 } from "uuid"

import { ApiProviderError } from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"

import type { OpenAiCodexModel } from "@api/providers/openai-codex/types"
import { CODEX_API_BASE_URL } from "@api/providers/openai-codex/types"
import { buildCodexHeaders, throwAuthError } from "@api/providers/openai-codex/utils"

export function extractTextFromOutputItem(outputItem: Record<string, unknown>): string | undefined {
	if (outputItem.type !== "message" || !outputItem.content) return undefined
	const contentArray = outputItem.content as Record<string, unknown>[]
	for (const content of contentArray) {
		if (content.type === "output_text" && content.text) {
			return content.text as string
		}
	}
	return undefined
}

function extractCompletePromptResult(responseData: Record<string, unknown>): string {
	if (Array.isArray(responseData.output)) {
		for (const outputItem of responseData.output) {
			const text = extractTextFromOutputItem(outputItem)
			if (text) return text
		}
	}

	if (responseData?.text) {
		return responseData.text as string
	}

	return ""
}

export async function sendCompletePromptRequest(
	url: string,
	headers: Record<string, string>,
	requestBody: Record<string, unknown>,
	abortSignal?: AbortSignal,
): Promise<string> {
	const response = await fetch(url, {
		method: "POST",
		headers,
		body: JSON.stringify(requestBody),
		signal: abortSignal,
	})

	if (!response.ok) {
		const errorText = await response.text()
		throw new Error(`Codex API error (status ${response.status})` + (errorText ? `: ${errorText}` : ""))
	}

	const responseData = await response.json()

	return extractCompletePromptResult(responseData)
}

export function buildCompletePromptBody(
	model: OpenAiCodexModel,
	prompt: string,
	reasoningEffort: string | undefined,
): Record<string, unknown> {
	const body: Record<string, unknown> = {
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

	if (reasoningEffort) {
		body.reasoning = {
			effort: reasoningEffort,
			summary: "auto" as const,
		}
	}

	return body
}

export async function executeCompletePrompt(
	prompt: string,
	getModel: () => OpenAiCodexModel,
	getReasoningEffort: (model: OpenAiCodexModel) => string | undefined,
	getAccessToken: () => Promise<string | undefined>,
	getAccountId: () => Promise<string | undefined>,
	sessionId: string,
	abortSignal?: AbortSignal,
): Promise<string> {
	const model = getModel()

	const accessToken = await getAccessToken()
	if (!accessToken) {
		throwAuthError()
	}

	const reasoningEffort = getReasoningEffort(model)

	const requestBody = buildCompletePromptBody(model, prompt, reasoningEffort)

	const url = `${CODEX_API_BASE_URL}/responses`
	const accountId = await getAccountId()

	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		Authorization: `Bearer ${accessToken}`,
		...buildCodexHeaders(undefined, sessionId, accountId ?? undefined),
	}

	return sendCompletePromptRequest(url, headers, requestBody, abortSignal)
}

export function handleCompletePromptError(
	error: unknown,
	providerName: string,
	getModel: () => OpenAiCodexModel,
): never {
	const errorModel = getModel()
	const errorMessage = error instanceof Error ? error.message : String(error)
	const apiError = new ApiProviderError(errorMessage, providerName, errorModel.id, "completePrompt")
	getTelemetryService().captureException(apiError)

	if (error instanceof Error) {
		throw new Error(`Codex completion error: ${error.message}`)
	}
	throw error
}

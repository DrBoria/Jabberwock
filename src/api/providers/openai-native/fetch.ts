import * as os from "os"

import { ApiProviderError } from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"

import { Package } from "@shared/package"

import type { OpenAiNativeModel, ResponsesRequestBody, ResponsesClient } from "./types"
import type { OpenAiNativeStreamContext } from "./stream/index"
import { handleStreamResponse, processEvent } from "./stream/index"
import { type ApiStream, type ApiStreamUsageChunk } from "@api/transform/stream"
import type { RawUsage } from "./types"

export function buildStatusErrorMessage(status: number, details: string): string {
	let message: string
	switch (status) {
		case 400:
			message = "Invalid request to Responses API. Please check your input parameters."
			break
		case 401:
			message = "Authentication failed. Please check your OpenAI API key."
			break
		case 403:
			message = "Access denied. Your API key may not have access to this endpoint."
			break
		case 404:
			message =
				"Responses API endpoint not found. The endpoint may not be available yet or requires a different configuration."
			break
		case 429:
			message = "Rate limit exceeded. Please try again later."
			break
		case 500:
		case 502:
		case 503:
			message = "OpenAI service error. Please try again later."
			break
		default:
			message = `Responses API error (${status})`
	}

	if (details) {
		message += ` - ${details}`
	}

	return message
}

export function parseResponseErrorText(errorText: string): string {
	try {
		const errorJson = JSON.parse(errorText)
		if (errorJson.error?.message) {
			return errorJson.error.message
		}
		if (errorJson.message) {
			return errorJson.message
		}
		return errorText
	} catch {
		return errorText
	}
}

export async function buildResponsesApiError(response: Response): Promise<Error> {
	const errorText = await response.text()
	const errorDetails = parseResponseErrorText(errorText)
	const errorMessage = buildStatusErrorMessage(response.status, errorDetails)
	return new Error(errorMessage)
}

export function throwProviderError(error: unknown, providerName: string, modelId: string, operation: string): never {
	const errorMessage = error instanceof Error ? error.message : String(error)
	const apiError = new ApiProviderError(errorMessage, providerName, modelId, operation)
	getTelemetryService().captureException(apiError)

	if (error instanceof Error) {
		if (error.message.includes("Responses API")) {
			throw error
		}
		throw new Error(`Failed to connect to Responses API: ${error.message}`)
	}

	throw new Error(`Unexpected error connecting to Responses API`)
}

export function throwStreamError(error: unknown, providerName: string, modelId: string): never {
	const errorMessage = error instanceof Error ? error.message : String(error)
	const apiError = new ApiProviderError(errorMessage, providerName, modelId, "createMessage")
	getTelemetryService().captureException(apiError)
	throw new Error(
		error instanceof Error
			? `Error processing response stream: ${error.message}`
			: "Unexpected error processing response stream",
	)
}

export async function* executeWithSdk(
	requestBody: ResponsesRequestBody,
	model: OpenAiNativeModel,
	client: ResponsesClient,
	streamCtx: OpenAiNativeStreamContext,
	normalizeFn: (usage: RawUsage, m: OpenAiNativeModel) => ApiStreamUsageChunk | undefined,
	sessionId: string,
	metadata?: { taskId?: string },
): ApiStream {
	const taskId = metadata?.taskId
	const userAgent = `jabberwock/${Package.version} (${os.platform()} ${os.release()}; ${os.arch()}) node/${process.version.slice(1)}`
	const requestHeaders: Record<string, string> = {
		originator: "jabberwock",
		session_id: taskId || sessionId,
		"User-Agent": userAgent,
	}

	const stream = (await client.responses.create(requestBody, {
		signal: streamCtx.abortController?.signal,
		headers: requestHeaders,
	})) as AsyncIterable<unknown>

	if (typeof (stream as AsyncIterable<unknown>)[Symbol.asyncIterator] !== "function") {
		throw new Error("OpenAI SDK did not return an AsyncIterable for Responses API streaming. Falling back to SSE.")
	}

	for await (const event of stream) {
		if (streamCtx.abortController?.signal.aborted) {
			break
		}

		for await (const outChunk of processEvent(event as Record<string, unknown>, model, streamCtx, normalizeFn)) {
			yield outChunk
		}
	}
}

export async function* executeWithSdkOrFallback(
	requestBody: ResponsesRequestBody,
	model: OpenAiNativeModel,
	client: ResponsesClient,
	streamCtx: OpenAiNativeStreamContext,
	normalizeFn: (usage: RawUsage, m: OpenAiNativeModel) => ApiStreamUsageChunk | undefined,
	sessionId: string,
	providerName: string,
	apiKey: string,
	baseUrl: string | undefined,
	metadata?: { taskId?: string },
): ApiStream {
	try {
		yield* executeWithSdk(requestBody, model, client, streamCtx, normalizeFn, sessionId, metadata)
	} catch {
		yield* makeResponsesApiRequest(
			requestBody,
			model,
			apiKey,
			baseUrl,
			sessionId,
			providerName,
			streamCtx,
			normalizeFn,
			metadata,
		)
	}
}

export async function* makeResponsesApiRequest(
	requestBody: ResponsesRequestBody,
	model: OpenAiNativeModel,
	apiKey: string,
	baseUrl: string | undefined,
	sessionId: string,
	providerName: string,
	streamCtx: OpenAiNativeStreamContext,
	normalizeFn: (usage: RawUsage, m: OpenAiNativeModel) => ApiStreamUsageChunk | undefined,
	metadata?: { taskId?: string },
): ApiStream {
	const resolvedBaseUrl = baseUrl || "https://api.openai.com"
	const url = `${resolvedBaseUrl}/v1/responses`

	const taskId = metadata?.taskId
	const userAgent = `jabberwock/${Package.version} (${os.platform()} ${os.release()}; ${os.arch()}) node/${process.version.slice(1)}`

	try {
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
				originator: "jabberwock",
				session_id: taskId || sessionId,
				"User-Agent": userAgent,
			},
			body: JSON.stringify(requestBody),
			signal: streamCtx.abortController?.signal,
		})

		if (!response.ok) {
			throw await buildResponsesApiError(response)
		}

		if (!response.body) {
			throw new Error("Responses API error: No response body")
		}

		yield* handleStreamResponse(response.body, model, streamCtx, normalizeFn, (err, m) =>
			throwStreamError(err, providerName, m.id),
		)
	} catch (error) {
		throwProviderError(error, providerName, model.id, "createMessage")
	}
}

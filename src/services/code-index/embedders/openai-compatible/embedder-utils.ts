import { OpenAI } from "openai"

import { HttpError } from "@services/code-index/shared/validateContent"

import type { OpenAIEmbeddingResponse } from "./types"

/**
 * Determines if the provided URL is a full endpoint URL or a base URL that needs the endpoint appended by the SDK.
 * Uses smart pattern matching for known providers while accepting we can't cover all possible patterns.
 */
export function isFullEndpointUrl(url: string): boolean {
	// Known patterns for major providers
	const patterns = [
		// Azure OpenAI: /deployments/{deployment-name}/embeddings
		/\/deployments\/[^\/]+\/embeddings(\?|$)/,
		// Azure Databricks: /serving-endpoints/{endpoint-name}/invocations
		/\/serving-endpoints\/[^\/]+\/invocations(\?|$)/,
		// Direct endpoints: ends with /embeddings (before query params)
		/\/embeddings(\?|$)/,
		// Some providers use /embed instead of /embeddings
		/\/embed(\?|$)/,
	]

	return patterns.some((pattern) => pattern.test(url))
}

export async function buildHttpError(response: Response): Promise<HttpError> {
	const status = response?.status || 0
	let errorText = "No response"
	try {
		if (response && typeof response.text === "function") {
			errorText = await response.text()
		} else if (response) {
			errorText = `Error ${status}`
		}
	} catch {
		errorText = `Error ${status}`
	}
	const error = new Error(`HTTP ${status}: ${errorText}`) as HttpError
	error.status = status
	return error
}

export async function parseEmbeddingJsonResponse(response: Response): Promise<OpenAIEmbeddingResponse> {
	try {
		return await response.json()
	} catch (e) {
		const error = new Error(`Failed to parse response JSON`) as HttpError
		error.status = response.status
		throw error
	}
}

export function processEmbeddingResponse(response: OpenAIEmbeddingResponse): {
	embeddings: number[][]
	usage: { promptTokens: number; totalTokens: number }
} {
	const processedEmbeddings = response.data.map((item) => {
		if (typeof item.embedding === "string") {
			const buffer = Buffer.from(item.embedding, "base64")
			const float32Array = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4)

			return {
				...item,
				embedding: Array.from(float32Array),
			}
		}
		return item
	})

	response.data = processedEmbeddings

	const embeddings = response.data.map((item) => item.embedding as number[])

	return {
		embeddings,
		usage: {
			promptTokens: response.usage?.prompt_tokens || 0,
			totalTokens: response.usage?.total_tokens || 0,
		},
	}
}

export async function makeDirectEmbeddingRequest(
	url: string,
	apiKey: string,
	batchTexts: string[],
	model: string,
): Promise<OpenAIEmbeddingResponse> {
	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"api-key": apiKey,
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			input: batchTexts,
			model,
			encoding_format: "base64",
		}),
	})

	if (!response || !response.ok) {
		throw await buildHttpError(response)
	}

	return await parseEmbeddingJsonResponse(response)
}

export async function embedWithClient(
	client: OpenAI,
	texts: string[],
	model: string,
): Promise<OpenAIEmbeddingResponse> {
	const sdkResponse = await client.embeddings.create({
		input: texts,
		model,
		encoding_format: "base64",
	})
	return {
		data: sdkResponse.data.map((item) => ({
			embedding: item.embedding,
		})),
		usage: sdkResponse.usage,
	}
}

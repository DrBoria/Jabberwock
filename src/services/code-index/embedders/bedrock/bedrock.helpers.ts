/**
 * Build the request body for a Bedrock embedding model invocation.
 */
import { t } from "@i18n"

export function buildBedrockRequestBody(text: string, model: string): Record<string, unknown> {
	if (model.startsWith("amazon.nova-2-multimodal")) {
		return {
			taskType: "SINGLE_EMBEDDING",
			singleEmbeddingParams: {
				embeddingPurpose: "GENERIC_INDEX",
				embeddingDimension: 1024,
				text: {
					truncationMode: "END",
					value: text,
				},
			},
		}
	}
	if (model.startsWith("cohere.embed-v4")) {
		return {
			texts: [text],
			input_type: "search_document",
			embedding_types: ["float"],
		}
	}
	if (model.startsWith("cohere.embed")) {
		return {
			texts: [text],
			input_type: "search_document",
		}
	}
	return {
		inputText: text,
	}
}

/**
 * Parse the response body from a Bedrock embedding model invocation.
 */
export function parseBedrockResponse(
	responseBody: Record<string, unknown>,
	model: string,
): { embedding: number[]; inputTextTokenCount?: number } {
	if (model.startsWith("amazon.nova-2-multimodal")) {
		return extractNovaEmbedding(responseBody)
	}
	if (model.startsWith("cohere.embed-v4")) {
		return extractCohereV4Embedding(responseBody)
	}
	if (model.startsWith("cohere.embed")) {
		const embeddings = responseBody.embeddings
		const embedding = Array.isArray(embeddings) && Array.isArray(embeddings[0]) ? (embeddings[0] as number[]) : []
		return { embedding }
	}
	const embedding = responseBody.embedding
	return {
		embedding: Array.isArray(embedding) ? (embedding as number[]) : [],
		inputTextTokenCount: extractTokenCount(responseBody),
	}
}

function extractNovaEmbedding(responseBody: Record<string, unknown>): {
	embedding: number[]
	inputTextTokenCount?: number
} {
	const novaEmbedding = responseBody.embeddings
	if (
		Array.isArray(novaEmbedding) &&
		novaEmbedding.length > 0 &&
		typeof novaEmbedding[0] === "object" &&
		novaEmbedding[0] !== null &&
		"embedding" in novaEmbedding[0]
	) {
		const inner = (novaEmbedding[0] as Record<string, unknown>).embedding
		return {
			embedding: Array.isArray(inner) ? (inner as number[]) : [],
			inputTextTokenCount: extractTokenCount(responseBody),
		}
	}
	const embedding = responseBody.embedding
	return {
		embedding: Array.isArray(embedding) ? (embedding as number[]) : [],
		inputTextTokenCount: extractTokenCount(responseBody),
	}
}

function extractCohereV4Embedding(responseBody: Record<string, unknown>): { embedding: number[] } {
	const floatEmbeddings = responseBody.embeddings
	if (typeof floatEmbeddings === "object" && floatEmbeddings !== null && "float" in floatEmbeddings) {
		const floatArr = (floatEmbeddings as Record<string, unknown>).float
		if (Array.isArray(floatArr) && floatArr.length > 0) {
			return { embedding: Array.isArray(floatArr[0]) ? (floatArr[0] as number[]) : [] }
		}
	}
	if (Array.isArray(floatEmbeddings) && floatEmbeddings.length > 0) {
		return { embedding: Array.isArray(floatEmbeddings[0]) ? (floatEmbeddings[0] as number[]) : [] }
	}
	return { embedding: [] }
}

function extractTokenCount(responseBody: Record<string, unknown>): number | undefined {
	if ("inputTextTokenCount" in responseBody) {
		const val = responseBody.inputTextTokenCount
		if (typeof val === "number") {
			return val
		}
	}
	return undefined
}

export function buildTextBatch(
	texts: string[],
	maxItemTokens: number,
	maxBatchTokens: number,
): { batch: string[]; processedIndices: number[]; batchTokens: number } {
	const batch: string[] = []
	let batchTokens = 0
	const processedIndices: number[] = []

	for (let i = 0; i < texts.length; i++) {
		const text = texts[i]
		const itemTokens = Math.ceil(text.length / 4)

		if (itemTokens > maxItemTokens) {
			processedIndices.push(i)
			continue
		}

		if (batchTokens + itemTokens <= maxBatchTokens) {
			batch.push(text)
			batchTokens += itemTokens
			processedIndices.push(i)
		} else {
			break
		}
	}

	return { batch, processedIndices, batchTokens }
}

export function handleRetryAttemptError(error: unknown, attempts: number, maxRetries: number): boolean {
	if ((error as Record<string, unknown>).name === "ThrottlingException" && attempts < maxRetries - 1) {
		return true
	}

	return false
}

export function handleBedrockValidationError(error: unknown, modelId: string): { valid: false; error: string } | null {
	const err = error as Record<string, unknown>

	if (err.name === "UnrecognizedClientException") {
		return { valid: false, error: t("embeddings:bedrock.invalidCredentials") }
	}

	if (err.name === "AccessDeniedException") {
		return { valid: false, error: t("embeddings:bedrock.accessDenied") }
	}

	if (err.name === "ResourceNotFoundException") {
		return { valid: false, error: t("embeddings:bedrock.modelNotFound", { model: modelId }) }
	}

	return null
}

/**
 * Canonical embedding response processor, shared by all OpenAI-compatible
 * embedders (openai-compatible, openrouter, ...).
 *
 * Decodes base64-encoded embedding vectors into number[] and extracts usage.
 */
export interface EmbeddingResponseLike {
	data: { embedding: string | number[] }[]
	usage?: {
		prompt_tokens?: number
		total_tokens?: number
	}
}

export function processEmbeddingResponse(response: EmbeddingResponseLike): {
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

export interface EmbeddingItem {
	embedding: string | number[]
	[key: string]: unknown
}

export interface OpenRouterEmbeddingResponse {
	data: EmbeddingItem[]
	usage?: {
		prompt_tokens?: number
		total_tokens?: number
	}
}

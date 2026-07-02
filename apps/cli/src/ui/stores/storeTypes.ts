/**
 * Pending streaming updates - batched and flushed after debounce interval
 */
export interface PendingStreamUpdate {
	id: string
	content: string
	partial: boolean
	timestamp: number
}

/**
 * RouterModels type for context window lookup.
 * Simplified version - we only need contextWindow from ModelInfo.
 */
export type RouterModels = Record<string, Record<string, { contextWindow?: number }>>

import { Anthropic } from "@anthropic-ai/sdk"
import { ContentBlock, SystemContentBlock, Message, ConversationRole } from "@aws-sdk/client-bedrock-runtime"
import { CacheStrategyConfig, CacheResult, CachePointPlacement } from "./types"

/**
 * Base cache strategy factory — shared token estimation, content-block
 * conversion and formatting helpers for concrete cache strategies.
 *
 * @param config - Strategy configuration
 */
export function createCacheStrategyBase(config: CacheStrategyConfig) {
	// Calculate token count for system prompt using a more accurate approach
	let systemTokenCount = 0
	if (config.systemPrompt) {
		const text = config.systemPrompt

		// Use a more accurate token estimation than simple character count
		// Count words and add overhead for punctuation and special tokens
		const words = text.split(/\s+/).filter((word) => word.length > 0)
		// Average English word is ~1.3 tokens
		let tokenCount = words.length * 1.3
		// Add overhead for punctuation and special characters
		tokenCount += (text.match(/[.,!?;:()[\]{}""''`]/g) || []).length * 0.3
		// Add overhead for newlines
		tokenCount += (text.match(/\n/g) || []).length * 0.5
		// Add a small overhead for system prompt structure
		tokenCount += 5

		systemTokenCount = Math.ceil(tokenCount)
	}

	/**
	 * Estimate token count for a message using a more accurate approach
	 * This implementation is based on the BaseProvider's countTokens method
	 * but adapted to work without requiring an instance of BaseProvider
	 */
	function countTextTokens(text: string): number {
		if (text.length === 0) return 0

		const words = text.split(/\s+/).filter((word) => word.length > 0)
		let tokens = words.length * 1.3
		tokens += (text.match(/[.,!?;:()[\]{}""''`]/g) || []).length * 0.3
		tokens += (text.match(/\n/g) || []).length * 0.5
		return tokens
	}

	return {
		config,

		getSystemTokenCount(): number {
			return systemTokenCount
		},

		/**
		 * Create a cache point content block
		 */
		createCachePoint(): ContentBlock {
			return { cachePoint: { type: "default" } } as ContentBlock
		},

		/**
		 * Convert messages to content blocks
		 */
		messagesToContentBlocks(messages: Anthropic.Messages.MessageParam[]): Message[] {
			return messages.map((message) => {
				const role: ConversationRole = message.role === "assistant" ? "assistant" : "user"

				const content: ContentBlock[] = Array.isArray(message.content)
					? message.content.map((block) => {
							if (typeof block === "string") {
								return { text: block } as ContentBlock
							}
							if ("text" in block) {
								return { text: block.text } as ContentBlock
							}
							// Handle other content types if needed
							return { text: "[Unsupported Content]" } as ContentBlock
						})
					: [{ text: message.content } as ContentBlock]

				return {
					role,
					content,
				}
			})
		},

		/**
		 * Check if a token count meets the minimum threshold for caching
		 */
		meetsMinTokenThreshold(tokenCount: number): boolean {
			const minTokens = config.modelInfo.minTokensPerCachePoint
			if (!minTokens) {
				return false
			}
			return tokenCount >= minTokens
		},

		estimateTokenCount(message: Anthropic.Messages.MessageParam): number {
			if (!message.content) return 0

			let totalTokens = 0

			if (Array.isArray(message.content)) {
				for (const block of message.content) {
					if (block.type === "text") {
						totalTokens += countTextTokens(block.text || "")
					} else if (block.type === "image") {
						totalTokens += 300
					}
				}
			} else if (typeof message.content === "string") {
				totalTokens += countTextTokens(message.content)
			}

			return Math.ceil(totalTokens + 10)
		},

		/**
		 * Apply cache points to content blocks based on placements
		 */
		applyCachePoints(messages: Message[], placements: CachePointPlacement[]): Message[] {
			const result: Message[] = []
			for (let i = 0; i < messages.length; i++) {
				const placement = placements.find((p) => p.index === i)

				if (placement) {
					messages[i].content?.push(this.createCachePoint())
				}
				result.push(messages[i])
			}

			return result
		},

		/**
		 * Format the final result with cache points applied
		 */
		formatResult(systemBlocks: SystemContentBlock[] = [], messages: Message[]): CacheResult {
			const result = {
				system: systemBlocks,
				messages,
			}
			return result
		},
	}
}

/** createCacheStrategyBase instance type */
export type CacheStrategyBase = ReturnType<typeof createCacheStrategyBase>

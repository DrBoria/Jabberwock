import { Anthropic } from "@anthropic-ai/sdk"
import { Tiktoken } from "tiktoken/lite"
import o200kBase from "tiktoken/encoders/o200k_base"

const TOKEN_FUDGE_FACTOR = 1.5

let encoder: Tiktoken | null = null

/**
 * Serializes a tool_use block to text for token counting.
 * Approximates how the API sees the tool call.
 */
function serializeToolUse(block: Anthropic.Messages.ToolUseBlockParam): string {
	const parts = [`Tool: ${block.name}`]
	if (block.input !== undefined) {
		try {
			parts.push(`Arguments: ${JSON.stringify(block.input)}`)
		} catch {
			parts.push(`Arguments: [serialization error]`)
		}
	}
	return parts.join("\n")
}

/**
 * Serializes a tool_result block to text for token counting.
 * Handles both string content and array content.
 */
function serializeToolResult(block: Anthropic.Messages.ToolResultBlockParam): string {
	const parts = [`Tool Result (${block.tool_use_id})`]

	if (block.is_error) {
		parts.push(`[Error]`)
	}

	const content = block.content
	if (typeof content === "string") {
		parts.push(content)
	} else if (Array.isArray(content)) {
		// Handle array of content blocks recursively
		for (const item of content) {
			if (item.type === "text") {
				parts.push(item.text || "")
			} else if (item.type === "image") {
				parts.push("[Image content]")
			} else {
				parts.push(`[Unsupported content block: ${String((item as { type?: unknown }).type)}]`)
			}
		}
	}

	return parts.join("\n")
}

function countTextBlock(block: Anthropic.Messages.TextBlockParam): number {
	const text = block.text || ""
	if (text.length === 0) {
		return 0
	}
	const tokens = encoder!.encode(text, undefined, [])
	return tokens.length
}

function countImageBlock(block: Anthropic.Messages.ImageBlockParam): number {
	const imageSource = block.source
	if (imageSource && typeof imageSource === "object" && "data" in imageSource) {
		const base64Data = imageSource.data as string
		return Math.ceil(Math.sqrt(base64Data.length))
	}
	return 300
}

function countToolUseBlock(block: Anthropic.Messages.ToolUseBlockParam): number {
	const serialized = serializeToolUse(block)
	if (serialized.length === 0) {
		return 0
	}
	const tokens = encoder!.encode(serialized, undefined, [])
	return tokens.length
}

function countToolResultBlock(block: Anthropic.Messages.ToolResultBlockParam): number {
	const serialized = serializeToolResult(block)
	if (serialized.length === 0) {
		return 0
	}
	const tokens = encoder!.encode(serialized, undefined, [])
	return tokens.length
}

type ContentBlock = Anthropic.Messages.ContentBlockParam
type CounterFn = (block: never) => number

function countThinkingBlock(_block: never): number {
	return 0
}

function countDocumentBlock(_block: never): number {
	return 0
}

function countRedactedThinkingBlock(_block: never): number {
	return 0
}

const tokenCounters: Record<ContentBlock["type"], CounterFn | undefined> = {
	text: countTextBlock as CounterFn,
	image: countImageBlock as CounterFn,
	tool_use: countToolUseBlock as CounterFn,
	tool_result: countToolResultBlock as CounterFn,
	thinking: countThinkingBlock,
	document: countDocumentBlock,
	redacted_thinking: countRedactedThinkingBlock,
}

export async function tiktoken(content: Anthropic.Messages.ContentBlockParam[]): Promise<number> {
	if (content.length === 0) {
		return 0
	}

	// Lazily create and cache the encoder if it doesn't exist.
	if (!encoder) {
		encoder = new Tiktoken(o200kBase.bpe_ranks, o200kBase.special_tokens, o200kBase.pat_str)
	}

	let totalTokens = 0

	// Process each content block using the cached encoder and dispatch map.
	for (const block of content) {
		const counter = tokenCounters[block.type]
		if (counter) {
			totalTokens += counter(block as never)
		}
	}

	// Add a fudge factor to account for the fact that tiktoken is not always
	// accurate.
	return Math.ceil(totalTokens * TOKEN_FUDGE_FACTOR)
}

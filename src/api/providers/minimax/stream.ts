import { Anthropic } from "@anthropic-ai/sdk"

import type { ApiStream } from "@api/transform/stream"

import type { StreamState } from "./types"

export async function* handleStreamEvent(
	chunk: Anthropic.Messages.RawMessageStreamEvent,
	state: StreamState,
): ApiStream {
	switch (chunk.type) {
		case "message_start":
			return yield* handleMessageStart(chunk, state)
		case "message_delta":
			return yield* handleMessageDelta(chunk, state)
		case "content_block_start":
			return yield* handleContentBlockStart(chunk)
		case "content_block_delta":
			return yield* handleContentBlockDelta(chunk)
	}
}

async function* handleMessageStart(chunk: Anthropic.Messages.RawMessageStartEvent, state: StreamState): ApiStream {
	// Tells us cache reads/writes/input/output.
	const {
		input_tokens = 0,
		output_tokens = 0,
		cache_creation_input_tokens,
		cache_read_input_tokens,
	} = chunk.message.usage

	yield {
		type: "usage",
		inputTokens: input_tokens,
		outputTokens: output_tokens,
		cacheWriteTokens: cache_creation_input_tokens || undefined,
		cacheReadTokens: cache_read_input_tokens || undefined,
	}

	state.inputTokens += input_tokens
	state.outputTokens += output_tokens
	state.cacheWriteTokens += cache_creation_input_tokens || 0
	state.cacheReadTokens += cache_read_input_tokens || 0
}

async function* handleMessageDelta(chunk: Anthropic.Messages.RawMessageDeltaEvent, state: StreamState): ApiStream {
	// Tells us stop_reason, stop_sequence, and output tokens
	yield {
		type: "usage",
		inputTokens: 0,
		outputTokens: chunk.usage.output_tokens || 0,
	}

	state.outputTokens += chunk.usage.output_tokens || 0
}

async function* handleContentBlockStart(chunk: Anthropic.Messages.RawContentBlockStartEvent): ApiStream {
	switch (chunk.content_block.type) {
		case "thinking":
			// Yield thinking/reasoning content
			if (chunk.index > 0) {
				yield { type: "reasoning", text: "\n" }
			}

			yield { type: "reasoning", text: chunk.content_block.thinking }
			return
		case "text":
			// We may receive multiple text blocks
			if (chunk.index > 0) {
				yield { type: "text", text: "\n" }
			}

			yield { type: "text", text: chunk.content_block.text }
			return
		case "tool_use": {
			// Emit initial tool call partial with id and name
			yield {
				type: "tool_call_partial",
				index: chunk.index,
				id: chunk.content_block.id,
				name: chunk.content_block.name,
				arguments: undefined,
			}
			return
		}
	}
}

async function* handleContentBlockDelta(chunk: Anthropic.Messages.RawContentBlockDeltaEvent): ApiStream {
	switch (chunk.delta.type) {
		case "thinking_delta":
			yield { type: "reasoning", text: chunk.delta.thinking }
			return
		case "text_delta":
			yield { type: "text", text: chunk.delta.text }
			return
		case "input_json_delta": {
			// Emit tool call partial chunks as arguments stream in
			yield {
				type: "tool_call_partial",
				index: chunk.index,
				id: undefined,
				name: undefined,
				arguments: chunk.delta.partial_json,
			}
			return
		}
	}
}

import { Anthropic } from "@anthropic-ai/sdk"
import type { ModelInfo } from "@jabberwock/types"
import { calculateApiCostAnthropic } from "@shared/api/cost"

export function* handleAnthropicMessageStart(
	chunk: Anthropic.Messages.RawMessageStreamEvent,
	state: { inputTokens: number; outputTokens: number; cacheWriteTokens: number; cacheReadTokens: number },
): Generator<{
	type: "usage"
	inputTokens: number
	outputTokens: number
	cacheWriteTokens?: number
	cacheReadTokens?: number
}> {
	const messageStartChunk = chunk as Anthropic.Messages.MessageStartEvent
	const usage = messageStartChunk.message.usage
	yield {
		type: "usage",
		inputTokens: usage.input_tokens || 0,
		outputTokens: usage.output_tokens || 0,
		cacheWriteTokens: usage.cache_creation_input_tokens || undefined,
		cacheReadTokens: usage.cache_read_input_tokens || undefined,
	}
	state.inputTokens += usage.input_tokens || 0
	state.outputTokens += usage.output_tokens || 0
	state.cacheWriteTokens += usage.cache_creation_input_tokens || 0
	state.cacheReadTokens += usage.cache_read_input_tokens || 0
}

export function* handleAnthropicMessageDelta(
	chunk: Anthropic.Messages.RawMessageStreamEvent,
): Generator<{ type: "usage"; inputTokens: number; outputTokens: number }> {
	const deltaChunk = chunk as Anthropic.Messages.MessageDeltaEvent
	yield {
		type: "usage",
		inputTokens: 0,
		outputTokens: deltaChunk.usage.output_tokens || 0,
	}
}

export function* handleAnthropicContentBlockStart(
	chunk: Anthropic.Messages.RawMessageStreamEvent,
): Generator<
	| { type: "text"; text: string }
	| { type: "reasoning"; text: string }
	| { type: "tool_call_partial"; index: number; id?: string; name?: string; arguments?: string }
> {
	const cbStartEvent = chunk as Anthropic.Messages.ContentBlockStartEvent
	const contentBlock = cbStartEvent.content_block
	switch (contentBlock.type) {
		case "thinking": {
			if (cbStartEvent.index > 0) {
				yield { type: "reasoning", text: "\n" }
			}
			yield { type: "reasoning", text: contentBlock.thinking }
			break
		}
		case "text": {
			if (cbStartEvent.index > 0) {
				yield { type: "text", text: "\n" }
			}
			yield { type: "text", text: contentBlock.text }
			break
		}
		case "tool_use": {
			yield {
				type: "tool_call_partial",
				index: cbStartEvent.index,
				id: contentBlock.id,
				name: contentBlock.name,
				arguments: undefined,
			}
			break
		}
	}
}

export function* handleAnthropicContentBlockDelta(
	chunk: Anthropic.Messages.RawMessageStreamEvent,
): Generator<
	| { type: "text"; text: string }
	| { type: "reasoning"; text: string }
	| { type: "tool_call_partial"; index: number; id?: string; name?: string; arguments?: string }
> {
	const cbDeltaEvent = chunk as Anthropic.Messages.ContentBlockDeltaEvent
	const delta = cbDeltaEvent.delta
	switch (delta.type) {
		case "thinking_delta": {
			yield { type: "reasoning", text: delta.thinking }
			break
		}
		case "text_delta": {
			yield { type: "text", text: delta.text }
			break
		}
		case "input_json_delta": {
			yield {
				type: "tool_call_partial",
				index: cbDeltaEvent.index,
				id: undefined,
				name: undefined,
				arguments: delta.partial_json,
			}
			break
		}
	}
}

export function* yieldAnthropicCost(
	state: {
		inputTokens: number
		outputTokens: number
		cacheWriteTokens: number
		cacheReadTokens: number
	},
	getModel: () => { info: ModelInfo },
): Generator<{ type: "usage"; inputTokens: number; outputTokens: number; totalCost: number }, void> {
	if (state.inputTokens > 0 || state.outputTokens > 0 || state.cacheWriteTokens > 0 || state.cacheReadTokens > 0) {
		const { totalCost } = calculateApiCostAnthropic(
			getModel().info,
			state.inputTokens,
			state.outputTokens,
			state.cacheWriteTokens,
			state.cacheReadTokens,
		)
		yield {
			type: "usage",
			inputTokens: 0,
			outputTokens: 0,
			totalCost,
		}
	}
}

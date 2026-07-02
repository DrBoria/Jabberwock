import { Anthropic } from "@anthropic-ai/sdk"

import { ANTHROPIC_DEFAULT_MAX_TOKENS } from "@jabberwock/types"
import { addCacheBreakpoints } from "@api/transform/caching/vertex"
import type { ApiStream } from "@api/transform/stream"

import type { ThinkingContentBlock, ThinkingDelta, InputJsonDelta } from "./types"

export function* handleVertexMessageStart(chunk: Anthropic.Messages.MessageStreamEvent): Generator<
	{
		type: "usage"
		inputTokens: number
		outputTokens: number
		cacheWriteTokens?: number
		cacheReadTokens?: number
	},
	void
> {
	const usage = (chunk as Anthropic.Messages.MessageStartEvent).message!.usage

	yield {
		type: "usage",
		inputTokens: usage.input_tokens || 0,
		outputTokens: usage.output_tokens || 0,
		cacheWriteTokens: usage.cache_creation_input_tokens || undefined,
		cacheReadTokens: usage.cache_read_input_tokens || undefined,
	}
}

export function* handleVertexMessageDelta(
	chunk: Anthropic.Messages.MessageStreamEvent,
): Generator<{ type: "usage"; inputTokens: number; outputTokens: number }, void> {
	yield {
		type: "usage",
		inputTokens: 0,
		outputTokens: (chunk as Anthropic.Messages.MessageDeltaEvent).usage!.output_tokens || 0,
	}
}

export function* handleVertexContentBlockStart(
	chunk: Anthropic.Messages.MessageStreamEvent,
): Generator<
	| { type: "text"; text: string }
	| { type: "reasoning"; text: string }
	| { type: "tool_call_partial"; index: number; id?: string; name?: string; arguments?: string },
	void
> {
	const contentBlock = (chunk as Anthropic.Messages.ContentBlockStartEvent).content_block!

	switch (contentBlock.type) {
		case "text": {
			const cbStartEvent = chunk as Anthropic.Messages.ContentBlockStartEvent
			if (cbStartEvent.index! > 0) {
				yield { type: "text", text: "\n" }
			}

			yield { type: "text", text: contentBlock.text }
			break
		}
		case "thinking": {
			const cbStartEvent = chunk as Anthropic.Messages.ContentBlockStartEvent
			if (cbStartEvent.index! > 0) {
				yield { type: "reasoning", text: "\n" }
			}

			yield { type: "reasoning", text: (contentBlock as ThinkingContentBlock).thinking }
			break
		}
		case "tool_use": {
			const cbStartEvent = chunk as Anthropic.Messages.ContentBlockStartEvent
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

export function* handleVertexContentBlockDelta(
	chunk: Anthropic.Messages.MessageStreamEvent,
): Generator<
	| { type: "text"; text: string }
	| { type: "reasoning"; text: string }
	| { type: "tool_call_partial"; index: number; id?: string; name?: string; arguments?: string },
	void
> {
	const delta = (chunk as Anthropic.Messages.ContentBlockDeltaEvent).delta!

	switch (delta.type) {
		case "text_delta": {
			yield { type: "text", text: delta.text }
			break
		}
		case "thinking_delta": {
			yield { type: "reasoning", text: (delta as ThinkingDelta).thinking }
			break
		}
		case "input_json_delta": {
			const cbDeltaEvent = chunk as Anthropic.Messages.ContentBlockDeltaEvent
			yield {
				type: "tool_call_partial",
				index: cbDeltaEvent.index,
				id: undefined,
				name: undefined,
				arguments: (delta as InputJsonDelta).partial_json,
			}
			break
		}
	}
}

export function buildVertexRequestParams(
	id: string,
	maxTokens: number | undefined,
	temperature: number | undefined,
	thinking: Anthropic.Messages.MessageStreamParams["thinking"] | undefined,
	systemPrompt: string,
	supportsPromptCache: boolean,
	sanitizedMessages: Anthropic.Messages.MessageParam[],
	nativeToolParams: { tools: Anthropic.Messages.Tool[]; tool_choice?: Anthropic.Messages.ToolChoice },
): Anthropic.Messages.MessageCreateParamsStreaming {
	return {
		model: id,
		max_tokens: maxTokens ?? ANTHROPIC_DEFAULT_MAX_TOKENS,
		temperature,
		thinking,
		system: supportsPromptCache
			? [{ text: systemPrompt, type: "text" as const, cache_control: { type: "ephemeral" } }]
			: systemPrompt,
		messages: supportsPromptCache ? addCacheBreakpoints(sanitizedMessages) : sanitizedMessages,
		stream: true,
		...nativeToolParams,
	}
}

export function buildVertexRequestOptions(
	betas: string[] | undefined,
): { headers?: Record<string, string> } | undefined {
	return betas?.length ? { headers: { "anthropic-beta": betas.join(",") } } : undefined
}

export async function* processVertexStream(stream: AsyncIterable<Anthropic.Messages.MessageStreamEvent>): ApiStream {
	for await (const chunk of stream) {
		switch (chunk.type) {
			case "message_start": {
				yield* handleVertexMessageStart(chunk)
				break
			}
			case "message_delta": {
				yield* handleVertexMessageDelta(chunk)
				break
			}
			case "content_block_start": {
				yield* handleVertexContentBlockStart(chunk)
				break
			}
			case "content_block_delta": {
				yield* handleVertexContentBlockDelta(chunk)
				break
			}
			case "content_block_stop": {
				break
			}
		}
	}
}

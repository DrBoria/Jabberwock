import { Anthropic } from "@anthropic-ai/sdk"
import type { ModelInfo } from "@jabberwock/types"
import type { ApiStreamChunk } from "@api/transform/stream"

import {
	handleAnthropicMessageStart,
	handleAnthropicMessageDelta,
	handleAnthropicContentBlockStart,
	handleAnthropicContentBlockDelta,
	yieldAnthropicCost,
} from "./stream-events"

export async function* processAnthropicStream(
	stream: AsyncIterable<Anthropic.Messages.RawMessageStreamEvent>,
	getModel: () => { info: ModelInfo },
): AsyncGenerator<ApiStreamChunk, void, undefined> {
	const state = { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 }
	for await (const chunk of stream) {
		switch (chunk.type) {
			case "message_start": {
				yield* handleAnthropicMessageStart(chunk, state)
				break
			}
			case "message_delta": {
				yield* handleAnthropicMessageDelta(chunk)
				break
			}
			case "message_stop": {
				break
			}
			case "content_block_start": {
				yield* handleAnthropicContentBlockStart(chunk)
				break
			}
			case "content_block_delta": {
				yield* handleAnthropicContentBlockDelta(chunk)
				break
			}
			case "content_block_stop": {
				break
			}
		}
	}
	yield* yieldAnthropicCost(state, getModel)
}

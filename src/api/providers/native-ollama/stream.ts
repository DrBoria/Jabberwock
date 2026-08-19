import { type ChatResponse } from "ollama"
import { type ApiStreamChunk } from "@api/transform/stream"
import { TagMatcher } from "@utils/text"

export async function* processOllamaStream(
	stream: AsyncIterable<ChatResponse>,
	matcher: TagMatcher<{ readonly type: "text" | "reasoning"; readonly text: string }>,
): AsyncGenerator<
	ApiStreamChunk,
	{
		toolCallIds: string[]
		totalInputTokens: number
		totalOutputTokens: number
	}
> {
	let totalInputTokens = 0
	let totalOutputTokens = 0
	let toolCallIndex = 0
	const toolCallIds: string[] = []
	let chunkCount = 0

	try {
		for await (const chunk of stream) {
			chunkCount++
			if (chunkCount === 1) {
				console.log(`[NativeOllamaHandler] SUCCESS: Received first chunk`)
			}

			yield* processOllamaContentChunk(chunk, matcher, toolCallIds, toolCallIndex)

			if (chunk.eval_count !== undefined || chunk.prompt_eval_count !== undefined) {
				if (chunk.prompt_eval_count) {
					totalInputTokens = chunk.prompt_eval_count
				}
				if (chunk.eval_count) {
					totalOutputTokens = chunk.eval_count
				}
			}
		}
	} catch (streamError) {
		const streamErrMsg = streamError instanceof Error ? streamError.message : String(streamError)
		console.error("[jabberwock] Error processing Ollama stream:", streamError)
		throw new Error(`Ollama stream processing error: ${streamErrMsg}`)
	}

	return {
		toolCallIds,
		totalInputTokens,
		totalOutputTokens,
	}
}

function* processOllamaContentChunk(
	chunk: ChatResponse,
	matcher: TagMatcher<{ readonly type: "text" | "reasoning"; readonly text: string }>,
	toolCallIds: string[],
	toolCallIndex: number,
): Generator<ApiStreamChunk> {
	if (typeof chunk.message.content === "string" && chunk.message.content.length > 0) {
		for (const matcherChunk of matcher.update(chunk.message.content)) {
			yield matcherChunk
		}
	}

	if (chunk.message.tool_calls && chunk.message.tool_calls.length > 0) {
		for (const toolCall of chunk.message.tool_calls) {
			const toolCallId = `ollama-tool-${toolCallIndex}`
			toolCallIds.push(toolCallId)
			yield {
				type: "tool_call_partial",
				index: toolCallIndex,
				id: toolCallId,
				name: toolCall.function.name,
				arguments: JSON.stringify(toolCall.function.arguments),
			}
			toolCallIndex++
		}
	}
}

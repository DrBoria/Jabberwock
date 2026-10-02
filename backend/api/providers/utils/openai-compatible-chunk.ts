import OpenAI from "openai"

/**
 * Shared helpers for OpenAI-compatible streaming providers
 * (Requesty, Unbound, and similar pass-through gateways).
 * Canonical implementation — provider stream modules re-export these.
 */

export function mapReasoningEffort(
	effort: string | undefined,
): OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming["reasoning_effort"] {
	if (effort === "low" || effort === "medium" || effort === "high") {
		return effort
	}
	return undefined
}

export function getReasoningText(delta: unknown): string | undefined {
	const record = delta as Record<string, unknown> | undefined
	if (record && "reasoning_content" in record && record.reasoning_content) {
		return (record.reasoning_content as string | undefined) || ""
	}
	return undefined
}

export function* processOpenAiCompatibleToolCalls(
	toolCalls: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta.ToolCall[],
): Generator<{ type: "tool_call_partial"; index: number; id?: string; name?: string; arguments?: string }> {
	for (const toolCall of toolCalls) {
		yield {
			type: "tool_call_partial",
			index: toolCall.index,
			id: toolCall.id,
			name: toolCall.function?.name,
			arguments: toolCall.function?.arguments,
		}
	}
}

export function* processOpenAiCompatibleChunk(
	delta: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta | undefined,
	chunk: OpenAI.Chat.ChatCompletionChunk,
): Generator<
	| { type: "text"; text: string }
	| { type: "reasoning"; text: string }
	| { type: "tool_call_partial"; index: number; id?: string; name?: string; arguments?: string },
	OpenAI.CompletionUsage | undefined,
	OpenAI.CompletionUsage | undefined
> {
	if (delta?.content) {
		yield { type: "text", text: delta.content }
	}

	const reasoning = getReasoningText(delta)
	if (reasoning) {
		yield { type: "reasoning", text: reasoning }
	}

	if (delta?.tool_calls) {
		yield* processOpenAiCompatibleToolCalls(delta.tool_calls)
	}

	return chunk.usage ?? undefined
}

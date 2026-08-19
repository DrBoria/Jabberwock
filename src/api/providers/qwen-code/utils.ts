import OpenAI from "openai"

export function* parseQwenThinkingBlock(
	text: string,
): Generator<{ type: "text"; text: string } | { type: "reasoning"; text: string }> {
	const parts = text.split(/<\/?think>/g)
	for (let i = 0; i < parts.length; i++) {
		if (parts[i]) {
			if (i % 2 === 0) {
				yield { type: "text", text: parts[i] }
			} else {
				yield { type: "reasoning", text: parts[i] }
			}
		}
	}
}

export function* processQwenToolCalls(
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

export function getQwenReasoningText(
	delta: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta,
): string | undefined {
	if ("reasoning_content" in delta && delta.reasoning_content) {
		return (delta.reasoning_content as string | undefined) || ""
	}
	return undefined
}

export function* processQwenDelta(
	delta: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta,
	fullContent: string,
): Generator<
	| { type: "text"; text: string }
	| { type: "reasoning"; text: string }
	| { type: "tool_call_partial"; index: number; id?: string; name?: string; arguments?: string },
	string
> {
	if (delta.content) {
		let newText = delta.content
		if (newText.startsWith(fullContent)) {
			newText = newText.substring(fullContent.length)
		}

		if (newText) {
			if (newText.includes("<think>") || newText.includes("</think>")) {
				yield* parseQwenThinkingBlock(newText)
			} else {
				yield { type: "text", text: newText }
			}
		}

		return delta.content
	}

	const reasoning = getQwenReasoningText(delta)
	if (reasoning) {
		yield { type: "reasoning", text: reasoning }
	}

	if (delta.tool_calls) {
		yield* processQwenToolCalls(delta.tool_calls)
	}

	return fullContent
}

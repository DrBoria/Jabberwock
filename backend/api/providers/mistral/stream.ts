export function isThinkingChunk(
	chunk: unknown,
): chunk is { type: "thinking"; thinking: Array<{ type: string; text: string }> } {
	if (!chunk || typeof chunk !== "object") {
		return false
	}
	if (!("type" in chunk)) {
		return false
	}
	if (chunk.type !== "thinking") {
		return false
	}
	if (!("thinking" in chunk)) {
		return false
	}
	return Array.isArray(chunk.thinking)
}

export function isTextChunk(chunk: unknown): chunk is { type: "text"; text: string } {
	if (!chunk || typeof chunk !== "object") {
		return false
	}
	if (!("type" in chunk)) {
		return false
	}
	if (chunk.type !== "text") {
		return false
	}
	if (!("text" in chunk)) {
		return false
	}
	return typeof chunk.text === "string"
}

export function isTextPart(part: unknown): part is { type: "text"; text: string } {
	if (!part || typeof part !== "object") {
		return false
	}
	if (!("type" in part)) {
		return false
	}
	if (part.type !== "text") {
		return false
	}
	if (!("text" in part)) {
		return false
	}
	return typeof part.text === "string"
}

export function isToolCallEntry(tc: unknown): tc is { id?: string; function?: { name?: string; arguments?: string } } {
	return tc !== null && typeof tc === "object"
}

export function* processMistralContentArray(
	content: unknown[],
): Generator<{ type: "text"; text: string } | { type: "reasoning"; text: string }> {
	for (const chunk of content) {
		if (isThinkingChunk(chunk)) {
			for (const part of chunk.thinking) {
				if (isTextPart(part)) {
					yield { type: "reasoning", text: part.text }
				}
			}
			continue
		}
		if (isTextChunk(chunk)) {
			yield { type: "text", text: chunk.text }
		}
	}
}

export function* processMistralToolCalls(
	toolCalls: unknown,
): Generator<{ type: "tool_call_partial"; index: number; id?: string; name?: string; arguments?: string }> {
	if (!Array.isArray(toolCalls)) {
		return
	}

	for (let i = 0; i < toolCalls.length; i++) {
		const tc = toolCalls[i]
		if (isToolCallEntry(tc)) {
			yield {
				type: "tool_call_partial",
				index: i,
				id: tc.id,
				name: tc.function?.name,
				arguments: tc.function?.arguments,
			}
		}
	}
}

export function* processMistralContent(
	content: unknown,
): Generator<{ type: "text"; text: string } | { type: "reasoning"; text: string }> {
	if (typeof content === "string") {
		yield { type: "text", text: content }
		return
	}
	if (Array.isArray(content)) {
		yield* processMistralContentArray(content)
	}
}

export function* processMistralEvent(
	choices: Array<{ delta?: { content?: unknown; toolCalls?: unknown } }>,
	usage?: { promptTokens?: number; completionTokens?: number },
): Generator<
	| { type: "text"; text: string }
	| { type: "reasoning"; text: string }
	| { type: "tool_call_partial"; index: number; id?: string; name?: string; arguments?: string }
	| { type: "usage"; inputTokens: number; outputTokens: number }
> {
	const choice = choices[0]
	const delta = choice?.delta

	if (delta) {
		yield* processMistralContent(delta.content)
		yield* processMistralToolCalls(delta.toolCalls)
	}

	if (usage) {
		const { promptTokens = 0, completionTokens = 0 } = usage
		yield { type: "usage", inputTokens: promptTokens, outputTokens: completionTokens }
	}
}

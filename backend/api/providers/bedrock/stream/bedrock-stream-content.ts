import type { ApiStreamChunk } from "@api/transform/stream"
import type { ContentBlockStartEvent, ContentBlockDeltaEvent } from "@api/providers/bedrock/core/types"

export function isThinkingBlockStart(cbStart: ContentBlockStartEvent): boolean {
	return cbStart.contentBlock?.type === "thinking" || cbStart.content_block?.type === "thinking"
}

export function isToolUseBlockStart(cbStart: ContentBlockStartEvent): boolean {
	return !!(cbStart.start?.toolUse || cbStart.contentBlock?.toolUse)
}

export function* yieldReasoningContentBlock(cbStart: ContentBlockStartEvent): Generator<ApiStreamChunk> {
	if (cbStart.contentBlockIndex && cbStart.contentBlockIndex > 0) {
		yield { type: "reasoning", text: "\n" }
	}
	yield {
		type: "reasoning",
		text: cbStart.contentBlock?.reasoningContent?.text || "",
	}
}

export function* yieldThinkingBlock(cbStart: ContentBlockStartEvent): Generator<ApiStreamChunk> {
	const contentBlock = cbStart.contentBlock || cbStart.content_block
	if (cbStart.contentBlockIndex && cbStart.contentBlockIndex > 0) {
		yield { type: "reasoning", text: "\n" }
	}
	if (contentBlock?.thinking) {
		yield {
			type: "reasoning",
			text: contentBlock.thinking,
		}
	}
}

export function* yieldToolUseStart(cbStart: ContentBlockStartEvent): Generator<ApiStreamChunk> {
	const toolUse = cbStart.start?.toolUse || cbStart.contentBlock?.toolUse
	if (toolUse) {
		yield {
			type: "tool_call_partial",
			index: cbStart.contentBlockIndex ?? 0,
			id: toolUse.toolUseId,
			name: toolUse.name,
			arguments: undefined,
		}
	}
}

export function* handleContentBlockStart(cbStart: ContentBlockStartEvent): Generator<ApiStreamChunk> {
	if (cbStart.contentBlock?.reasoningContent) {
		yield* yieldReasoningContentBlock(cbStart)
		return
	}

	if (isThinkingBlockStart(cbStart)) {
		yield* yieldThinkingBlock(cbStart)
		return
	}

	if (isToolUseBlockStart(cbStart)) {
		yield* yieldToolUseStart(cbStart)
		return
	}

	if (cbStart.start?.text) {
		yield {
			type: "text",
			text: cbStart.start.text,
		}
	}
}

export function* handleContentBlockDelta(cbDelta: ContentBlockDeltaEvent): Generator<ApiStreamChunk> {
	const delta = cbDelta.delta
	if (!delta) {
		return
	}

	if (delta.reasoningContent?.text) {
		yield {
			type: "reasoning",
			text: delta.reasoningContent.text,
		}
		return
	}

	if (delta.toolUse?.input) {
		yield {
			type: "tool_call_partial",
			index: cbDelta.contentBlockIndex ?? 0,
			id: undefined,
			name: undefined,
			arguments: delta.toolUse.input,
		}
		return
	}

	if (delta.type === "thinking_delta" && delta.thinking) {
		yield {
			type: "reasoning",
			text: delta.thinking,
		}
		return
	}

	if (delta.text) {
		yield {
			type: "text",
			text: delta.text,
		}
	}
}

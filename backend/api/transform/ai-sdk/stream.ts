import { type TextStreamPart, type ToolSet } from "ai"
import type { ApiStreamChunk } from "@api/transform/stream"

type StreamHandler = (part: ExtendedStreamPart) => ApiStreamChunk | null

function handleTextOrTextDelta(part: ExtendedStreamPart): ApiStreamChunk {
	return { type: "text", text: (part as { text: string }).text }
}

function handleReasoningOrDelta(part: ExtendedStreamPart): ApiStreamChunk {
	return { type: "reasoning", text: (part as { text: string }).text }
}

function handleToolInputStart(part: ExtendedStreamPart): ApiStreamChunk {
	return {
		type: "tool_call_start",
		id: (part as { id: string }).id,
		name: (part as { toolName: string }).toolName,
	}
}

function handleToolInputDelta(part: ExtendedStreamPart): ApiStreamChunk {
	return {
		type: "tool_call_delta",
		id: (part as { id: string }).id,
		delta: (part as { delta: string }).delta,
	}
}

function handleToolInputEnd(part: ExtendedStreamPart): ApiStreamChunk {
	return {
		type: "tool_call_end",
		id: (part as { id: string }).id,
	}
}

function handleToolCall(part: ExtendedStreamPart): ApiStreamChunk {
	const p = part as { toolCallId: string; toolName: string; input: string | Record<string, unknown> }
	return {
		type: "tool_call",
		id: p.toolCallId,
		name: p.toolName,
		arguments: typeof p.input === "string" ? p.input : JSON.stringify(p.input),
	}
}

function handleSource(part: ExtendedStreamPart): ApiStreamChunk | null {
	const p = part as { url?: string; title?: string }
	if (!("url" in p)) {
		return null
	}
	return {
		type: "grounding",
		sources: [
			{
				title: p.title || "Source",
				url: p.url ?? "",
				snippet: undefined,
			},
		],
	}
}

function handleError(part: ExtendedStreamPart): ApiStreamChunk {
	const p = part as { error: Error | string }
	return {
		type: "error",
		error: "StreamError",
		message: p.error instanceof Error ? p.error.message : String(p.error),
	}
}

const STREAM_HANDLERS: Record<string, StreamHandler> = {
	text: handleTextOrTextDelta,
	"text-delta": handleTextOrTextDelta,
	reasoning: handleReasoningOrDelta,
	"reasoning-delta": handleReasoningOrDelta,
	"tool-input-start": handleToolInputStart,
	"tool-input-delta": handleToolInputDelta,
	"tool-input-end": handleToolInputEnd,
	"tool-call": handleToolCall,
	source: handleSource,
	error: handleError,
}

const SILENT_EVENTS = new Set([
	"text-start",
	"text-end",
	"reasoning-start",
	"reasoning-end",
	"start-step",
	"finish-step",
	"start",
	"finish",
	"abort",
	"file",
	"tool-result",
	"tool-error",
	"raw",
])

/**
 * Extended stream part type that includes additional fullStream event types
 * that are emitted at runtime but not included in the AI SDK TextStreamPart type definitions.
 */
export type ExtendedStreamPart =
	| TextStreamPart<ToolSet>
	| { type: "text"; text: string }
	| { type: "reasoning"; text: string }

/**
 * Process a single AI SDK stream part and yield the appropriate ApiStreamChunk(s).
 * This generator handles all TextStreamPart types and converts them to the
 * ApiStreamChunk format used by the application.
 *
 * @param part - The AI SDK TextStreamPart to process (including fullStream event types)
 * @yields ApiStreamChunk objects corresponding to the stream part
 */
export function* processAiSdkStreamPart(part: ExtendedStreamPart): Generator<ApiStreamChunk> {
	if (SILENT_EVENTS.has(part.type)) {
		return
	}
	const handler = STREAM_HANDLERS[part.type]
	if (handler) {
		const result = handler(part)
		if (result) {
			yield result
		}
	}
}

import type { ApiStream } from "@api/transform/stream"
import type { StreamState } from "@api/providers/openai-codex/types"

/** True when a content block carries renderable text (text or output_text). */
export function isTextContent(content: Record<string, unknown>): boolean {
	return ((content.type as string) === "text" || (content.type as string) === "output_text") && !!content.text
}

/**
 * Yield a reasoning delta. Single shared implementation for every reasoning
 * event type (response.reasoning.delta / reasoning_text.delta /
 * reasoning_summary.delta / reasoning_summary_text.delta) — the payload shape
 * is identical, so there is one handler instead of a copy per event type.
 */
export async function* handleReasoningDelta(parsed: Record<string, unknown>): ApiStream {
	const delta = parsed.delta as string | undefined
	if (delta) {
		yield { type: "reasoning", text: delta }
	}
}

/**
 * Shared text-delta primitive: reads `parsed.delta`, marks the state, and
 * yields a text event.  An optional `transform` lets callers reshape the
 * text (e.g. wrap in a `[Refusal] ` prefix) without duplicating the
 * read → mark → yield pipeline.
 *
 * The state parameter only requires the `sawTextOutputInCurrentResponse`
 * flag so other providers (e.g. openai-native) can reuse the same primitive.
 */
export async function* yieldTextDelta(
	parsed: Record<string, unknown>,
	state: Pick<StreamState, "sawTextOutputInCurrentResponse">,
	transform?: (text: string) => string,
): ApiStream {
	const delta = parsed.delta as string | undefined
	if (delta) {
		state.sawTextOutputInCurrentResponse = true
		yield { type: "text", text: transform ? transform(delta) : delta }
	}
}

/** Yield a refusal delta as text, marking that text was seen. */
export async function* handleRefusalDelta(parsed: Record<string, unknown>, state: StreamState): ApiStream {
	yield* yieldTextDelta(parsed, state, (text) => `[Refusal] ${text}`)
}

/**
 * Yield the text carried by a single completion output item — either a direct
 * text/output_text item or the text blocks inside a message item. Shared by
 * the output_item fallback path and the response-completion path so the
 * per-item text extraction is written once.
 */
export async function* yieldCompletionItemText(outputItem: Record<string, unknown>, state: StreamState): ApiStream {
	const outputType = outputItem.type as string | undefined
	if ((outputType === "text" || outputType === "output_text") && outputItem.text) {
		state.sawTextOutputInCurrentResponse = true
		yield { type: "text", text: outputItem.text as string }
		return
	}
	if (outputType === "message") {
		const outputContent = outputItem.content as Record<string, unknown>[] | undefined
		if (Array.isArray(outputContent)) {
			for (const content of outputContent) {
				if (isTextContent(content)) {
					state.sawTextOutputInCurrentResponse = true
					yield { type: "text", text: content.text as string }
				}
			}
		}
	}
}

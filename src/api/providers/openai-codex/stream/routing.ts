import type { ApiStream } from "@api/transform/stream"
import type { OpenAiCodexModel, StreamState, StreamDeps } from "@api/providers/openai-codex/types"
import {
	handleCompleteResponseOutput,
	handleTextDeltaOutput,
	handleTextDoneOutput,
	handleReasoningDeltaOutput,
	handleReasoningSummaryOutput,
	handleRefusalDeltaOutput,
	handleOutputItemAddedOutput,
	handleCompleteOrDoneOutput,
	handleChoicesFallback,
	handleItemTextFallback,
	handleUsageOutput,
	throwErrorEvent,
} from "./output"

export async function* handleNonCoreStreamEvent(
	parsed: Record<string, unknown>,
	model: OpenAiCodexModel,
	state: StreamState,
	deps: StreamDeps,
	hasContent: boolean,
): ApiStream {
	const response = parsed.response as Record<string, unknown> | undefined
	if (response?.output && Array.isArray(response.output)) {
		return yield* handleCompleteResponseOutput(parsed, model, state, deps, hasContent)
	}

	return yield* handleNonCoreEventByType(parsed, model, state, deps, hasContent)
}

export async function* handleNonCoreEventByType(
	parsed: Record<string, unknown>,
	model: OpenAiCodexModel,
	state: StreamState,
	deps: StreamDeps,
	hasContent: boolean,
): ApiStream {
	const parsedType = parsed.type as string | undefined

	if (parsedType === "response.error" || parsedType === "error") {
		if (parsed.error || parsed.message) {
			throwErrorEvent(parsed, "Unknown error")
		}
		return void 0
	}

	if (parsedType === "response.failed") {
		if (parsed.error || parsed.message) {
			throwErrorEvent(parsed, "Unknown failure")
		}
		return void 0
	}

	const nonCoreHandlers: Record<string, (p: Record<string, unknown>, h: boolean) => ApiStream> = {
		"response.text.delta": (p, _h) => handleTextDeltaOutput(p, state),
		"response.output_text.delta": (p, _h) => handleTextDeltaOutput(p, state),
		"response.text.done": (p, h) => handleTextDoneOutput(p, state, h),
		"response.output_text.done": (p, h) => handleTextDoneOutput(p, state, h),
		"response.reasoning.delta": (p, _h) => handleReasoningDeltaOutput(p),
		"response.reasoning_text.delta": (p, _h) => handleReasoningDeltaOutput(p),
		"response.reasoning_summary.delta": (p, _h) => handleReasoningSummaryOutput(p),
		"response.reasoning_summary_text.delta": (p, _h) => handleReasoningSummaryOutput(p),
		"response.refusal.delta": (p, _h) => handleRefusalDeltaOutput(p, state),
		"response.output_item.added": (p, _h) => handleOutputItemAddedOutput(p, state),
		"response.completed": (p, h) => handleCompleteOrDoneOutput(p, state, h),
		"response.done": (p, h) => handleCompleteOrDoneOutput(p, state, h),
	}

	const handler = parsedType ? nonCoreHandlers[parsedType] : undefined
	if (handler) {
		return yield* handler(parsed, hasContent)
	}

	return yield* handleUnknownNonCoreEvent(parsed, model, state, deps, hasContent)
}

export async function* handleUnknownNonCoreEvent(
	parsed: Record<string, unknown>,
	model: OpenAiCodexModel,
	state: StreamState,
	deps: StreamDeps,
	_hasContent: boolean,
): ApiStream {
	const choices = parsed.choices as Array<{ delta?: { content?: string } }> | undefined
	if (choices?.[0]?.delta?.content) {
		return yield* handleChoicesFallback(parsed, state)
	}

	const item = parsed.item as Record<string, unknown> | undefined
	if (item && typeof item.text === "string" && item.text.length > 0) {
		return yield* handleItemTextFallback(parsed, state)
	}

	if (parsed.usage) {
		return yield* handleUsageOutput(parsed, model, deps)
	}

	return void 0
}

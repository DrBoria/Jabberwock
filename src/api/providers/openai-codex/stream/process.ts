import type { ApiStream } from "@api/transform/stream"
import type { OpenAiCodexModel, StreamState, StreamDeps } from "@api/providers/openai-codex/types"
import {
	handleTextDeltaEvent,
	handleTextDoneEvent,
	handleContentPartEvent,
	handleReasoningEvent,
	handleRefusalDeltaEvent,
	handleToolCallDeltaEvent,
	handleOutputItemDoneToolCall,
	handleOutputItemAdded,
	handleOutputItemFallback,
	isFunctionOrToolCallDone,
	isTextContent,
} from "./events"
import { handleNonCoreStreamEvent } from "./routing"
import { isItemEventType, trackToolCallFromItem, noopGenerator } from "@api/providers/openai-codex/utils"

const noopEventTypes = new Set(["response.tool_call_arguments.done", "response.function_call_arguments.done"])

export async function* handleParsedStreamEvent(
	parsed: Record<string, unknown>,
	model: OpenAiCodexModel,
	state: StreamState,
	deps: StreamDeps,
): ApiStream {
	const coreHandledEventTypes = new Set<string>([
		"response.text.delta",
		"response.output_text.delta",
		"response.text.done",
		"response.output_text.done",
		"response.content_part.added",
		"response.content_part.done",
		"response.reasoning.delta",
		"response.reasoning_text.delta",
		"response.reasoning_summary.delta",
		"response.reasoning_summary_text.delta",
		"response.refusal.delta",
		"response.output_item.added",
		"response.output_item.done",
		"response.done",
		"response.completed",
		"response.tool_call_arguments.delta",
		"response.function_call_arguments.delta",
		"response.tool_call_arguments.done",
		"response.function_call_arguments.done",
	])

	const parsedType = parsed?.type as string | undefined
	if (!parsedType || !coreHandledEventTypes.has(parsedType)) {
		return yield* handleNonCoreStreamEvent(parsed, model, state, deps, false)
	}

	if (isItemEventType(parsedType)) {
		trackToolCallFromItem(
			((parsed as Record<string, unknown>).item as Record<string, unknown> | undefined) ?? {},
			state,
		)
	}

	const toolContentTypes = new Set([
		"response.function_call_arguments.delta",
		"response.tool_call_arguments.delta",
		"response.output_item.added",
		"response.output_item.done",
	])
	const localHasContent = toolContentTypes.has(parsedType)

	return yield* processEventChunks(parsed, model, state, deps, localHasContent)
}

async function* processEventChunks(
	parsed: Record<string, unknown>,
	model: OpenAiCodexModel,
	state: StreamState,
	deps: StreamDeps,
	hasContent: boolean,
): ApiStream {
	for await (const outChunk of processEvent(parsed, model, state, deps)) {
		if (outChunk.type === "text") {
			state.sawTextOutputInCurrentResponse = true
		}
		yield outChunk
	}
	return void 0
}

export async function* processEvent(
	event: Record<string, unknown>,
	model: OpenAiCodexModel,
	state: StreamState,
	deps: StreamDeps,
): ApiStream {
	const eventType = event.type as string | undefined

	if (eventType && noopEventTypes.has(eventType)) return

	const processHandlers: Record<string, (ev: Record<string, unknown>) => ApiStream> = {
		"response.text.delta": (ev) => handleTextDeltaEvent(ev, state),
		"response.output_text.delta": (ev) => handleTextDeltaEvent(ev, state),
		"response.text.done": (ev) => handleTextDoneEvent(ev, state),
		"response.output_text.done": (ev) => handleTextDoneEvent(ev, state),
		"response.content_part.added": (ev) => handleContentPartEvent(ev, state),
		"response.content_part.done": (ev) => handleContentPartEvent(ev, state),
		"response.reasoning.delta": (ev) => handleReasoningEvent(ev),
		"response.reasoning_text.delta": (ev) => handleReasoningEvent(ev),
		"response.reasoning_summary.delta": (ev) => handleReasoningEvent(ev),
		"response.reasoning_summary_text.delta": (ev) => handleReasoningEvent(ev),
		"response.refusal.delta": (ev) => handleRefusalDeltaEvent(ev, state),
		"response.tool_call_arguments.delta": (ev) => handleToolCallDeltaEvent(ev, state),
		"response.function_call_arguments.delta": (ev) => handleToolCallDeltaEvent(ev, state),
		"response.output_item.added": (ev) => handleOutputItemEvent(ev, model, state, deps),
		"response.output_item.done": (ev) => handleOutputItemEvent(ev, model, state, deps),
		"response.done": (ev) => handleCompletionEvent(ev, model, state, deps),
		"response.completed": (ev) => handleCompletionEvent(ev, model, state, deps),
	}

	const handler = eventType ? processHandlers[eventType] : undefined
	if (handler) {
		yield* handler(event)
		return
	}

	yield* handleUnhandledProcessEvent(event, model, state, deps)
}

async function* handleUnhandledProcessEvent(
	event: Record<string, unknown>,
	model: OpenAiCodexModel,
	state: StreamState,
	deps: StreamDeps,
): ApiStream {
	const choices = event.choices as Array<{ delta?: { content?: string } }> | undefined
	if (choices?.[0]?.delta?.content) {
		state.sawTextDeltaInCurrentResponse = true
		state.sawTextOutputInCurrentResponse = true
		yield { type: "text", text: choices[0].delta.content }
		return
	}

	const eventUsage = event.usage as Record<string, unknown> | undefined
	if (eventUsage) {
		const usageData = deps.normalizeUsage(eventUsage, model)
		if (usageData) {
			yield usageData
		}
	}
}

async function* handleOutputItemEvent(
	event: Record<string, unknown>,
	model: OpenAiCodexModel,
	state: StreamState,
	deps: StreamDeps,
): ApiStream {
	const item = event.item as Record<string, unknown> | undefined
	if (!item) return

	if (event.type === "response.output_item.added") {
		yield* handleOutputItemAdded(item, state)
	} else if (isFunctionOrToolCallDone(event, item)) {
		yield* handleOutputItemDoneToolCall(item, state)
	} else if (!state.sawTextOutputInCurrentResponse) {
		yield* handleOutputItemFallback(item, state)
	}
}

async function* handleCompletionEvent(
	event: Record<string, unknown>,
	model: OpenAiCodexModel,
	state: StreamState,
	deps: StreamDeps,
): ApiStream {
	const response = event.response as { output?: unknown[]; usage?: Record<string, unknown> } | undefined
	if (!state.sawTextOutputInCurrentResponse && Array.isArray(response?.output)) {
		yield* processCompletionOutput(response.output as Record<string, unknown>[], state)
	}

	const usage = (response?.usage ?? event.usage) as Record<string, unknown> | undefined
	const usageData = deps.normalizeUsage(usage ?? ({} as Record<string, unknown>), model)
	if (usageData) {
		yield usageData
	}
}

async function* processCompletionOutput(output: Record<string, unknown>[], state: StreamState): ApiStream {
	for (const outputItem of output) {
		const outputType = outputItem.type as string | undefined
		if ((outputType === "text" || outputType === "output_text") && outputItem.text) {
			state.sawTextOutputInCurrentResponse = true
			yield { type: "text", text: outputItem.text as string }
			continue
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
}

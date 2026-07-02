import type { ApiStream, ApiStreamUsageChunk } from "@api/transform/stream"

import type { OpenAiNativeModel, RawUsage } from "@api/providers/openai-native/types"
import type { OpenAiNativeStreamContext } from "./core/context"
import { isContentPartText, extractPartText, resolveToolCallId, resolveToolCallName } from "./core/helpers"
import { buildSenders } from "./senders"

async function* handleProcessTextDelta(
	event: Record<string, unknown>,
	_ctx: OpenAiNativeStreamContext,
	_: OpenAiNativeModel,
): ApiStream {
	const delta = event.delta as string | undefined
	if (delta) {
		_ctx.sawTextDeltaInCurrentResponse = true
		_ctx.sawTextOutputInCurrentResponse = true
		yield { type: "text", text: delta }
	}
}

async function* handleProcessTextDone(
	event: Record<string, unknown>,
	ctx: OpenAiNativeStreamContext,
	_: OpenAiNativeModel,
): ApiStream {
	const doneText =
		typeof event?.text === "string"
			? (event.text as string)
			: typeof (event as Record<string, unknown>).output_text === "string"
				? (event.output_text as string)
				: typeof event?.delta === "string"
					? (event.delta as string)
					: undefined
	if (!ctx.sawTextOutputInCurrentResponse && doneText) {
		ctx.sawTextOutputInCurrentResponse = true
		yield { type: "text", text: doneText }
	}
}

async function* handleProcessContentPart(
	event: Record<string, unknown>,
	ctx: OpenAiNativeStreamContext,
	_: OpenAiNativeModel,
): ApiStream {
	if (ctx.sawTextDeltaInCurrentResponse) {
		return
	}
	const part = event?.part as { type?: string; text?: string | { value?: string } } | undefined
	if (!isContentPartText(part)) {
		return
	}
	const partText = extractPartText(part)
	if (partText) {
		ctx.sawTextOutputInCurrentResponse = true
		yield { type: "text", text: partText }
	}
}

async function* handleProcessReasoningDelta(
	event: Record<string, unknown>,
	_ctx: OpenAiNativeStreamContext,
	_: OpenAiNativeModel,
): ApiStream {
	const delta = event.delta as string | undefined
	if (delta) {
		yield { type: "reasoning", text: delta }
	}
}

async function* handleProcessRefusalDelta(
	event: Record<string, unknown>,
	ctx: OpenAiNativeStreamContext,
	_: OpenAiNativeModel,
): ApiStream {
	const delta = event.delta as string | undefined
	if (delta) {
		ctx.sawTextOutputInCurrentResponse = true
		yield { type: "text", text: `[Refusal] ${delta}` }
	}
}

async function* handleProcessToolCallDelta(
	event: Record<string, unknown>,
	ctx: OpenAiNativeStreamContext,
	_: OpenAiNativeModel,
): ApiStream {
	const callId = resolveToolCallId(event, ctx)
	const name = resolveToolCallName(event, ctx)
	const args = (event.delta || event.arguments) as string | undefined

	if (typeof name === "string" && name.length > 0 && typeof callId === "string" && callId.length > 0) {
		ctx.streamedToolCallIds.add(callId)
		yield {
			type: "tool_call_partial",
			index: (event.index ?? 0) as number,
			id: callId,
			name,
			arguments: args,
		}
	}
}

export async function* processEvent(
	event: Record<string, unknown>,
	model: OpenAiNativeModel,
	ctx: OpenAiNativeStreamContext,
	normalizeFn: (usage: RawUsage, m: OpenAiNativeModel) => ApiStreamUsageChunk | undefined,
): ApiStream {
	const senders = buildSenders(ctx, normalizeFn)

	const processHandlers: Record<string, (ev: Record<string, unknown>, mdl: OpenAiNativeModel) => ApiStream> = {
		"response.text.delta": (ev, m) => handleProcessTextDelta(ev, ctx, m),
		"response.output_text.delta": (ev, m) => handleProcessTextDelta(ev, ctx, m),
		"response.text.done": (ev, m) => handleProcessTextDone(ev, ctx, m),
		"response.output_text.done": (ev, m) => handleProcessTextDone(ev, ctx, m),
		"response.content_part.added": (ev, m) => handleProcessContentPart(ev, ctx, m),
		"response.content_part.done": (ev, m) => handleProcessContentPart(ev, ctx, m),
		"response.reasoning.delta": (ev, m) => handleProcessReasoningDelta(ev, ctx, m),
		"response.reasoning_text.delta": (ev, m) => handleProcessReasoningDelta(ev, ctx, m),
		"response.reasoning_summary.delta": (ev, m) => handleProcessReasoningDelta(ev, ctx, m),
		"response.reasoning_summary_text.delta": (ev, m) => handleProcessReasoningDelta(ev, ctx, m),
		"response.refusal.delta": (ev, m) => handleProcessRefusalDelta(ev, ctx, m),
		"response.tool_call_arguments.delta": (ev, m) => handleProcessToolCallDelta(ev, ctx, m),
		"response.function_call_arguments.delta": (ev, m) => handleProcessToolCallDelta(ev, ctx, m),
		"response.output_item.added": (ev, m) => senders.handleOutputItemAdded(ev, ctx, m),
		"response.output_item.done": (ev, m) => senders.handleOutputItemDone(ev, ctx, m),
		"response.done": (ev, m) => senders.handleResponseDone(ev, m, ctx, normalizeFn),
		"response.completed": (ev, m) => senders.handleResponseDone(ev, m, ctx, normalizeFn),
	}

	const handler = processHandlers[event?.type as string]
	if (handler) {
		yield* handler(event, model)
		return
	}

	yield* senders.handleProcessFallbacks(event, model, ctx, normalizeFn)
}

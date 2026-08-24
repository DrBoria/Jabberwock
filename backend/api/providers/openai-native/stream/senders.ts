import type { ApiStream, ApiStreamUsageChunk } from "@api/transform/stream"

import type { OpenAiNativeModel, RawUsage } from "@api/providers/openai-native/types"
import type { OpenAiNativeStreamContext } from "./core/context"
import {
	isTextOrOutputText,
	getToolCallId,
	getToolFunctionName,
	captureOutputItemToolIdentity,
	stringifyArgs,
} from "./core/helpers"

export interface OpenAiNativeStreamSenders {
	handleOutputItemAdded: (
		event: Record<string, unknown>,
		ctx: OpenAiNativeStreamContext,
		m: OpenAiNativeModel,
	) => ApiStream
	handleOutputItemDone: (
		event: Record<string, unknown>,
		ctx: OpenAiNativeStreamContext,
		m: OpenAiNativeModel,
	) => ApiStream
	handleResponseDone: (
		event: Record<string, unknown>,
		m: OpenAiNativeModel,
		ctx: OpenAiNativeStreamContext,
		normalizeFn: (usage: RawUsage, m: OpenAiNativeModel) => ApiStreamUsageChunk | undefined,
	) => ApiStream
	handleProcessFallbacks: (
		event: Record<string, unknown>,
		model: OpenAiNativeModel,
		ctx: OpenAiNativeStreamContext,
		normalizeFn: (usage: RawUsage, m: OpenAiNativeModel) => ApiStreamUsageChunk | undefined,
	) => ApiStream
}

async function* yieldItemText(item: Record<string, unknown>, ctx: OpenAiNativeStreamContext): ApiStream {
	if (item.text) {
		ctx.sawTextOutputInCurrentResponse = true
		yield { type: "text", text: item.text as string }
	}
}

async function* yieldItemOutputText(item: Record<string, unknown>, ctx: OpenAiNativeStreamContext): ApiStream {
	if (item.text) {
		ctx.sawTextOutputInCurrentResponse = true
		yield { type: "text", text: item.text as string }
	}
}

async function* yieldItemReasoning(item: Record<string, unknown>): ApiStream {
	if (item.text) {
		yield { type: "reasoning", text: item.text as string }
	}
}

async function* yieldItemMessageContent(item: Record<string, unknown>, ctx: OpenAiNativeStreamContext): ApiStream {
	if (Array.isArray(item.content)) {
		yield* yieldMessageTextContent(item, ctx)
	}
}

async function* yieldMessageTextContent(item: Record<string, unknown>, ctx: OpenAiNativeStreamContext): ApiStream {
	for (const content of item.content as Record<string, unknown>[]) {
		if (isTextOrOutputText(content) && content?.text) {
			ctx.sawTextOutputInCurrentResponse = true
			yield { type: "text", text: content.text as string }
		}
	}
}

async function* handleProcessOutputItemAdded(
	event: Record<string, unknown>,
	ctx: OpenAiNativeStreamContext,
	_: OpenAiNativeModel,
): ApiStream {
	const item = event?.item as Record<string, unknown> | undefined
	if (!item) {
		return
	}
	captureOutputItemToolIdentity(item, ctx)

	const itemHandlers: Record<string, (i: Record<string, unknown>) => ApiStream> = {
		text: (i) => yieldItemText(i, ctx),
		output_text: (i) => yieldItemOutputText(i, ctx),
		reasoning: (i) => yieldItemReasoning(i),
		message: (i) => yieldItemMessageContent(i, ctx),
	}
	const handler = itemHandlers[item.type as string]
	if (handler) {
		yield* handler(item)
	}
}

async function* yieldToolCallFromItem(item: Record<string, unknown>, ctx: OpenAiNativeStreamContext): ApiStream {
	const callId = getToolCallId(item)
	const name = getToolFunctionName(item)
	const args = stringifyArgs(
		item.arguments || (item.function as Record<string, unknown> | undefined)?.arguments || item.input,
	)

	if (typeof callId === "string" && callId.length > 0 && typeof name === "string" && name.length > 0) {
		if (!ctx.streamedToolCallIds.has(callId)) {
			yield {
				type: "tool_call",
				id: callId,
				name,
				arguments: args,
			}
		}
	}
}

async function* yieldFallbackTextFromItem(item: Record<string, unknown>, ctx: OpenAiNativeStreamContext): ApiStream {
	if (isTextOrOutputText(item) && item.text) {
		ctx.sawTextOutputInCurrentResponse = true
		yield { type: "text", text: item.text as string }
	} else if (item.type === "message" && Array.isArray(item.content)) {
		yield* yieldMessageTextContent(item, ctx)
	}
}

async function* handleProcessOutputItemDone(
	event: Record<string, unknown>,
	ctx: OpenAiNativeStreamContext,
	_: OpenAiNativeModel,
): ApiStream {
	const item = event?.item as Record<string, unknown> | undefined
	if (!item) {
		return
	}
	captureOutputItemToolIdentity(item, ctx)

	if (item.type === "function_call" || item.type === "tool_call") {
		yield* yieldToolCallFromItem(item, ctx)
		return
	}

	if (!ctx.sawTextOutputInCurrentResponse) {
		yield* yieldFallbackTextFromItem(item, ctx)
	}
}

async function* yieldTextFromCompletedOutput(
	output: Record<string, unknown>[],
	ctx: OpenAiNativeStreamContext,
): ApiStream {
	for (const outputItem of output) {
		if (isTextOrOutputText(outputItem) && outputItem?.text) {
			ctx.sawTextOutputInCurrentResponse = true
			yield { type: "text", text: outputItem.text as string }
			continue
		}
		if (outputItem?.type === "message" && Array.isArray(outputItem.content)) {
			yield* yieldMessageTextContent(outputItem as Record<string, unknown>, ctx)
		}
	}
}

async function* handleProcessResponseDone(
	event: Record<string, unknown>,
	model: OpenAiNativeModel,
	ctx: OpenAiNativeStreamContext,
	normalizeFn: (usage: RawUsage, m: OpenAiNativeModel) => ApiStreamUsageChunk | undefined,
): ApiStream {
	const evResponse = event.response as Record<string, unknown> | undefined

	if (!ctx.sawTextOutputInCurrentResponse && Array.isArray(evResponse?.output)) {
		yield* yieldTextFromCompletedOutput(evResponse.output as Record<string, unknown>[], ctx)
	}

	const usage = (evResponse?.usage || event.usage) as Record<string, unknown> | undefined
	const usageData = normalizeFn(usage ?? ({} as Record<string, unknown>), model)
	if (usageData) {
		yield usageData
	}
}

async function* handleProcessFallbacks(
	event: Record<string, unknown>,
	model: OpenAiNativeModel,
	ctx: OpenAiNativeStreamContext,
	normalizeFn: (usage: RawUsage, m: OpenAiNativeModel) => ApiStreamUsageChunk | undefined,
): ApiStream {
	const choices = event.choices as Array<{ delta?: { content?: string } }> | undefined
	if (choices?.[0]?.delta?.content) {
		ctx.sawTextDeltaInCurrentResponse = true
		ctx.sawTextOutputInCurrentResponse = true
		yield { type: "text", text: choices[0].delta.content }
		return
	}

	const usage = event.usage as Record<string, unknown> | undefined
	if (usage) {
		const usageData = normalizeFn(usage, model)
		if (usageData) {
			yield usageData
		}
	}
}

export function buildSenders(
	ctx: OpenAiNativeStreamContext,
	normalizeFn: (usage: RawUsage, m: OpenAiNativeModel) => ApiStreamUsageChunk | undefined,
): OpenAiNativeStreamSenders {
	return {
		handleOutputItemAdded: (event, _ctx, m) => handleProcessOutputItemAdded(event, _ctx ?? ctx, m),
		handleOutputItemDone: (event, _ctx, m) => handleProcessOutputItemDone(event, _ctx ?? ctx, m),
		handleResponseDone: (event, m, _ctx, fn) => handleProcessResponseDone(event, m, _ctx ?? ctx, fn ?? normalizeFn),
		handleProcessFallbacks: (event, model, _ctx, fn) =>
			handleProcessFallbacks(event, model, _ctx ?? ctx, fn ?? normalizeFn),
	}
}

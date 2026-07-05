import type { ApiStream, ApiStreamUsageChunk } from "@api/transform/stream"

import type { OpenAiNativeModel, RawUsage } from "@api/providers/openai-native/types"
import type { OpenAiNativeStreamContext } from "./core/context"
import { isTextContent } from "./core/helpers"

export async function* handleNonCoreFallbacks(
	parsed: Record<string, unknown>,
	model: OpenAiNativeModel,
	hasContent: boolean,
	ctx: OpenAiNativeStreamContext,
	normalizeFn: (usage: RawUsage, m: OpenAiNativeModel) => ApiStreamUsageChunk | undefined,
): ApiStream {
	const responseResult: boolean | undefined = yield* tryHandleResponseOutput(
		parsed,
		model,
		hasContent,
		ctx,
		normalizeFn,
	)
	if (responseResult !== undefined) return void 0

	const choicesResult: boolean | undefined = yield* tryHandleChoicesContent(parsed, hasContent, ctx)
	if (choicesResult !== undefined) return void 0

	const itemResult: boolean | undefined = yield* tryHandleItemText(parsed, hasContent)
	if (itemResult !== undefined) return void 0

	if (parsed.usage) {
		return yield* handleUsageEvent(parsed, model, hasContent, normalizeFn)
	}

	return void 0
}

async function* tryHandleResponseOutput(
	parsed: Record<string, unknown>,
	model: OpenAiNativeModel,
	hasContent: boolean,
	ctx: OpenAiNativeStreamContext,
	normalizeFn: (usage: RawUsage, m: OpenAiNativeModel) => ApiStreamUsageChunk | undefined,
): ApiStream {
	const response = parsed.response as Record<string, unknown> | undefined
	if (response?.output && Array.isArray(response.output)) {
		return yield* handleCompleteResponseOutput(parsed, model, hasContent, ctx, normalizeFn)
	}
	return void 0
}

async function* tryHandleChoicesContent(
	parsed: Record<string, unknown>,
	hasContent: boolean,
	ctx: OpenAiNativeStreamContext,
): ApiStream {
	const choices = parsed.choices as Array<{ delta?: { content?: string } }> | undefined
	if (choices?.[0]?.delta?.content) {
		hasContent = true
		ctx.sawTextOutputInCurrentResponse = true
		yield { type: "text", text: choices[0].delta.content }
		return void 0
	}
	return void 0
}

async function* tryHandleItemText(parsed: Record<string, unknown>, _hasContent: boolean): ApiStream {
	const item = parsed.item as Record<string, unknown> | undefined
	if (item && typeof item.text === "string" && item.text.length > 0) {
		_hasContent = true
		yield { type: "text", text: item.text }
		return void 0
	}
	return void 0
}

async function* handleCompleteResponseOutput(
	parsed: Record<string, unknown>,
	model: OpenAiNativeModel,
	hasContent: boolean,
	ctx: OpenAiNativeStreamContext,
	normalizeFn: (usage: RawUsage, m: OpenAiNativeModel) => ApiStreamUsageChunk | undefined,
): ApiStream {
	const response = parsed.response as Record<string, unknown> | undefined
	const output = response?.output as Record<string, unknown>[] | undefined
	if (!output) return void 0

	let _localHasContent = hasContent
	for (const outputItem of output) {
		if (yield* yieldTextFromOutputItem(outputItem, ctx)) {
			_localHasContent = true
		}
		if (yield* yieldReasoningFromOutputItem(outputItem)) {
			_localHasContent = true
		}
	}
	if (response?.usage) {
		const usageData = normalizeFn(response.usage as RawUsage, model)
		if (usageData) {
			yield usageData
		}
	}
	return void 0
}

async function* yieldTextFromOutputItem(
	outputItem: Record<string, unknown>,
	ctx: OpenAiNativeStreamContext,
): ApiStream {
	if (outputItem.type !== "text") return false
	if (!outputItem.content) return false
	let didYield = false
	const contentArray = outputItem.content as Record<string, unknown>[]
	for (const content of contentArray) {
		if (isTextContent(content)) {
			didYield = true
			ctx.sawTextOutputInCurrentResponse = true
			yield { type: "text", text: content.text as string }
		}
	}
	return didYield
}

async function* yieldReasoningFromOutputItem(outputItem: Record<string, unknown>): ApiStream {
	if (outputItem.type !== "reasoning") return false
	if (!Array.isArray(outputItem.summary)) return false
	let didYield = false
	const summaryArray = outputItem.summary as Record<string, unknown>[]
	for (const summary of summaryArray) {
		if (summary?.type === "summary_text" && typeof summary.text === "string") {
			didYield = true
			yield { type: "reasoning", text: summary.text }
		}
	}
	return didYield
}

export async function* handleUsageEvent(
	parsed: Record<string, unknown>,
	model: OpenAiNativeModel,
	hasContent: boolean,
	normalizeFn: (usage: RawUsage, m: OpenAiNativeModel) => ApiStreamUsageChunk | undefined,
): ApiStream {
	if (parsed.usage) {
		const usageData = normalizeFn(parsed.usage as RawUsage, model)
		if (usageData) {
			yield usageData
		}
	}
	return void 0
}

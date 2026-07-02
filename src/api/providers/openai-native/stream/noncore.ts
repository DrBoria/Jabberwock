import type { ApiStream, ApiStreamUsageChunk } from "@api/transform/stream"

import type { OpenAiNativeModel, RawUsage } from "@api/providers/openai-native/types"
import type { OpenAiNativeStreamContext } from "./core/context"
import { captureResponseMetadata } from "./events"
import { isTextContent } from "./core/helpers"
import { handleNonCoreFallbacks, handleUsageEvent } from "./fallback"

async function* handleDeltaEvent(
	parsed: Record<string, unknown>,
	isReasoning: boolean,
	hasContent: boolean,
	ctx: OpenAiNativeStreamContext,
): ApiStream {
	const delta = parsed.delta as string | undefined
	if (delta) {
		hasContent = true
		ctx.sawTextOutputInCurrentResponse = true
		yield {
			type: isReasoning ? "reasoning" : "text",
			text: delta,
		}
	}
	return void 0
}

async function* handleRefusalEvent(
	parsed: Record<string, unknown>,
	hasContent: boolean,
	ctx: OpenAiNativeStreamContext,
): ApiStream {
	if (parsed.delta) {
		hasContent = true
		ctx.sawTextOutputInCurrentResponse = true
		yield {
			type: "text",
			text: `[Refusal] ${parsed.delta}`,
		}
	}
	return void 0
}

async function* handleOutputTextItem(
	parsed: Record<string, unknown>,
	hasContent: boolean,
	ctx: OpenAiNativeStreamContext,
): ApiStream {
	if (!parsed.item) return void 0
	const item = parsed.item as Record<string, unknown>
	if (item.type === "text" && item.text) {
		hasContent = true
		ctx.sawTextOutputInCurrentResponse = true
		yield { type: "text", text: item.text as string }
	} else if (item.type === "reasoning" && item.text) {
		hasContent = true
		yield { type: "reasoning", text: item.text as string }
	} else if (item.type === "message" && item.content) {
		const contentArray = item.content as Record<string, unknown>[]
		for (const content of contentArray) {
			if (isTextContent(content)) {
				hasContent = true
				ctx.sawTextOutputInCurrentResponse = true
				yield { type: "text", text: content.text as string }
			}
		}
	}
	return void 0
}

async function handleErrorEvent(parsed: Record<string, unknown>, message: string): Promise<boolean> {
	if (parsed.error || parsed.message) {
		const errObj = parsed.error as Record<string, unknown> | undefined
		throw new Error(`${message}: ${errObj?.message || (parsed.message as string) || "Unknown error"}`)
	}
	return false
}

async function* yieldTextFromMessageItem(outputItem: Record<string, unknown>): ApiStream {
	if (outputItem.type !== "message") return false
	if (!outputItem.content) return false
	let didYield = false
	const contentArray = outputItem.content as Record<string, unknown>[]
	for (const content of contentArray) {
		if (content.type === "output_text" && content.text) {
			didYield = true
			yield { type: "text", text: content.text as string }
		}
	}
	return didYield
}

async function* yieldReasoningFromMessageItem(outputItem: Record<string, unknown>): ApiStream {
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

async function* handleCompleteResponse(parsed: Record<string, unknown>, hasContent: boolean): ApiStream {
	const response = parsed.response as Record<string, unknown> | undefined
	const output = response?.output as Record<string, unknown>[] | undefined
	if (!Array.isArray(output)) return void 0
	let localHasContent = hasContent
	for (const outputItem of output) {
		if (yield* yieldTextFromMessageItem(outputItem)) {
			localHasContent = true
		}
		if (yield* yieldReasoningFromMessageItem(outputItem)) {
			localHasContent = true
		}
	}
	return void 0
}

async function* handleCompletedEvent(
	parsed: Record<string, unknown>,
	model: OpenAiNativeModel,
	hasContent: boolean,
	ctx: OpenAiNativeStreamContext,
	normalizeFn: (usage: RawUsage, m: OpenAiNativeModel) => ApiStreamUsageChunk | undefined,
): ApiStream {
	captureResponseMetadata(parsed, ctx)
	const response = parsed.response as Record<string, unknown> | undefined
	if (!hasContent && response?.output && Array.isArray(response.output)) {
		return yield* handleCompleteResponse(parsed, hasContent)
	}
	if (response?.usage) {
		return yield* handleUsageEvent(parsed, model, hasContent, normalizeFn)
	}
	return void 0
}

export async function* handleNonCoreStreamEvent(
	parsed: Record<string, unknown>,
	model: OpenAiNativeModel,
	hasContent: boolean,
	ctx: OpenAiNativeStreamContext,
	normalizeFn: (usage: RawUsage, m: OpenAiNativeModel) => ApiStreamUsageChunk | undefined,
): ApiStream {
	const typeResult: boolean | undefined = yield* dispatchNonCoreTypeEvent(parsed, model, hasContent, ctx, normalizeFn)
	if (typeResult !== undefined) return void 0

	return yield* handleNonCoreFallbacks(parsed, model, hasContent, ctx, normalizeFn)
}

async function* dispatchNonCoreTypeEvent(
	parsed: Record<string, unknown>,
	model: OpenAiNativeModel,
	hasContent: boolean,
	ctx: OpenAiNativeStreamContext,
	normalizeFn: (usage: RawUsage, m: OpenAiNativeModel) => ApiStreamUsageChunk | undefined,
): ApiStream {
	const parsedType = parsed.type as string | undefined
	if (!parsedType) return void 0

	if (parsedType === "response.error" || parsedType === "error") {
		await handleErrorEvent(parsed, "Responses API error")
		return void 0
	}

	if (parsedType === "response.failed") {
		await handleErrorEvent(parsed, "Response failed")
		return void 0
	}

	if (parsedType === "response.completed" || parsedType === "response.done") {
		return yield* handleCompletedEvent(parsed, model, hasContent, ctx, normalizeFn)
	}

	return void 0
}

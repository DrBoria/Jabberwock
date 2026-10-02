import type { ApiStream, ApiStreamUsageChunk } from "@api/transform/stream"

import type { OpenAiNativeModel, RawUsage } from "@api/providers/openai-native/types"
import type { OpenAiNativeStreamContext } from "./core/context"
import { captureResponseMetadata } from "./events"
import { handleNonCoreFallbacks, handleUsageEvent } from "./fallback"
import { yieldTextFromItem } from "./core/helpers"
import { yieldReasoningFromOutputItem } from "./yielders"

async function handleErrorEvent(parsed: Record<string, unknown>, message: string): Promise<boolean> {
	if (parsed.error || parsed.message) {
		const errObj = parsed.error as Record<string, unknown> | undefined
		throw new Error(`${message}: ${errObj?.message || (parsed.message as string) || "Unknown error"}`)
	}
	return false
}

async function* handleCompleteResponse(parsed: Record<string, unknown>, _hasContent: boolean): ApiStream {
	const response = parsed.response as Record<string, unknown> | undefined
	const output = response?.output as Record<string, unknown>[] | undefined
	if (!Array.isArray(output)) return void 0
	for (const outputItem of output) {
		yield* yieldTextFromItem(outputItem, "message", (content) => content.type === "output_text" && !!content.text)
		yield* yieldReasoningFromOutputItem(outputItem)
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

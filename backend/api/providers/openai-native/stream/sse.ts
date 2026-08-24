import type { ApiStream, ApiStreamUsageChunk } from "@api/transform/stream"

import type { OpenAiNativeModel, RawUsage } from "@api/providers/openai-native/types"
import type { OpenAiNativeStreamContext } from "./core/context"
import { coreHandledEventTypes, isDoneMarker, isCommentOrEmptyLine, captureResponseMetadata } from "./events"
import { processEvent } from "./handlers"
import { handleNonCoreStreamEvent } from "./noncore"

export async function* handleStreamResponse(
	body: ReadableStream<Uint8Array>,
	model: OpenAiNativeModel,
	ctx: OpenAiNativeStreamContext,
	normalizeFn: (usage: RawUsage, m: OpenAiNativeModel) => ApiStreamUsageChunk | undefined,
	throwStreamError: (error: unknown, m: OpenAiNativeModel) => never,
): ApiStream {
	const reader = body.getReader()
	const decoder = new TextDecoder()
	let buffer = ""
	let hasContent = false

	try {
		while (true) {
			if (ctx.abortController?.signal.aborted) {
				break
			}

			const { done, value } = await reader.read()
			if (done) break

			buffer += decoder.decode(value, { stream: true })
			const lines = buffer.split("\n")
			buffer = lines.pop() || ""

			for (const line of lines) {
				hasContent = yield* processStreamLine(line, model, hasContent, ctx, normalizeFn)
			}
		}
	} catch (error) {
		throwStreamError(error, model)
	} finally {
		reader.releaseLock()
	}
}

export async function* processStreamLine(
	line: string,
	model: OpenAiNativeModel,
	hasContent: boolean,
	ctx: OpenAiNativeStreamContext,
	normalizeFn: (usage: RawUsage, m: OpenAiNativeModel) => ApiStreamUsageChunk | undefined,
): ApiStream {
	if (line.startsWith("data: ")) {
		const data = line.slice(6).trim()
		if (isDoneMarker(data)) {
			return void 0
		}

		try {
			const parsed = JSON.parse(data) as Record<string, unknown>
			captureResponseMetadata(parsed, ctx)

			if (parsed?.type && coreHandledEventTypes.has(parsed.type as string)) {
				return yield* processCoreEvent(parsed, model, hasContent, ctx, normalizeFn)
			}

			return yield* handleNonCoreStreamEvent(parsed, model, hasContent, ctx, normalizeFn)
		} catch (e) {
			if (!(e instanceof SyntaxError)) {
				throw e
			}
		}
	} else if (!isCommentOrEmptyLine(line)) {
		return yield* processNonDataLine(line, hasContent, ctx)
	}

	return void 0
}

async function* processCoreEvent(
	parsed: Record<string, unknown>,
	model: OpenAiNativeModel,
	hasContent: boolean,
	ctx: OpenAiNativeStreamContext,
	normalizeFn: (usage: RawUsage, m: OpenAiNativeModel) => ApiStreamUsageChunk | undefined,
): ApiStream {
	for await (const outChunk of processEvent(parsed, model, ctx, normalizeFn)) {
		if (
			outChunk.type === "text" ||
			outChunk.type === "reasoning" ||
			outChunk.type === "tool_call" ||
			outChunk.type === "tool_call_partial"
		) {
			hasContent = true
		}
		yield outChunk
	}
	return void 0
}

async function* processNonDataLine(line: string, hasContent: boolean, ctx: OpenAiNativeStreamContext): ApiStream {
	try {
		const parsed = JSON.parse(line) as Record<string, unknown>
		if (parsed.content || parsed.text || parsed.message) {
			hasContent = true
			ctx.sawTextOutputInCurrentResponse = true
			yield {
				type: "text",
				text: (parsed.content || parsed.text || parsed.message) as string,
			}
		}
	} catch {
		// Not JSON, might be plain text - ignore
	}
	return void 0
}

import type { ApiStream } from "@api/transform/stream"
import type { OpenAiCodexModel, StreamState, StreamDeps } from "@api/providers/openai-codex/types"
import { getExtractedString } from "@api/providers/openai-codex/utils"

export function isTextOutput(outputItem: Record<string, unknown>): boolean {
	const isText = outputItem.type === "text" || outputItem.type === "output_text"
	return !!isText && !!outputItem.content
}

export function isReasoningOutput(outputItem: Record<string, unknown>): boolean {
	return outputItem.type === "reasoning" && Array.isArray(outputItem.summary)
}

function extractTextContents(outputItem: Record<string, unknown>): string[] {
	const contentArray = outputItem.content as Record<string, unknown>[] | undefined
	if (!contentArray) return []
	return contentArray.filter((c) => c.type === "text" && c.text).map((c) => c.text as string)
}

function* yieldTextContents(outputItem: Record<string, unknown>, state: StreamState): Generator<never, void, unknown> {
	const texts = extractTextContents(outputItem)
	for (const text of texts) {
		state.sawTextOutputInCurrentResponse = true
		yield { type: "text", text } as never
	}
}

function* yieldReasoningSummaries(outputItem: Record<string, unknown>): Generator<never, void, unknown> {
	const summaries = outputItem.summary as Record<string, unknown>[]
	for (const summary of summaries) {
		if (summary?.type === "summary_text" && typeof summary.text === "string") {
			yield { type: "reasoning", text: summary.text } as never
		}
	}
}

export async function* handleCompleteResponseOutput(
	parsed: Record<string, unknown>,
	model: OpenAiCodexModel,
	state: StreamState,
	deps: StreamDeps,
	_hasContent: boolean,
): ApiStream {
	const response = parsed.response as Record<string, unknown> | undefined
	const output = response?.output as Record<string, unknown>[] | undefined
	if (!output) return void 0

	for (const outputItem of output) {
		if (isTextOutput(outputItem)) {
			state.sawTextOutputInCurrentResponse = true
			yieldTextContents(outputItem, state)
		}
		if (isReasoningOutput(outputItem)) {
			yieldReasoningSummaries(outputItem)
		}
	}
	if (response?.usage) {
		const usageData = deps.normalizeUsage(response.usage as Record<string, unknown>, model)
		if (usageData) {
			yield usageData
		}
	}
	return void 0
}

export async function* handleTextDeltaOutput(parsed: Record<string, unknown>, state: StreamState): ApiStream {
	const delta = parsed.delta as string | undefined
	if (delta) {
		state.sawTextOutputInCurrentResponse = true
		yield { type: "text", text: delta }
	}
	return void 0
}

export async function* handleTextDoneOutput(
	parsed: Record<string, unknown>,
	state: StreamState,
	hasContent: boolean,
): ApiStream {
	if (hasContent) return void 0
	const doneText =
		getExtractedString(parsed.text) ?? getExtractedString(parsed.output_text) ?? getExtractedString(parsed.delta)
	if (doneText) {
		state.sawTextOutputInCurrentResponse = true
		yield { type: "text", text: doneText }
	}
	return void 0
}

export async function* handleReasoningDeltaOutput(parsed: Record<string, unknown>): ApiStream {
	const delta = parsed.delta as string | undefined
	if (delta) {
		yield { type: "reasoning", text: delta }
	}
	return void 0
}

export async function* handleReasoningSummaryOutput(parsed: Record<string, unknown>): ApiStream {
	const delta = parsed.delta as string | undefined
	if (delta) {
		yield { type: "reasoning", text: delta }
	}
	return void 0
}

export async function* handleRefusalDeltaOutput(parsed: Record<string, unknown>, state: StreamState): ApiStream {
	if (parsed.delta) {
		state.sawTextOutputInCurrentResponse = true
		yield { type: "text", text: `[Refusal] ${parsed.delta}` }
	}
	return void 0
}

function* yieldMessageTexts(
	item: Record<string, unknown>,
	state: StreamState,
): Generator<{ type: "text"; text: string }, void, unknown> {
	const contentArray = item.content as Record<string, unknown>[]
	for (const content of contentArray) {
		if (content.type === "text" && content.text) {
			state.sawTextOutputInCurrentResponse = true
			yield { type: "text", text: content.text as string }
		}
	}
}

export async function* handleOutputItemAddedOutput(parsed: Record<string, unknown>, state: StreamState): ApiStream {
	const item = parsed.item as Record<string, unknown> | undefined
	if (!item) return void 0

	if (item.type === "text" && item.text) {
		state.sawTextOutputInCurrentResponse = true
		yield { type: "text", text: item.text as string }
	} else if (item.type === "reasoning" && item.text) {
		yield { type: "reasoning", text: item.text as string }
	} else if (item.type === "message" && item.content) {
		yield* yieldMessageTexts(item, state)
	}
	return void 0
}

export function throwErrorEvent(parsed: Record<string, unknown>, errorKey: string): never {
	const errObj = parsed.error as Record<string, unknown> | undefined
	throw new Error(`Codex API error: ${errObj?.message || parsed.message || errorKey}`)
}

export async function* handleCompleteOrDoneOutput(
	parsed: Record<string, unknown>,
	state: StreamState,
	hasContent: boolean,
): ApiStream {
	const response = parsed.response as Record<string, unknown> | undefined
	if (hasContent || !response?.output) return void 0

	const output = response.output as Record<string, unknown>[]
	for (const outputItem of output) {
		if (outputItem.type === "message" && outputItem.content) {
			yield* yieldTextContents(outputItem, state)
		}
		if (isReasoningOutput(outputItem)) {
			yield* yieldReasoningSummaries(outputItem)
		}
	}
	return void 0
}

export async function* handleChoicesFallback(parsed: Record<string, unknown>, state: StreamState): ApiStream {
	const choices = parsed.choices as Array<{ delta?: { content?: string } }> | undefined
	if (choices?.[0]?.delta?.content) {
		state.sawTextOutputInCurrentResponse = true
		yield { type: "text", text: choices[0].delta.content }
	}
	return void 0
}

export async function* handleItemTextFallback(parsed: Record<string, unknown>, state: StreamState): ApiStream {
	const item = parsed.item as Record<string, unknown> | undefined
	if (item && typeof item.text === "string" && item.text.length > 0) {
		state.sawTextOutputInCurrentResponse = true
		yield { type: "text", text: item.text }
	}
	return void 0
}

export async function* handleUsageOutput(
	parsed: Record<string, unknown>,
	model: OpenAiCodexModel,
	deps: StreamDeps,
): ApiStream {
	if (parsed.usage) {
		const usageData = deps.normalizeUsage(parsed.usage as Record<string, unknown>, model)
		if (usageData) {
			yield usageData
		}
	}
	return void 0
}

import type { JsonEvent, JsonEventCost } from "@/types/json-events.js"

export interface JsonEmitterState {
	seenMessageIds: Set<number>
	previousContent: Map<number, string>
	previousToolUseContent: Map<number, string>
	completionResultContent: string | undefined
	lastAssistantText: string | undefined
	expectPromptEchoAsUser: boolean
	lastCost: JsonEventCost | undefined
}

export function parseToolInfo(text: string | undefined): { name: string; input: Record<string, unknown> } | null {
	if (!text) return null
	try {
		const parsed = JSON.parse(text)
		return parsed.tool ? { name: parsed.tool, input: parsed } : null
	} catch {
		return null
	}
}

export function parseApiReqCost(text: string | undefined): JsonEventCost | undefined {
	if (!text) return undefined
	try {
		const parsed = JSON.parse(text)
		return parsed.cost !== undefined
			? {
					totalCost: parsed.cost,
					inputTokens: parsed.tokensIn,
					outputTokens: parsed.tokensOut,
					cacheWrites: parsed.cacheWrites,
					cacheReads: parsed.cacheReads,
				}
			: undefined
	} catch {
		return undefined
	}
}

export const SKIP_SAY_TYPES = new Set([
	"api_req_finished",
	"api_req_retried",
	"api_req_retry_delayed",
	"api_req_rate_limit_wait",
	"api_req_deleted",
	"checkpoint_saved",
	"condense_context",
	"condense_context_error",
	"sliding_window_truncation",
])

export const REASONING_KEY_OFFSET = 1_000_000_000
export const COMMAND_OUTPUT_EXIT_GRACE_MS = 250

export function commonPrefixLen(prev: string, full: string): number {
	let i = 0
	while (i < prev.length && i < full.length && prev[i] === full[i]) {
		i++
	}
	return i
}

export function commonSuffixLen(prev: string, full: string, prefix: number): number {
	let i = 0
	while (
		i < prev.length - prefix &&
		i < full.length - prefix &&
		prev[prev.length - 1 - i] === full[full.length - 1 - i]
	) {
		i++
	}
	return i
}

export function computeDelta(
	previousContent: Map<number, string>,
	msgId: number,
	fullContent: string | undefined,
): string | null {
	if (!fullContent) return null
	const previous = previousContent.get(msgId) || ""
	if (fullContent === previous) return null
	previousContent.set(msgId, fullContent)
	return fullContent.startsWith(previous) ? fullContent.slice(previous.length) : fullContent
}

export function computeStructuredDelta(
	previousToolUseContent: Map<number, string>,
	msgId: number,
	fullContent: string | undefined,
): string | null {
	if (!fullContent) return null
	const previous = previousToolUseContent.get(msgId) || ""
	if (fullContent === previous) return null
	previousToolUseContent.set(msgId, fullContent)
	if (previous.length === 0 || fullContent.startsWith(previous)) {
		return previous.length === 0 ? fullContent : fullContent.slice(previous.length)
	}
	const prefix = commonPrefixLen(previous, fullContent)
	const suffix = commonSuffixLen(previous, fullContent, prefix)
	return fullContent.length >= previous.length && prefix + suffix >= previous.length
		? fullContent.slice(prefix, fullContent.length - suffix)
		: fullContent
}

export function getContentToSend(
	mode: string,
	previousContent: Map<number, string>,
	msgId: number,
	text: string | undefined,
	isPartial: boolean,
): string | null {
	return mode === "stream-json" && isPartial ? computeDelta(previousContent, msgId, text) : (text ?? null)
}

export function isEmptyStreamingDelta(mode: string, content: string | null): boolean {
	return mode === "stream-json" && content === null
}

export function buildTextEvent(
	type: "assistant" | "thinking" | "user",
	id: number,
	content: string | null,
	isDone: boolean,
	subtype?: string,
): JsonEvent {
	const event: JsonEvent = { type, id }
	if (content !== null) event.content = content
	if (subtype) event.subtype = subtype
	if (isDone) event.done = true
	return event
}

export function isToolAsk(ask: string): boolean {
	return ask === "tool" || ask === "command" || ask === "use_mcp_server"
}

export function isUserFeedback(say: string): boolean {
	return say === "user_feedback" || say === "user_feedback_diff"
}

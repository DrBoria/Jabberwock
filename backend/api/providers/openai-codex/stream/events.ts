import type { ApiStream } from "@api/transform/stream"
import { extractTextFromEvent, extractPartText } from "@api/providers/openai-codex/utils"
import type { StreamState } from "@api/providers/openai-codex/types"

export async function* handleTextDeltaEvent(event: Record<string, unknown>, state: StreamState): ApiStream {
	const delta = event.delta as string | undefined
	if (delta) {
		state.sawTextDeltaInCurrentResponse = true
		state.sawTextOutputInCurrentResponse = true
		yield { type: "text", text: delta }
	}
}

export async function* handleTextDoneEvent(event: Record<string, unknown>, state: StreamState): ApiStream {
	const doneText = extractTextFromEvent(event)
	if (!state.sawTextOutputInCurrentResponse && doneText) {
		state.sawTextOutputInCurrentResponse = true
		yield { type: "text", text: doneText }
	}
}

export async function* handleContentPartEvent(event: Record<string, unknown>, state: StreamState): ApiStream {
	const part = event.part as { type?: string; text?: string | { value?: string } } | undefined
	const isUnhandledTextPart =
		!state.sawTextDeltaInCurrentResponse && (part?.type === "text" || part?.type === "output_text")

	if (!isUnhandledTextPart) return

	const partText = extractPartText(part)
	if (partText) {
		state.sawTextOutputInCurrentResponse = true
		yield { type: "text", text: partText }
	}
}

export async function* handleReasoningEvent(event: Record<string, unknown>): ApiStream {
	const delta = event.delta as string | undefined
	if (delta) {
		yield { type: "reasoning", text: delta }
	}
}

export async function* handleRefusalDeltaEvent(event: Record<string, unknown>, state: StreamState): ApiStream {
	const delta = event.delta as string | undefined
	if (delta) {
		state.sawTextOutputInCurrentResponse = true
		yield { type: "text", text: `[Refusal] ${delta}` }
	}
}

function resolveToolCallDeltaId(event: Record<string, unknown>, state: StreamState): string | undefined {
	return (event.call_id ?? event.tool_call_id ?? event.id ?? state.pendingToolCallId) as string | undefined
}

function resolveToolCallDeltaName(event: Record<string, unknown>, state: StreamState): string | undefined {
	return (event.name ?? event.function_name ?? state.pendingToolCallName) as string | undefined
}

export async function* handleToolCallDeltaEvent(event: Record<string, unknown>, state: StreamState): ApiStream {
	const callId = resolveToolCallDeltaId(event, state)
	const name = resolveToolCallDeltaName(event, state)
	const args = (event.delta ?? event.arguments) as string | undefined

	if (!callId || !name) return

	state.streamedToolCallIds.add(callId)
	yield {
		type: "tool_call_partial",
		index: (event.index ?? 0) as number,
		id: callId,
		name,
		arguments: typeof args === "string" ? args : "",
	}
}

export function isFunctionOrToolCallDone(event: Record<string, unknown>, item: Record<string, unknown>): boolean {
	const isDoneEvent = event.type === "response.output_item.done"
	const isToolItem = (item.type as string) === "function_call" || (item.type as string) === "tool_call"
	return isDoneEvent && isToolItem
}

function resolveItemCallId(item: Record<string, unknown>): string | undefined {
	return (item.call_id ?? item.tool_call_id ?? item.id) as string | undefined
}

function resolveItemCallName(item: Record<string, unknown>): string | undefined {
	const fn = item.function as Record<string, unknown> | undefined
	return (item.name ?? fn?.name ?? item.function_name) as string | undefined
}

function extractToolCallArgs(item: Record<string, unknown>): string {
	const fn = item.function as Record<string, unknown> | undefined
	const argsRaw = (item.arguments ?? fn?.arguments ?? item.input) as string | Record<string, unknown> | undefined

	if (typeof argsRaw === "string") return argsRaw
	if (argsRaw && typeof argsRaw === "object") return JSON.stringify(argsRaw)
	return ""
}

export async function* handleOutputItemDoneToolCall(item: Record<string, unknown>, state: StreamState): ApiStream {
	const callId = resolveItemCallId(item)
	const name = resolveItemCallName(item)
	const args = extractToolCallArgs(item)

	const hasValidCallId = typeof callId === "string" && (callId as string).length > 0
	const hasValidName = typeof name === "string" && (name as string).length > 0

	if (hasValidCallId && hasValidName && !state.streamedToolCallIds.has(callId as string)) {
		yield {
			type: "tool_call",
			id: callId as string,
			name: name as string,
			arguments: args,
		}
	}
}

export function isTextContent(content: Record<string, unknown>): boolean {
	return ((content.type as string) === "text" || (content.type as string) === "output_text") && !!content.text
}

export async function* handleOutputItemAdded(item: Record<string, unknown>, state: StreamState): ApiStream {
	const itemType = item.type as string | undefined
	const isTextItem = (itemType === "text" || itemType === "output_text") && item.text
	if (isTextItem) {
		state.sawTextOutputInCurrentResponse = true
		yield { type: "text", text: item.text as string }
		return
	}
	if (itemType === "reasoning" && item.text) {
		yield { type: "reasoning", text: item.text as string }
		return
	}
	if (itemType === "message") {
		const itemContent = item.content as Record<string, unknown>[] | undefined
		if (Array.isArray(itemContent)) {
			for (const content of itemContent) {
				if (isTextContent(content)) {
					state.sawTextOutputInCurrentResponse = true
					yield { type: "text", text: content.text as string }
				}
			}
		}
	}
}

export async function* handleOutputItemFallback(item: Record<string, unknown>, state: StreamState): ApiStream {
	const itemType = item.type as string | undefined
	const isTextItem = (itemType === "text" || itemType === "output_text") && item.text
	if (isTextItem) {
		state.sawTextOutputInCurrentResponse = true
		yield { type: "text", text: item.text as string }
		return
	}
	if (itemType === "message") {
		const itemContent = item.content as Record<string, unknown>[] | undefined
		if (Array.isArray(itemContent)) {
			for (const content of itemContent) {
				if (isTextContent(content)) {
					state.sawTextOutputInCurrentResponse = true
					yield { type: "text", text: content.text as string }
				}
			}
		}
	}
}

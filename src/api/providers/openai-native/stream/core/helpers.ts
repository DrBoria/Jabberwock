import type { OpenAiNativeStreamContext } from "./context"

export function isTextContent(content: { type?: string; text?: unknown }): boolean {
	return content.type === "text" && !!content.text
}

export function isTextOrOutputText(outputItem: Record<string, unknown>): boolean {
	return outputItem?.type === "text" || outputItem?.type === "output_text"
}

export function stringifyArgs(argsRaw: unknown): string {
	if (typeof argsRaw === "string") return argsRaw
	if (argsRaw && typeof argsRaw === "object") return JSON.stringify(argsRaw)
	return ""
}

export function getToolCallId(item: Record<string, unknown>): string | undefined {
	return (item.call_id || item.tool_call_id || item.id) as string | undefined
}

export function getToolFunctionName(item: Record<string, unknown>): string | undefined {
	return (item.name || (item.function as Record<string, unknown> | undefined)?.name || item.function_name) as
		| string
		| undefined
}

export function captureOutputItemToolIdentity(item: Record<string, unknown>, ctx: OpenAiNativeStreamContext): void {
	if (item.type === "function_call" || item.type === "tool_call") {
		const callId = getToolCallId(item)
		const name = getToolFunctionName(item)
		if (typeof callId === "string" && callId.length > 0) {
			ctx.pendingToolCallId = callId
			ctx.pendingToolCallName = typeof name === "string" ? name : undefined
		}
	}
}

export function isContentPartText(part: { type?: string; text?: string | { value?: string } } | undefined): boolean {
	return (
		(part?.type === "text" || part?.type === "output_text") &&
		(typeof part?.text === "string" || typeof (part?.text as { value?: string } | undefined)?.value === "string")
	)
}

export function extractPartText(
	part: { type?: string; text?: string | { value?: string } } | undefined,
): string | undefined {
	if (typeof part?.text === "string") return part.text
	if (typeof (part?.text as { value?: string } | undefined)?.value === "string") {
		return (part?.text as { value?: string }).value
	}
	return undefined
}

export function resolveToolCallId(event: Record<string, unknown>, ctx: OpenAiNativeStreamContext): string | undefined {
	return ((event.call_id || event.tool_call_id || event.id) as string | undefined) || ctx.pendingToolCallId
}

export function resolveToolCallName(
	event: Record<string, unknown>,
	ctx: OpenAiNativeStreamContext,
): string | undefined {
	return ((event.name || event.function_name) as string | undefined) || ctx.pendingToolCallName
}

import type { ServiceTier } from "@jabberwock/types"

import type { OpenAiNativeStreamContext } from "./core/context"

export const coreHandledEventTypes = new Set<string>([
	"response.text.delta",
	"response.output_text.delta",
	"response.text.done",
	"response.output_text.done",
	"response.content_part.added",
	"response.content_part.done",
	"response.reasoning.delta",
	"response.reasoning_text.delta",
	"response.reasoning_summary.delta",
	"response.reasoning_summary_text.delta",
	"response.refusal.delta",
	"response.output_item.added",
	"response.output_item.done",
	"response.done",
	"response.completed",
	"response.tool_call_arguments.delta",
	"response.function_call_arguments.delta",
	"response.tool_call_arguments.done",
	"response.function_call_arguments.done",
])

export function isDoneMarker(data: string): boolean {
	return data === "[DONE]"
}

export function isCommentOrEmptyLine(line: string): boolean {
	return !line.trim() || line.startsWith(":")
}

export function captureResponseMetadata(parsed: Record<string, unknown>, ctx: OpenAiNativeStreamContext): void {
	const response = parsed.response as Record<string, unknown> | undefined
	if (response?.service_tier) {
		ctx.lastServiceTier = response.service_tier as ServiceTier
	}
	if (response?.output && Array.isArray(response.output)) {
		ctx.lastResponseOutput = response.output as Record<string, unknown>[]
	}
	if (response?.id) {
		ctx.lastResponseId = response.id as string
	}
}

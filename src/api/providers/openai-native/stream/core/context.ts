import type { Anthropic } from "@anthropic-ai/sdk"

import { type ServiceTier } from "@jabberwock/types"

import { type ApiStream, type ApiStreamUsageChunk } from "@api/transform/stream"
import { Package } from "@shared/package"
import { getTelemetryService } from "@jabberwock/telemetry"

import type { OpenAiNativeModel, RawUsage } from "@api/providers/openai-native/types"
import { normalizeUsage } from "@api/providers/openai-native/usage"

/**
 * Context passed to stream processing functions.
 * Holds all mutable state tracked across SSE events for a single request.
 */
export interface OpenAiNativeStreamContext {
	pendingToolCallId: string | undefined
	pendingToolCallName: string | undefined
	sawTextOutputInCurrentResponse: boolean
	sawTextDeltaInCurrentResponse: boolean
	streamedToolCallIds: Set<string>
	lastServiceTier: ServiceTier | undefined
	lastResponseOutput: Record<string, unknown>[] | undefined
	lastResponseId: string | undefined
	abortController: AbortController | undefined
}

export function createStreamContext(): OpenAiNativeStreamContext {
	return {
		pendingToolCallId: undefined,
		pendingToolCallName: undefined,
		sawTextOutputInCurrentResponse: false,
		sawTextDeltaInCurrentResponse: false,
		streamedToolCallIds: new Set<string>(),
		lastServiceTier: undefined,
		lastResponseOutput: undefined,
		lastResponseId: undefined,
		abortController: undefined,
	}
}

export function resetStreamContext(ctx: OpenAiNativeStreamContext): void {
	ctx.lastServiceTier = undefined
	ctx.lastResponseOutput = undefined
	ctx.lastResponseId = undefined
	ctx.pendingToolCallId = undefined
	ctx.pendingToolCallName = undefined
	ctx.sawTextOutputInCurrentResponse = false
	ctx.sawTextDeltaInCurrentResponse = false
	ctx.streamedToolCallIds.clear()
}

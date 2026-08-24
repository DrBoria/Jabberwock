import type { ApiStreamUsageChunk } from "@api/transform/stream"

export const CODEX_API_BASE_URL = "https://chatgpt.com/backend-api/codex"

export interface ResponsesRequestBody {
	model: string
	input: Array<{ role: "user" | "assistant"; content: Record<string, unknown>[] } | { type: string; content: string }>
	stream: boolean
	reasoning?: { effort?: string; summary?: "auto" }
	temperature?: number
	store?: boolean
	instructions?: string
	include?: string[]
	tools?: Array<{
		type: "function"
		name: string
		description?: string
		parameters?: Record<string, unknown>
		strict?: boolean
	}>
	tool_choice?: unknown
	parallel_tool_calls?: boolean
}

export interface OpenAiCodexModel {
	id: string
	info: import("@jabberwock/types").ModelInfo
	maxTokens?: number
	temperature?: number
	reasoning?: unknown
	reasoningBudget?: number
}

export interface StreamState {
	sawTextOutputInCurrentResponse: boolean
	sawTextDeltaInCurrentResponse: boolean
	streamedToolCallIds: Set<string>
	pendingToolCallId: string | undefined
	pendingToolCallName: string | undefined
}

export interface StreamDeps {
	normalizeUsage: (usage: Record<string, unknown>, model: OpenAiCodexModel) => ApiStreamUsageChunk | undefined
}

export function resetStreamState(): StreamState {
	return {
		sawTextOutputInCurrentResponse: false,
		sawTextDeltaInCurrentResponse: false,
		streamedToolCallIds: new Set<string>(),
		pendingToolCallId: undefined,
		pendingToolCallName: undefined,
	}
}

import OpenAI from "openai"

import { AnthropicReasoningParams } from "@api/transform/content/reasoning"
import type { ApiHandlerCreateMessageMetadata } from "@api/index"

import { RequestyChatCompletionParamsStreaming } from "./types"

export function buildRequestyCompletionParams(
	model: string,
	openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[],
	max_tokens: number | undefined,
	temperature: number | undefined,
	allowedEffort: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming["reasoning_effort"],
	thinking: AnthropicReasoningParams | undefined,
	metadata: ApiHandlerCreateMessageMetadata | undefined,
	convertTools: (tools: OpenAI.Chat.ChatCompletionTool[] | undefined) => OpenAI.Chat.ChatCompletionTool[] | undefined,
): RequestyChatCompletionParamsStreaming {
	return {
		messages: openAiMessages,
		model,
		max_tokens,
		temperature,
		...(allowedEffort && { reasoning_effort: allowedEffort }),
		...(thinking && { thinking }),
		stream: true,
		stream_options: { include_usage: true },
		requesty: { trace_id: metadata?.taskId, extra: { mode: metadata?.mode } },
		tools: convertTools(metadata?.tools),
		tool_choice: metadata?.tool_choice,
	}
}

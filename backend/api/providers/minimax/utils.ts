import { Anthropic } from "@anthropic-ai/sdk"
import { CacheControlEphemeral } from "@anthropic-ai/sdk/resources"
import OpenAI from "openai"

import type { ModelInfo } from "@jabberwock/types"

import type { ApiStream } from "@api/transform/stream"
import { yieldAnthropicCost } from "@api/providers/anthropic/events"

import type { StreamState } from "./types"

/**
 * Converts OpenAI tool_choice to Anthropic ToolChoice format
 */
export function convertOpenAIToolChoice(
	toolChoice: OpenAI.Chat.ChatCompletionCreateParams["tool_choice"],
): Anthropic.Messages.MessageCreateParams["tool_choice"] | undefined {
	if (!toolChoice) {
		return undefined
	}

	if (typeof toolChoice === "string") {
		switch (toolChoice) {
			case "none":
				return undefined // Anthropic doesn't have "none", just omit tools
			case "auto":
				return { type: "auto" }
			case "required":
				return { type: "any" }
			default:
				return { type: "auto" }
		}
	}

	// Handle object form { type: "function", function: { name: string } }
	if (typeof toolChoice === "object" && "function" in toolChoice) {
		return {
			type: "tool",
			name: toolChoice.function.name,
		}
	}

	return { type: "auto" }
}

export function buildSystemBlocks(
	systemPrompt: string,
	supportsPromptCache: boolean,
	cacheControl: CacheControlEphemeral,
): Anthropic.Messages.TextBlockParam[] {
	return [
		supportsPromptCache
			? { text: systemPrompt, type: "text", cache_control: cacheControl }
			: { text: systemPrompt, type: "text" },
	]
}

/**
 * Add cache control to the last two user messages for prompt caching
 */
export function addCacheControl(
	messages: Anthropic.Messages.MessageParam[],
	cacheControl: CacheControlEphemeral,
): Anthropic.Messages.MessageParam[] {
	const userMsgIndices = messages.reduce(
		(acc, msg, index) => (msg.role === "user" ? [...acc, index] : acc),
		[] as number[],
	)

	const lastUserMsgIndex = userMsgIndices[userMsgIndices.length - 1] ?? -1
	const secondLastMsgUserIndex = userMsgIndices[userMsgIndices.length - 2] ?? -1

	return messages.map((message, index) => {
		if (index === lastUserMsgIndex || index === secondLastMsgUserIndex) {
			return {
				...message,
				content:
					typeof message.content === "string"
						? [{ type: "text", text: message.content, cache_control: cacheControl }]
						: message.content.map((content, contentIndex) =>
								contentIndex === message.content.length - 1
									? { ...content, cache_control: cacheControl }
									: content,
							),
			}
		}
		return message
	})
}

/**
 * Delegates to the canonical Anthropic cost emitter.
 * Canonical implementation: @api/providers/anthropic/events.ts (yieldAnthropicCost).
 */
export async function* maybeEmitFinalCost(state: StreamState, modelInfo: ModelInfo): ApiStream {
	yield* yieldAnthropicCost(state, () => ({ info: modelInfo }))
}

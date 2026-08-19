import { Anthropic } from "@anthropic-ai/sdk"
import { getApiProtocol, getModelId, isRetiredProvider } from "@jabberwock/types"

import type { ITaskModel } from "@features/chat/task/store"

export function prependContentBlock(messageWithTs: { [key: string]: unknown }, block: Record<string, unknown>): void {
	if (typeof messageWithTs.content === "string") {
		messageWithTs.content = [
			block,
			{ type: "text", text: messageWithTs.content } satisfies Anthropic.Messages.TextBlockParam,
		]
	} else if (Array.isArray(messageWithTs.content)) {
		messageWithTs.content = [block, ...messageWithTs.content]
	} else if (!messageWithTs.content) {
		messageWithTs.content = [block]
	}
}

export function appendContentBlock(messageWithTs: { [key: string]: unknown }, block: Record<string, unknown>): void {
	if (typeof messageWithTs.content === "string") {
		messageWithTs.content = [
			{ type: "text", text: messageWithTs.content } satisfies Anthropic.Messages.TextBlockParam,
			block,
		]
	} else if (Array.isArray(messageWithTs.content)) {
		messageWithTs.content = [...messageWithTs.content, block]
	} else if (!messageWithTs.content) {
		messageWithTs.content = [block]
	}
}

function buildEncryptedReasoningBlock(
	reasoningData: { encrypted_content: string; id?: string } | undefined,
): Record<string, unknown> | null {
	if (reasoningData?.encrypted_content) {
		const block: Record<string, unknown> = {
			type: "reasoning",
			summary: undefined,
			encrypted_content: reasoningData.encrypted_content,
		}
		if (reasoningData.id) {
			block.id = reasoningData.id
		}
		return block
	}
	return null
}

export function buildReasoningBlock(
	isAnthropicProtocol: boolean,
	reasoning: string | undefined,
	thoughtSignature: string | undefined,
	reasoningDetails: unknown[] | undefined,
	reasoningData: { encrypted_content: string; id?: string } | undefined,
	reasoningSummary: unknown[] | undefined,
): Record<string, unknown> | null {
	if (isAnthropicProtocol) {
		if (reasoning && thoughtSignature) {
			if (!reasoningDetails) {
				return { type: "thinking", thinking: reasoning, signature: thoughtSignature }
			}
		}
		return null
	}

	if (reasoning) {
		if (!reasoningDetails) {
			return { type: "reasoning", text: reasoning, summary: reasoningSummary }
		}
		return null
	}

	return buildEncryptedReasoningBlock(reasoningData)
}

export function buildThoughtSignatureBlock(
	thoughtSignature: string | undefined,
	isAnthropicProtocol: boolean,
): Record<string, unknown> | null {
	if (thoughtSignature) {
		if (!isAnthropicProtocol) {
			return { type: "thoughtSignature", thoughtSignature }
		}
	}
	return null
}

export function convertToolResultsToText(message: Anthropic.MessageParam): Anthropic.MessageParam {
	if (!Array.isArray(message.content)) {
		return message
	}

	return {
		...message,
		content: message.content.map((block) =>
			block.type === "tool_result"
				? {
						type: "text" as const,
						text: `Tool result:\n${typeof block.content === "string" ? block.content : JSON.stringify(block.content)}`,
					}
				: block,
		),
	}
}

export function resolveAnthropicProtocol(task: ITaskModel): boolean {
	const apiProvider = task.apiConfiguration.apiProvider
	if (apiProvider) {
		if (!isRetiredProvider(apiProvider)) {
			const modelId = getModelId(task.apiConfiguration)
			const apiProtocol = getApiProtocol(apiProvider, modelId)
			return apiProtocol === "anthropic"
		}
	}
	return false
}

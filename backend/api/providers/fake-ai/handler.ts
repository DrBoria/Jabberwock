import { Anthropic } from "@anthropic-ai/sdk"

import type { ModelInfo } from "@jabberwock/types"

import type { ApiHandlerCreateMessageMetadata } from "@api/index"
import type { ApiHandlerOptions } from "@shared/api"
import { ApiStream } from "@api/transform/stream"

interface FakeAI {
	/**
	 * The unique identifier for the FakeAI instance.
	 * It is used to lookup the original FakeAI object in the __moduleState.fakeAiMap
	 * when the fakeAI object is read from "the" VSCode global state.
	 */
	readonly id: string

	/**
	 * A function set by the FakeAIHandler on the FakeAI instance, that removes
	 * the FakeAI instance from "the" fakeAIMap when the FakeAI instance is
	 * no longer needed.
	 */
	removeFromCache?: () => void

	createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream
	getModel(): { id: string; info: ModelInfo }
	countTokens(content: Array<Anthropic.Messages.ContentBlockParam>): Promise<number>
	completePrompt(prompt: string): Promise<string>
}

/**
 * API providers configuration is stored in the VSCode global state.
 * Therefore, when a new task is created, the FakeAI object in the configuration
 * is a new object not related to the original one, but with the same ID.
 *
 * We use the ID to lookup the original FakeAI object in the mapping.
 */
const __moduleState = {
	fakeAiMap: new Map() as Map<string, FakeAI>,
}
export function FakeAIHandler(options: ApiHandlerOptions) {
	const optionsFakeAi = options.fakeAi as FakeAI | undefined
	if (!optionsFakeAi) {
		throw new Error("Fake AI is not set")
	}

	const id = optionsFakeAi.id
	let cachedFakeAi = __moduleState.fakeAiMap.get(id)
	if (cachedFakeAi === undefined) {
		cachedFakeAi = optionsFakeAi
		cachedFakeAi.removeFromCache = () => __moduleState.fakeAiMap.delete(id)
		__moduleState.fakeAiMap.set(id, cachedFakeAi)
	}
	const ai = cachedFakeAi

	const handler = {
		ai: ai,
		async *createMessage(
			systemPrompt: string,
			messages: Anthropic.Messages.MessageParam[],
			metadata?: ApiHandlerCreateMessageMetadata,
		): ApiStream {
			yield* handler.ai.createMessage(systemPrompt, messages, metadata)
		},
		getModel(): {
			id: string
			info: ModelInfo
		} {
			return handler.ai.getModel()
		},
		countTokens(content: Array<Anthropic.Messages.ContentBlockParam>): Promise<number> {
			return handler.ai.countTokens(content)
		},
		completePrompt(prompt: string): Promise<string> {
			return handler.ai.completePrompt(prompt)
		},
	}
	return handler
}

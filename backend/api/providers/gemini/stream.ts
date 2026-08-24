import type { GenerateContentResponse, GroundingMetadata, GenerateContentResponseUsageMetadata } from "@google/genai"

import type { ApiStream } from "@api/transform/stream"
import type { ModelInfo } from "@jabberwock/types"

import { extractGroundingSources, buildUsageChunk } from "./utils"

export class GeminiStreamProcessor {
	lastThoughtSignature: string | undefined
	lastResponseId: string | undefined

	async *processStream(
		result: AsyncIterable<GenerateContentResponse>,
		info: ModelInfo,
		includeThoughtSignatures: boolean,
	): ApiStream {
		let lastUsageMetadata: GenerateContentResponseUsageMetadata | undefined
		let pendingGroundingMetadata: GroundingMetadata | undefined
		let finalResponse: { responseId?: string } | undefined

		let toolCallCounter = 0

		for await (const chunk of result) {
			if (chunk.candidates && chunk.candidates[0]?.finishReason) {
				finalResponse = chunk as { responseId?: string }
			}

			const chunkResult = this.processChunk(chunk, includeThoughtSignatures, toolCallCounter)
			if (chunkResult) {
				for (const item of chunkResult.items) {
					yield item
				}
				toolCallCounter = chunkResult.toolCallCounter
			} else if (chunk.text) {
				yield { type: "text", text: chunk.text }
			}

			if (chunk.usageMetadata) {
				lastUsageMetadata = chunk.usageMetadata
			}
		}

		yield* this.emitPostStreamChunks(finalResponse, pendingGroundingMetadata, lastUsageMetadata, info)
	}

	private processChunk(
		chunk: GenerateContentResponse,
		includeThoughtSignatures: boolean,
		toolCallCounter: number,
	): {
		items: ApiStream extends AsyncGenerator<infer T> ? T[] : never[]
		toolCallCounter: number
		hasContent: boolean
		hasReasoning: boolean
	} | null {
		if (!chunk.candidates || !Array.isArray(chunk.candidates) || chunk.candidates.length === 0) {
			return null
		}

		const candidate = chunk.candidates[0] as Record<string, unknown>
		let hasContent = false
		let hasReasoning = false
		const items: unknown[] = []
		let counter = toolCallCounter

		const content = candidate.content as Record<string, unknown> | undefined
		if (!content || !Array.isArray(content.parts)) {
			return { items: items as never[], toolCallCounter: counter, hasContent, hasReasoning }
		}

		for (const part of content.parts as Array<Record<string, unknown>>) {
			const result = this.processPart(part, includeThoughtSignatures, counter)
			items.push(...result.items)
			counter = result.toolCallCounter
			if (result.hasContent) {
				hasContent = true
			}
			if (result.hasReasoning) {
				hasReasoning = true
			}
		}

		return { items: items as never[], toolCallCounter: counter, hasContent, hasReasoning }
	}

	private processPart(
		part: Record<string, unknown>,
		includeThoughtSignatures: boolean,
		toolCallCounter: number,
	): {
		items: unknown[]
		toolCallCounter: number
		hasContent: boolean
		hasReasoning: boolean
	} {
		const items: unknown[] = []
		let hasContent = false
		let hasReasoning = false
		let counter = toolCallCounter

		const thoughtSignature = part.thoughtSignature as string | undefined
		if (includeThoughtSignatures && thoughtSignature) {
			this.lastThoughtSignature = thoughtSignature
		}

		if (part.thought) {
			if (part.text) {
				hasReasoning = true
				items.push({ type: "reasoning", text: part.text })
			}
		} else if (part.functionCall) {
			hasContent = true
			const fc = part.functionCall as { name: string; args: Record<string, unknown> }
			const callId = `${fc.name}-${counter}`
			const args = JSON.stringify(fc.args)

			items.push({
				type: "tool_call_partial",
				index: counter,
				id: callId,
				name: fc.name,
				arguments: undefined,
			})
			items.push({
				type: "tool_call_partial",
				index: counter,
				id: callId,
				name: undefined,
				arguments: args,
			})
			counter++
		} else if (part.text) {
			hasContent = true
			items.push({ type: "text", text: part.text })
		}

		return { items, toolCallCounter: counter, hasContent, hasReasoning }
	}

	private *emitPostStreamChunks(
		finalResponse: { responseId?: string } | undefined,
		pendingGroundingMetadata: GroundingMetadata | undefined,
		lastUsageMetadata: GenerateContentResponseUsageMetadata | undefined,
		info: ModelInfo,
	): Generator<ApiStream extends AsyncGenerator<infer T> ? T : never> {
		if (finalResponse?.responseId) {
			this.lastResponseId = finalResponse.responseId
		}

		if (pendingGroundingMetadata) {
			const sources = extractGroundingSources(pendingGroundingMetadata)
			if (sources.length > 0) {
				yield { type: "grounding", sources }
			}
		}

		if (lastUsageMetadata) {
			yield buildUsageChunk(lastUsageMetadata, info)
		}
	}
}

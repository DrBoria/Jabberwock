import * as os from "os"
import { v7 as uuidv7 } from "uuid"
import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { Package } from "@shared/core/package"
import {
	type ModelInfo,
	openAiNativeDefaultModelId,
	OpenAiNativeModelId,
	openAiNativeModels,
	OPENAI_NATIVE_DEFAULT_TEMPERATURE,
	type ReasoningEffortExtended,
	type ServiceTier,
} from "@jabberwock/types"

import type { ApiHandlerOptions } from "@shared/api"
import { ApiStream, type ApiStreamUsageChunk } from "@api/transform/stream"
import { getModelParams } from "@api/transform/model-params"

import { createBaseProvider } from "@api/providers/base-provider"
import type { ApiHandlerCreateMessageMetadata } from "@api/index"

import type { OpenAiNativeModel, ResponsesRequestBody, ResponsesClient, RawUsage } from "./types"
import { normalizeUsage as normalizeUsageFn, applyPricingByTier } from "./usage"
import { buildRequestBody } from "./request"
import { formatFullConversation } from "./format"
import { executeCompletePrompt } from "./complete"
import { createStreamContext, resetStreamContext } from "./stream/index"
import { executeWithSdkOrFallback } from "./fetch"

export function OpenAiNativeHandler(options: ApiHandlerOptions) {
	let providerName = "OpenAI Native"
	const sessionId = uuidv7()
	const streamCtx = createStreamContext()
	if (options.enableResponsesReasoningSummary === undefined) {
		options.enableResponsesReasoningSummary = true
	}
	const apiKey = options.openAiNativeApiKey ?? "not-provided"
	const userAgent = `jabberwock/${Package.version} (${os.platform()} ${os.release()}; ${os.arch()}) node/${process.version.slice(1)}`
	const client = new OpenAI({
		baseURL: options.openAiNativeBaseUrl || undefined,
		apiKey,
		defaultHeaders: {
			originator: "jabberwock",
			session_id: sessionId,
			"User-Agent": userAgent,
		},
	})

	const base = createBaseProvider()
	const handler = {
		...base,
		options,
		client: client,
		providerName: providerName,
		sessionId: sessionId,
		abortController: undefined as AbortController | undefined,
		streamCtx: streamCtx,
		normalizeUsage(usage: RawUsage, model: OpenAiNativeModel): ApiStreamUsageChunk | undefined {
			const effectiveTier =
				handler.streamCtx.lastServiceTier ||
				(handler.options.openAiNativeServiceTier as ServiceTier | undefined) ||
				undefined
			const effectiveInfo = applyPricingByTier(model.info, effectiveTier)
			return normalizeUsageFn(usage, model, effectiveTier, effectiveInfo)
		},
		async *createMessage(
			systemPrompt: string,
			messages: Anthropic.Messages.MessageParam[],
			metadata?: ApiHandlerCreateMessageMetadata,
		): ApiStream {
			const model = handler.getModel()
			yield* handler.handleResponsesApiMessage(model, systemPrompt, messages, metadata)
		},
		async *handleResponsesApiMessage(
			model: OpenAiNativeModel,
			systemPrompt: string,
			messages: Anthropic.Messages.MessageParam[],
			metadata?: ApiHandlerCreateMessageMetadata,
		): ApiStream {
			resetStreamContext(handler.streamCtx)
			const { verbosity } = handler.getModel()
			const reasoningEffort = handler.getReasoningEffort(model)
			const formattedInput = formatFullConversation(messages)
			const requestBody = buildRequestBody(
				model,
				formattedInput,
				systemPrompt,
				verbosity,
				reasoningEffort,
				metadata,
				{
					openAiNativeServiceTier: handler.options.openAiNativeServiceTier,
					enableResponsesReasoningSummary: handler.options.enableResponsesReasoningSummary,
					modelTemperature: handler.options.modelTemperature ?? undefined,
				},
				(m) => handler.getPromptCacheRetention(m),
			)
			yield* handler.executeRequest(requestBody, model, metadata)
		},
		async *executeRequest(
			requestBody: ResponsesRequestBody,
			model: OpenAiNativeModel,
			metadata?: ApiHandlerCreateMessageMetadata,
		): ApiStream {
			handler.abortController = new AbortController()
			handler.streamCtx.abortController = handler.abortController
			try {
				const apiKey = handler.options.openAiNativeApiKey ?? "not-provided"
				yield* executeWithSdkOrFallback(
					requestBody,
					model,
					handler.client as ResponsesClient,
					handler.streamCtx,
					(u, m) => handler.normalizeUsage(u, m),
					handler.sessionId,
					handler.providerName,
					apiKey,
					handler.options.openAiNativeBaseUrl,
					metadata,
				)
			} finally {
				handler.abortController = undefined
				handler.streamCtx.abortController = undefined
			}
		},
		getReasoningEffort(model: OpenAiNativeModel): ReasoningEffortExtended | undefined {
			const selected = handler.options.reasoningEffort ?? model.info.reasoningEffort
			return selected && selected !== "disable" ? selected : undefined
		},
		getPromptCacheRetention(model: OpenAiNativeModel): "24h" | undefined {
			if (!model.info.supportsPromptCache) return undefined
			if (model.info.promptCacheRetention === "24h") {
				return "24h"
			}
			return undefined
		},
		getModel() {
			const modelId = handler.options.apiModelId
			let id =
				modelId && modelId in openAiNativeModels ? (modelId as OpenAiNativeModelId) : openAiNativeDefaultModelId
			const info: ModelInfo = openAiNativeModels[id]
			const params = getModelParams({
				format: "openai",
				modelId: id,
				model: info,
				settings: handler.options,
				defaultTemperature: OPENAI_NATIVE_DEFAULT_TEMPERATURE,
			})
			return { id: id.startsWith("o3-mini") ? "o3-mini" : id, info, ...params, verbosity: params.verbosity }
		},
		getEncryptedContent():
			| {
					encrypted_content: string
					id?: string
			  }
			| undefined {
			const reasoningItem = handler.streamCtx.lastResponseOutput?.find(
				(item) => item.type === "reasoning" && item.encrypted_content,
			)
			if (!reasoningItem?.encrypted_content) return undefined
			return {
				encrypted_content: reasoningItem.encrypted_content as string,
				...(reasoningItem.id ? { id: reasoningItem.id as string } : {}),
			}
		},
		getResponseId(): string | undefined {
			return handler.streamCtx.lastResponseId
		},
		async completePrompt(prompt: string): Promise<string> {
			return executeCompletePrompt(handler.client, handler.options, handler.providerName, prompt, {
				getModel: () => handler.getModel(),
				getReasoningEffort: (model) => handler.getReasoningEffort(model),
				getPromptCacheRetention: (model) => handler.getPromptCacheRetention(model),
			})
		},
	}
	return handler
}

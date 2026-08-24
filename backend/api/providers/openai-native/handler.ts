import * as os from "os"
import { v7 as uuidv7 } from "uuid"
import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { Package } from "@shared/package"
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

import { BaseProvider } from "@api/providers/base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "@api/index"

import type { OpenAiNativeModel, ResponsesRequestBody, ResponsesClient, RawUsage } from "./types"
import { normalizeUsage as normalizeUsageFn, applyPricingByTier } from "./usage"
import { buildRequestBody } from "./request"
import { formatFullConversation } from "./format"
import { executeCompletePrompt } from "./complete"
import { type OpenAiNativeStreamContext, createStreamContext, resetStreamContext } from "./stream/index"
import { executeWithSdkOrFallback } from "./fetch"

export class OpenAiNativeHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: OpenAI
	private readonly providerName = "OpenAI Native"
	private readonly sessionId: string
	private abortController?: AbortController
	private readonly streamCtx: OpenAiNativeStreamContext

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		this.sessionId = uuidv7()
		this.streamCtx = createStreamContext()
		if (this.options.enableResponsesReasoningSummary === undefined) {
			this.options.enableResponsesReasoningSummary = true
		}
		const apiKey = this.options.openAiNativeApiKey ?? "not-provided"
		const userAgent = `jabberwock/${Package.version} (${os.platform()} ${os.release()}; ${os.arch()}) node/${process.version.slice(1)}`
		this.client = new OpenAI({
			baseURL: this.options.openAiNativeBaseUrl || undefined,
			apiKey,
			defaultHeaders: {
				originator: "jabberwock",
				session_id: this.sessionId,
				"User-Agent": userAgent,
			},
		})
	}

	/* ─── Usage normalization ─────────────────────────────────── */

	private normalizeUsage(usage: RawUsage, model: OpenAiNativeModel): ApiStreamUsageChunk | undefined {
		const effectiveTier =
			this.streamCtx.lastServiceTier ||
			(this.options.openAiNativeServiceTier as ServiceTier | undefined) ||
			undefined
		const effectiveInfo = applyPricingByTier(model.info, effectiveTier)
		return normalizeUsageFn(usage, model, effectiveTier, effectiveInfo)
	}

	/* ─── Public API ──────────────────────────────────────────── */

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const model = this.getModel()
		yield* this.handleResponsesApiMessage(model, systemPrompt, messages, metadata)
	}

	private async *handleResponsesApiMessage(
		model: OpenAiNativeModel,
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		resetStreamContext(this.streamCtx)

		const { verbosity } = this.getModel()
		const reasoningEffort = this.getReasoningEffort(model)
		const formattedInput = formatFullConversation(messages)

		const requestBody = buildRequestBody(
			model,
			formattedInput,
			systemPrompt,
			verbosity,
			reasoningEffort,
			metadata,
			{
				openAiNativeServiceTier: this.options.openAiNativeServiceTier,
				enableResponsesReasoningSummary: this.options.enableResponsesReasoningSummary,
				modelTemperature: this.options.modelTemperature ?? undefined,
			},
			(m) => this.getPromptCacheRetention(m),
		)

		yield* this.executeRequest(requestBody, model, metadata)
	}

	private async *executeRequest(
		requestBody: ResponsesRequestBody,
		model: OpenAiNativeModel,
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		this.abortController = new AbortController()
		this.streamCtx.abortController = this.abortController

		try {
			const apiKey = this.options.openAiNativeApiKey ?? "not-provided"
			yield* executeWithSdkOrFallback(
				requestBody,
				model,
				this.client as ResponsesClient,
				this.streamCtx,
				(u, m) => this.normalizeUsage(u, m),
				this.sessionId,
				this.providerName,
				apiKey,
				this.options.openAiNativeBaseUrl,
				metadata,
			)
		} finally {
			this.abortController = undefined
			this.streamCtx.abortController = undefined
		}
	}

	/* ─── Model helpers ───────────────────────────────────────── */

	private getReasoningEffort(model: OpenAiNativeModel): ReasoningEffortExtended | undefined {
		const selected = this.options.reasoningEffort ?? model.info.reasoningEffort
		return selected && selected !== "disable" ? selected : undefined
	}

	private getPromptCacheRetention(model: OpenAiNativeModel): "24h" | undefined {
		if (!model.info.supportsPromptCache) return undefined
		if (model.info.promptCacheRetention === "24h") {
			return "24h"
		}
		return undefined
	}

	override getModel() {
		const modelId = this.options.apiModelId

		let id =
			modelId && modelId in openAiNativeModels ? (modelId as OpenAiNativeModelId) : openAiNativeDefaultModelId

		const info: ModelInfo = openAiNativeModels[id]

		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: OPENAI_NATIVE_DEFAULT_TEMPERATURE,
		})

		return { id: id.startsWith("o3-mini") ? "o3-mini" : id, info, ...params, verbosity: params.verbosity }
	}

	/* ─── State accessors ─────────────────────────────────────── */

	getEncryptedContent(): { encrypted_content: string; id?: string } | undefined {
		const reasoningItem = this.streamCtx.lastResponseOutput?.find(
			(item) => item.type === "reasoning" && item.encrypted_content,
		)
		if (!reasoningItem?.encrypted_content) return undefined
		return {
			encrypted_content: reasoningItem.encrypted_content as string,
			...(reasoningItem.id ? { id: reasoningItem.id as string } : {}),
		}
	}

	getResponseId(): string | undefined {
		return this.streamCtx.lastResponseId
	}

	/* ─── Single completion ───────────────────────────────────── */

	async completePrompt(prompt: string): Promise<string> {
		return executeCompletePrompt(this.client, this.options, this.providerName, prompt, {
			getModel: () => this.getModel(),
			getReasoningEffort: (model) => this.getReasoningEffort(model),
			getPromptCacheRetention: (model) => this.getPromptCacheRetention(model),
		})
	}
}

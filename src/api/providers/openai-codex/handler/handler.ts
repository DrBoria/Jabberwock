import { v7 as uuidv7 } from "uuid"
import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { openAiCodexOAuthManager } from "@integrations/openai-codex/oauth"

import type { ApiStream } from "@api/transform/stream"

import { BaseProvider } from "@api/providers/base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "@api/index"
import type { OpenAiCodexModel, ResponsesRequestBody } from "@api/providers/openai-codex/types"
import { CODEX_API_BASE_URL, resetStreamState } from "@api/providers/openai-codex/types"
import { buildCodexHeaders, throwAuthError } from "@api/providers/openai-codex/utils"
import { formatFullConversation } from "@api/providers/openai-codex/format"
import { handleStreamResponse, processEvent } from "@api/providers/openai-codex/stream"
import { createProviderError, buildStatusCodeErrorText, parseErrorResponse } from "@api/providers/openai-codex/error"
import { normalizeUsage } from "@api/providers/openai-codex/usage"
import { executeCompletePrompt, handleCompletePromptError } from "./complete"
import { buildRequestBody, getModel as getResolvedModel, getReasoningEffort } from "./helpers"

type ApiHandlerOptions = import("@shared/api").ApiHandlerOptions

export class OpenAiCodexHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private readonly providerName = "OpenAI Codex"
	private client?: OpenAI
	private lastResponseOutput: Record<string, unknown>[] | undefined
	private lastResponseId: string | undefined
	private abortController?: AbortController
	private readonly sessionId: string

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		this.sessionId = uuidv7()
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		yield* this.handleResponsesApiMessage(this.getModel(), systemPrompt, messages, metadata)
	}

	private async *handleResponsesApiMessage(
		model: OpenAiCodexModel,
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		this.lastResponseOutput = undefined
		this.lastResponseId = undefined

		let accessToken = await openAiCodexOAuthManager.getAccessToken()
		if (!accessToken) throwAuthError()

		const formattedInput = formatFullConversation(systemPrompt, messages)
		const reasoningEffort = getReasoningEffort(model, this.options)
		const requestBody = buildRequestBody(model, formattedInput, systemPrompt, reasoningEffort, metadata)

		for (let attempt = 0; attempt < 2; attempt++) {
			try {
				yield* this.executeRequest(requestBody, model, accessToken, metadata?.taskId)
				return
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error)
				if (attempt === 0 && /unauthorized|invalid token|not authenticated|authentication|401/i.test(msg)) {
					const refreshed = await openAiCodexOAuthManager.forceRefreshAccessToken()
					if (!refreshed) throwAuthError()
					accessToken = refreshed
					continue
				}
				throw error
			}
		}
	}

	private async *executeRequest(
		requestBody: ResponsesRequestBody,
		model: OpenAiCodexModel,
		accessToken: string,
		taskId?: string,
	): ApiStream {
		this.abortController = new AbortController()
		try {
			const sdkIter = this.tryExecuteWithSdk(requestBody, model, accessToken, taskId)
			let yieldedAny = false
			for await (const chunk of sdkIter) {
				yieldedAny = true
				yield chunk
			}
			if (!yieldedAny) yield* this.makeCodexRequest(requestBody, model, accessToken, taskId)
		} finally {
			this.abortController = undefined
		}
	}

	private async *tryExecuteWithSdk(
		requestBody: ResponsesRequestBody,
		model: OpenAiCodexModel,
		accessToken: string,
		taskId?: string,
	): ApiStream {
		try {
			const accountId = await openAiCodexOAuthManager.getAccountId()
			const codexHeaders = buildCodexHeaders(taskId, this.sessionId, accountId ?? undefined)
			const client =
				this.client ??
				new OpenAI({
					apiKey: accessToken,
					baseURL: CODEX_API_BASE_URL,
					defaultHeaders: codexHeaders,
				})
			const stream = (await (
				client as { responses: { create: (...args: unknown[]) => unknown } }
			).responses.create(requestBody, {
				signal: this.abortController?.signal,
				headers: codexHeaders,
			})) as AsyncIterable<unknown>

			if (typeof (stream as AsyncIterable<unknown>)?.[Symbol.asyncIterator] !== "function") return

			const state = resetStreamState()
			for await (const event of stream) {
				if (this.abortController?.signal.aborted) break
				yield* processEvent(event as Record<string, unknown>, model, state, {
					normalizeUsage: (u: unknown, m: unknown) =>
						normalizeUsage(u as Record<string, unknown>, m as OpenAiCodexModel),
				})
			}
		} catch {
			// SDK failed, fallback to raw fetch
		}
	}

	private async *makeCodexRequest(
		requestBody: ResponsesRequestBody,
		model: OpenAiCodexModel,
		accessToken: string,
		taskId?: string,
	): ApiStream {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			Authorization: `Bearer ${accessToken}`,
			...buildCodexHeaders(taskId, this.sessionId, (await openAiCodexOAuthManager.getAccountId()) ?? undefined),
		}
		try {
			const response = await fetch(`${CODEX_API_BASE_URL}/responses`, {
				method: "POST",
				headers,
				body: JSON.stringify(requestBody),
				signal: this.abortController?.signal,
			})
			if (!response.ok) {
				const errorText = await response.text()
				const details = parseErrorResponse(errorText)
				throw new Error(buildStatusCodeErrorText(response.status) + (details ? ` - ${details}` : ""))
			}
			if (!response.body) throw new Error("No response body from Codex API")
			const state = resetStreamState()
			yield* handleStreamResponse(
				response.body,
				model,
				state,
				{ normalizeUsage: (u, m) => normalizeUsage(u, m) },
				this.abortController,
			)
		} catch (error) {
			throw createProviderError(error, model, this.providerName, "createMessage")
		}
	}

	override getModel() {
		return getResolvedModel(this.options)
	}

	getEncryptedContent(): { encrypted_content: string; id?: string } | undefined {
		if (!this.lastResponseOutput) return undefined
		const item = this.lastResponseOutput.find((i) => i.type === "reasoning" && i.encrypted_content)
		if (!item?.encrypted_content) return undefined
		return { encrypted_content: item.encrypted_content as string, ...(item.id ? { id: item.id as string } : {}) }
	}

	getResponseId(): string | undefined {
		return this.lastResponseId
	}

	async completePrompt(prompt: string): Promise<string> {
		this.abortController = new AbortController()
		try {
			return await executeCompletePrompt(
				prompt,
				() => this.getModel(),
				(m) => getReasoningEffort(m, this.options),
				() => openAiCodexOAuthManager.getAccessToken().then((t) => t ?? undefined),
				() => openAiCodexOAuthManager.getAccountId().then((t) => t ?? undefined),
				this.sessionId,
				this.abortController.signal,
			)
		} catch (error) {
			return handleCompletePromptError(error, this.providerName, () => this.getModel())
		} finally {
			this.abortController = undefined
		}
	}
}

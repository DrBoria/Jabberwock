import * as os from "os"
import { v7 as uuidv7 } from "uuid"
import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import {
	type ModelInfo,
	openAiCodexDefaultModelId,
	OpenAiCodexModelId,
	openAiCodexModels,
	type ReasoningEffort,
	type ReasoningEffortExtended,
	ApiProviderError,
} from "@jabberwock/types"
import { TelemetryService, getTelemetryService, hasTelemetryService } from "@jabberwock/telemetry"

import { Package } from "../../shared/package"
import type { ApiHandlerOptions } from "../../shared/api"

import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { isMcpTool } from "../../utils/mcp-name"
import { sanitizeOpenAiCallId } from "../../utils/tool-id"
import { openAiCodexOAuthManager } from "../../integrations/openai-codex/oauth"
import { t } from "../../i18n"

export type OpenAiCodexModel = ReturnType<OpenAiCodexHandler["getModel"]>

/**
 * OpenAI Codex base URL for API requests
 * Per the implementation guide: requests are routed to chatgpt.com/backend-api/codex
 */
const CODEX_API_BASE_URL = "https://chatgpt.com/backend-api/codex"

/**
 * OpenAiCodexHandler - Uses OpenAI Responses API with OAuth authentication
 *
 * Key differences from OpenAiNativeHandler:
 * - Uses OAuth Bearer tokens instead of API keys
 * - Routes requests to Codex backend (chatgpt.com/backend-api/codex)
 * - Subscription-based pricing (no per-token costs)
 * - Limited model subset
 * - Custom headers for Codex backend
 */
interface ResponsesRequestBody {
	model: string
	input: Array<{ role: "user" | "assistant"; content: Record<string, unknown>[] } | { type: string; content: string }>
	stream: boolean
	reasoning?: { effort?: ReasoningEffortExtended; summary?: "auto" }
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

export class OpenAiCodexHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private readonly providerName = "OpenAI Codex"
	private client?: OpenAI
	// Complete response output array
	private lastResponseOutput: Record<string, unknown>[] | undefined
	// Last top-level response id
	private lastResponseId: string | undefined
	// Abort controller for cancelling ongoing requests
	private abortController?: AbortController
	// Session ID for the Codex API (persists for the lifetime of the handler)
	private readonly sessionId: string
	/**
	 * Some Codex/Responses streams emit tool-call argument deltas without stable call id/name.
	 * Track the last observed tool identity from output_item events so we can still
	 * emit `tool_call_partial` chunks (tool-call-only streams).
	 */
	private pendingToolCallId: string | undefined
	private pendingToolCallName: string | undefined
	// Tracks whether this response already emitted text to avoid duplicate done-event rendering.
	private sawTextOutputInCurrentResponse = false
	// Tracks whether text arrived through delta events so content_part events can be treated as fallback-only.
	private sawTextDeltaInCurrentResponse = false
	// Tracks tool call IDs emitted via streaming partial events to prevent done-event duplicates.
	private streamedToolCallIds = new Set<string>()

	// Event types handled by the shared event processor
	private readonly coreHandledEventTypes = new Set<string>([
		"response.text.delta",
		"response.output_text.delta",
		"response.text.done",
		"response.output_text.done",
		"response.content_part.added",
		"response.content_part.done",
		"response.reasoning.delta",
		"response.reasoning_text.delta",
		"response.reasoning_summary.delta",
		"response.reasoning_summary_text.delta",
		"response.refusal.delta",
		"response.output_item.added",
		"response.output_item.done",
		"response.done",
		"response.completed",
		"response.tool_call_arguments.delta",
		"response.function_call_arguments.delta",
		"response.tool_call_arguments.done",
		"response.function_call_arguments.done",
	])

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		// Generate a new session ID for standalone handler usage (fallback)
		this.sessionId = uuidv7()
	}

	private normalizeUsage(usage: Record<string, unknown>, model: OpenAiCodexModel): ApiStreamUsageChunk | undefined {
		if (!usage) return undefined

		const inputDetails = (usage.input_tokens_details ?? usage.prompt_tokens_details) as
			| Record<string, unknown>
			| undefined

		const hasCachedTokens = typeof inputDetails?.cached_tokens === "number"
		const hasCacheMissTokens = typeof inputDetails?.cache_miss_tokens === "number"
		const cachedFromDetails = hasCachedTokens ? (inputDetails.cached_tokens as number) : 0
		const missFromDetails = hasCacheMissTokens ? (inputDetails.cache_miss_tokens as number) : 0

		let totalInputTokens: number = (usage.input_tokens ?? usage.prompt_tokens ?? 0) as number
		if (totalInputTokens === 0 && inputDetails && (cachedFromDetails > 0 || missFromDetails > 0)) {
			totalInputTokens = cachedFromDetails + missFromDetails
		}

		const totalOutputTokens: number = (usage.output_tokens ?? usage.completion_tokens ?? 0) as number
		const cacheWriteTokens: number = (usage.cache_creation_input_tokens ?? usage.cache_write_tokens ?? 0) as number
		const cacheReadTokens: number = (usage.cache_read_input_tokens ??
			usage.cache_read_tokens ??
			usage.cached_tokens ??
			cachedFromDetails ??
			0) as number

		const outputTokensDetails = usage.output_tokens_details as Record<string, unknown> | undefined
		const reasoningTokens =
			typeof outputTokensDetails?.reasoning_tokens === "number"
				? (outputTokensDetails.reasoning_tokens as number)
				: undefined

		// Subscription-based: no per-token costs
		const out: ApiStreamUsageChunk = {
			type: "usage",
			inputTokens: totalInputTokens,
			outputTokens: totalOutputTokens,
			cacheWriteTokens,
			cacheReadTokens,
			...(typeof reasoningTokens === "number" ? { reasoningTokens } : {}),
			totalCost: 0, // Subscription-based pricing
		}
		return out
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const model = this.getModel()
		yield* this.handleResponsesApiMessage(model, systemPrompt, messages, metadata)
	}

	private async *handleResponsesApiMessage(
		model: OpenAiCodexModel,
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		// Reset state for this request
		this.lastResponseOutput = undefined
		this.lastResponseId = undefined
		this.pendingToolCallId = undefined
		this.pendingToolCallName = undefined
		this.sawTextOutputInCurrentResponse = false
		this.sawTextDeltaInCurrentResponse = false
		this.streamedToolCallIds.clear()

		// Get access token from OAuth manager
		let accessToken = await openAiCodexOAuthManager.getAccessToken()
		if (!accessToken) {
			throw new Error(
				t("common:errors.openAiCodex.notAuthenticated", {
					defaultValue:
						"Not authenticated with OpenAI Codex. Please sign in using the OpenAI Codex OAuth flow.",
				}),
			)
		}

		// Resolve reasoning effort
		const reasoningEffort = this.getReasoningEffort(model)

		// Format conversation
		const formattedInput = this.formatFullConversation(systemPrompt, messages)

		// Build request body
		// Per the implementation guide: Codex backend may reject some parameters
		// Notably: max_output_tokens and prompt_cache_retention may be rejected
		const requestBody = this.buildRequestBody(model, formattedInput, systemPrompt, reasoningEffort, metadata)

		// Make the request with retry on auth failure
		for (let attempt = 0; attempt < 2; attempt++) {
			try {
				yield* this.executeRequest(requestBody, model, accessToken, metadata?.taskId)
				return
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error)
				const isAuthFailure = /unauthorized|invalid token|not authenticated|authentication|401/i.test(message)

				if (attempt === 0 && isAuthFailure) {
					// Force refresh the token for retry
					const refreshed = await openAiCodexOAuthManager.forceRefreshAccessToken()
					if (!refreshed) {
						throw new Error(
							t("common:errors.openAiCodex.notAuthenticated", {
								defaultValue:
									"Not authenticated with OpenAI Codex. Please sign in using the OpenAI Codex OAuth flow.",
							}),
						)
					}
					accessToken = refreshed
					continue
				}
				throw error
			}
		}
	}

	private buildRequestBody(
		model: OpenAiCodexModel,
		formattedInput: ResponsesRequestBody["input"],
		systemPrompt: string,
		reasoningEffort: ReasoningEffortExtended | undefined,
		metadata?: ApiHandlerCreateMessageMetadata,
	): ResponsesRequestBody {
		const ensureAllRequired = (schema: Record<string, unknown>): Record<string, unknown> => {
			if (!schema || typeof schema !== "object" || schema.type !== "object") {
				return schema
			}

			const result = { ...schema }
			if (result.additionalProperties !== false) {
				result.additionalProperties = false
			}

			if (result.properties) {
				const allKeys = Object.keys(result.properties)
				result.required = allKeys

				const newProps: Record<string, unknown> = { ...result.properties }
				for (const key of allKeys) {
					const prop = newProps[key] as Record<string, unknown> | undefined
					if (prop?.type === "object") {
						newProps[key] = ensureAllRequired(prop)
					} else if (
						prop?.type === "array" &&
						(prop.items as Record<string, unknown> | undefined)?.type === "object"
					) {
						newProps[key] = {
							...prop,
							items: ensureAllRequired(prop.items as Record<string, unknown>),
						}
					}
				}
				result.properties = newProps
			}

			return result
		}

		const ensureAdditionalPropertiesFalse = (schema: Record<string, unknown>): Record<string, unknown> => {
			if (!schema || typeof schema !== "object" || schema.type !== "object") {
				return schema
			}

			const result = { ...schema }
			if (result.additionalProperties !== false) {
				result.additionalProperties = false
			}

			if (result.properties) {
				const newProps: Record<string, unknown> = { ...result.properties }
				for (const key of Object.keys(result.properties)) {
					const prop = newProps[key] as Record<string, unknown> | undefined
					if (prop?.type === "object") {
						newProps[key] = ensureAdditionalPropertiesFalse(prop)
					} else if (
						prop?.type === "array" &&
						(prop.items as Record<string, unknown> | undefined)?.type === "object"
					) {
						newProps[key] = {
							...prop,
							items: ensureAdditionalPropertiesFalse(prop.items as Record<string, unknown>),
						}
					}
				}
				result.properties = newProps
			}

			return result
		}

		// Per the implementation guide: Codex backend may reject max_output_tokens
		// and prompt_cache_retention, so we omit them
		const body: ResponsesRequestBody = {
			model: model.id,
			input: formattedInput,
			stream: true,
			store: false,
			instructions: systemPrompt,
			// Only include encrypted reasoning content when reasoning effort is set
			...(reasoningEffort ? { include: ["reasoning.encrypted_content"] } : {}),
			...(reasoningEffort
				? {
						reasoning: {
							...(reasoningEffort ? { effort: reasoningEffort } : {}),
							summary: "auto" as const,
						},
					}
				: {}),
			tools: (metadata?.tools ?? [])
				.filter((tool) => tool.type === "function")
				.map((tool) => {
					const isMcp = isMcpTool(tool.function.name)
					return {
						type: "function",
						name: tool.function.name,
						description: tool.function.description,
						parameters: isMcp
							? ensureAdditionalPropertiesFalse(tool.function.parameters ?? {})
							: ensureAllRequired(tool.function.parameters ?? {}),
						strict: !isMcp,
					}
				}),
			tool_choice: metadata?.tool_choice,
			parallel_tool_calls: metadata?.parallelToolCalls ?? true,
		}

		return body
	}

	private async *executeRequest(
		requestBody: ResponsesRequestBody,
		model: OpenAiCodexModel,
		accessToken: string,
		taskId?: string,
	): ApiStream {
		// Create AbortController for cancellation
		this.abortController = new AbortController()

		try {
			// Prefer OpenAI SDK streaming (same approach as openai-native) so event handling
			// is consistent across providers.
			try {
				// Get ChatGPT account ID for organization subscriptions
				const accountId = await openAiCodexOAuthManager.getAccountId()

				// Build Codex-specific headers. Authorization is provided by the SDK apiKey.
				const codexHeaders: Record<string, string> = {
					originator: "jabberwock",
					session_id: taskId || this.sessionId,
					"User-Agent": `jabberwock/${Package.version} (${os.platform()} ${os.release()}; ${os.arch()}) node/${process.version.slice(1)}`,
					...(accountId ? { "ChatGPT-Account-Id": accountId } : {}),
				}

				// Allow tests to inject a client. If none is injected, create one for this request.
				const client =
					this.client ??
					new OpenAI({
						apiKey: accessToken,
						baseURL: CODEX_API_BASE_URL,
						defaultHeaders: codexHeaders,
					})

				const responsesClient = client as { responses: { create: (...args: unknown[]) => unknown } }
				const stream = (await responsesClient.responses.create(requestBody, {
					signal: this.abortController.signal,
					// If the SDK supports per-request overrides, ensure headers are present.
					headers: codexHeaders,
				})) as AsyncIterable<unknown>

				if (typeof (stream as AsyncIterable<unknown>)?.[Symbol.asyncIterator] !== "function") {
					throw new Error(
						"OpenAI SDK did not return an AsyncIterable for Responses API streaming. Falling back to SSE.",
					)
				}

				for await (const event of stream) {
					if (this.abortController.signal.aborted) {
						break
					}

					for await (const outChunk of this.processEvent(event as Record<string, unknown>, model)) {
						if (outChunk.type === "text") {
							this.sawTextOutputInCurrentResponse = true
						}
						yield outChunk
					}
				}
			} catch (_sdkErr) {
				// Fallback to manual SSE via fetch (Codex backend).
				yield* this.makeCodexRequest(requestBody, model, accessToken, taskId)
			}
		} finally {
			this.abortController = undefined
		}
	}

	private formatFullConversation(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
	): ResponsesRequestBody["input"] {
		const formattedInput: ResponsesRequestBody["input"] = []

		for (const message of messages) {
			// Check if this is a reasoning item
			const extendedMsg = message as Anthropic.Messages.MessageParam & { type?: string }
			if (extendedMsg.type === "reasoning") {
				formattedInput.push(extendedMsg as (typeof formattedInput)[number])
				continue
			}

			if (message.role === "user") {
				const content: Record<string, unknown>[] = []
				const toolResults: Record<string, unknown>[] = []

				if (typeof message.content === "string") {
					content.push({ type: "input_text", text: message.content })
				} else if (Array.isArray(message.content)) {
					for (const block of message.content) {
						if (block.type === "text") {
							content.push({ type: "input_text", text: block.text })
						} else if (block.type === "image") {
							const image = block as Anthropic.Messages.ImageBlockParam
							const imageUrl = `data:${image.source.media_type};base64,${image.source.data}`
							content.push({ type: "input_image", image_url: imageUrl })
						} else if (block.type === "tool_result") {
							const result =
								typeof block.content === "string"
									? block.content
									: block.content?.map((c) => (c.type === "text" ? c.text : "")).join("") || ""
							toolResults.push({
								type: "function_call_output",
								// Sanitize and truncate call_id to fit OpenAI's 64-char limit
								call_id: sanitizeOpenAiCallId(block.tool_use_id),
								output: result,
							})
						}
					}
				}

				if (content.length > 0) {
					formattedInput.push({ role: "user", content })
				}

				if (toolResults.length > 0) {
					for (const tr of toolResults) {
						formattedInput.push(tr as (typeof formattedInput)[number])
					}
				}
			} else if (message.role === "assistant") {
				const content: Record<string, unknown>[] = []
				const toolCalls: Record<string, unknown>[] = []

				if (typeof message.content === "string") {
					content.push({ type: "output_text", text: message.content })
				} else if (Array.isArray(message.content)) {
					for (const block of message.content) {
						if (block.type === "text") {
							content.push({ type: "output_text", text: block.text })
						} else if (block.type === "tool_use") {
							toolCalls.push({
								type: "function_call",
								// Sanitize and truncate call_id to fit OpenAI's 64-char limit
								call_id: sanitizeOpenAiCallId(block.id),
								name: block.name,
								arguments: JSON.stringify(block.input),
							})
						}
					}
				}

				if (content.length > 0) {
					formattedInput.push({ role: "assistant", content })
				}

				if (toolCalls.length > 0) {
					for (const tc of toolCalls) {
						formattedInput.push(tc as (typeof formattedInput)[number])
					}
				}
			}
		}

		return formattedInput
	}

	private async *makeCodexRequest(
		requestBody: ResponsesRequestBody,
		model: OpenAiCodexModel,
		accessToken: string,
		taskId?: string,
	): ApiStream {
		// Per the implementation guide: route to Codex backend with Bearer token
		const url = `${CODEX_API_BASE_URL}/responses`

		// Get ChatGPT account ID for organization subscriptions
		const accountId = await openAiCodexOAuthManager.getAccountId()

		// Build headers with required Codex-specific fields
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			Authorization: `Bearer ${accessToken}`,
			originator: "jabberwock",
			session_id: taskId || this.sessionId,
			"User-Agent": `jabberwock/${Package.version} (${os.platform()} ${os.release()}; ${os.arch()}) node/${process.version.slice(1)}`,
		}

		// Add ChatGPT-Account-Id if available (required for organization subscriptions)
		if (accountId) {
			headers["ChatGPT-Account-Id"] = accountId
		}

		try {
			const response = await fetch(url, {
				method: "POST",
				headers,
				body: JSON.stringify(requestBody),
				signal: this.abortController?.signal,
			})

			if (!response.ok) {
				const errorText = await response.text()

				let errorMessage = t("common:errors.api.apiRequestFailed", { status: response.status })
				let errorDetails = ""

				try {
					const errorJson = JSON.parse(errorText)
					if (errorJson.error?.message) {
						errorDetails = errorJson.error.message
					} else if (errorJson.message) {
						errorDetails = errorJson.message
					} else if (errorJson.detail) {
						errorDetails = errorJson.detail
					} else {
						errorDetails = errorText
					}
				} catch {
					errorDetails = errorText
				}

				switch (response.status) {
					case 400:
						errorMessage = t("common:errors.openAiCodex.invalidRequest")
						break
					case 401:
						errorMessage = t("common:errors.openAiCodex.authenticationFailed")
						break
					case 403:
						errorMessage = t("common:errors.openAiCodex.accessDenied")
						break
					case 404:
						errorMessage = t("common:errors.openAiCodex.endpointNotFound")
						break
					case 429:
						errorMessage = t("common:errors.openAiCodex.rateLimitExceeded")
						break
					case 500:
					case 502:
					case 503:
						errorMessage = t("common:errors.openAiCodex.serviceError")
						break
					default:
						errorMessage = t("common:errors.openAiCodex.genericError", { status: response.status })
				}

				if (errorDetails) {
					errorMessage += ` - ${errorDetails}`
				}

				throw new Error(errorMessage)
			}

			if (!response.body) {
				throw new Error(t("common:errors.openAiCodex.noResponseBody"))
			}

			yield* this.handleStreamResponse(response.body, model)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			const apiError = new ApiProviderError(errorMessage, this.providerName, model.id, "createMessage")
			getTelemetryService().captureException(apiError)

			if (error instanceof Error) {
				if (error.message.includes("Codex API")) {
					throw error
				}
				throw new Error(t("common:errors.openAiCodex.connectionFailed", { message: error.message }))
			}
			throw new Error(t("common:errors.openAiCodex.unexpectedConnectionError"))
		}
	}

	private async *handleStreamResponse(body: ReadableStream<Uint8Array>, model: OpenAiCodexModel): ApiStream {
		const reader = body.getReader()
		const decoder = new TextDecoder()
		let buffer = ""
		let hasContent = false

		try {
			while (true) {
				if (this.abortController?.signal.aborted) {
					break
				}

				const { done, value } = await reader.read()
				if (done) break

				buffer += decoder.decode(value, { stream: true })
				const lines = buffer.split("\n")
				buffer = lines.pop() || ""

				for (const line of lines) {
					if (line.startsWith("data: ")) {
						const data = line.slice(6).trim()
						if (data === "[DONE]") {
							continue
						}

						try {
							const parsed = JSON.parse(data)

							// Capture response metadata
							if (parsed.response?.output && Array.isArray(parsed.response.output)) {
								this.lastResponseOutput = parsed.response.output
							}
							if (parsed.response?.id) {
								this.lastResponseId = parsed.response.id as string
							}

							// Delegate standard event types
							if (parsed?.type && this.coreHandledEventTypes.has(parsed.type)) {
								// Capture tool call identity from output_item events so we can
								// emit tool_call_partial for subsequent function_call_arguments.delta events
								if (
									parsed.type === "response.output_item.added" ||
									parsed.type === "response.output_item.done"
								) {
									const item = parsed.item
									if (item && (item.type === "function_call" || item.type === "tool_call")) {
										const callId = item.call_id || item.tool_call_id || item.id
										const name = item.name || item.function?.name || item.function_name
										if (typeof callId === "string" && callId.length > 0) {
											this.pendingToolCallId = callId
											this.pendingToolCallName = typeof name === "string" ? name : undefined
										}
									}
								}

								// Some Codex streams only return tool calls (no text). Treat tool output as content.
								if (
									parsed.type === "response.function_call_arguments.delta" ||
									parsed.type === "response.tool_call_arguments.delta" ||
									parsed.type === "response.output_item.added" ||
									parsed.type === "response.output_item.done"
								) {
									hasContent = true
								}

								for await (const outChunk of this.processEvent(parsed, model)) {
									if (outChunk.type === "text" || outChunk.type === "reasoning") {
										hasContent = true
										if (outChunk.type === "text") {
											this.sawTextOutputInCurrentResponse = true
										}
									}
									yield outChunk
								}
								continue
							}

							// Handle complete response
							if (parsed.response && parsed.response.output && Array.isArray(parsed.response.output)) {
								for (const outputItem of parsed.response.output) {
									if (outputItem.type === "text" && outputItem.content) {
										for (const content of outputItem.content) {
											if (content.type === "text" && content.text) {
												hasContent = true
												this.sawTextOutputInCurrentResponse = true
												yield { type: "text", text: content.text }
											}
										}
									}
									if (outputItem.type === "reasoning" && Array.isArray(outputItem.summary)) {
										for (const summary of outputItem.summary) {
											if (summary?.type === "summary_text" && typeof summary.text === "string") {
												hasContent = true
												yield { type: "reasoning", text: summary.text }
											}
										}
									}
								}
								if (parsed.response.usage) {
									const usageData = this.normalizeUsage(parsed.response.usage, model)
									if (usageData) {
										yield usageData
									}
								}
							} else if (
								parsed.type === "response.text.delta" ||
								parsed.type === "response.output_text.delta"
							) {
								if (parsed.delta) {
									hasContent = true
									this.sawTextOutputInCurrentResponse = true
									yield { type: "text", text: parsed.delta }
								}
							} else if (
								(parsed.type === "response.text.done" || parsed.type === "response.output_text.done") &&
								!hasContent
							) {
								const doneText =
									typeof parsed.text === "string"
										? parsed.text
										: typeof parsed.output_text === "string"
											? parsed.output_text
											: typeof parsed.delta === "string"
												? parsed.delta
												: undefined
								if (doneText) {
									hasContent = true
									this.sawTextOutputInCurrentResponse = true
									yield { type: "text", text: doneText }
								}
							} else if (
								parsed.type === "response.reasoning.delta" ||
								parsed.type === "response.reasoning_text.delta"
							) {
								if (parsed.delta) {
									hasContent = true
									yield { type: "reasoning", text: parsed.delta }
								}
							} else if (
								parsed.type === "response.reasoning_summary.delta" ||
								parsed.type === "response.reasoning_summary_text.delta"
							) {
								if (parsed.delta) {
									hasContent = true
									yield { type: "reasoning", text: parsed.delta }
								}
							} else if (parsed.type === "response.refusal.delta") {
								if (parsed.delta) {
									hasContent = true
									this.sawTextOutputInCurrentResponse = true
									yield { type: "text", text: `[Refusal] ${parsed.delta}` }
								}
							} else if (parsed.type === "response.output_item.added") {
								if (parsed.item) {
									if (parsed.item.type === "text" && parsed.item.text) {
										hasContent = true
										this.sawTextOutputInCurrentResponse = true
										yield { type: "text", text: parsed.item.text }
									} else if (parsed.item.type === "reasoning" && parsed.item.text) {
										hasContent = true
										yield { type: "reasoning", text: parsed.item.text }
									} else if (parsed.item.type === "message" && parsed.item.content) {
										for (const content of parsed.item.content) {
											if (content.type === "text" && content.text) {
												hasContent = true
												this.sawTextOutputInCurrentResponse = true
												yield { type: "text", text: content.text }
											}
										}
									}
								}
							} else if (parsed.type === "response.error" || parsed.type === "error") {
								if (parsed.error || parsed.message) {
									throw new Error(
										t("common:errors.openAiCodex.apiError", {
											message: parsed.error?.message || parsed.message || "Unknown error",
										}),
									)
								}
							} else if (parsed.type === "response.failed") {
								if (parsed.error || parsed.message) {
									throw new Error(
										t("common:errors.openAiCodex.responseFailed", {
											message: parsed.error?.message || parsed.message || "Unknown failure",
										}),
									)
								}
							} else if (parsed.type === "response.completed" || parsed.type === "response.done") {
								if (parsed.response?.output && Array.isArray(parsed.response.output)) {
									this.lastResponseOutput = parsed.response.output
								}
								if (parsed.response?.id) {
									this.lastResponseId = parsed.response.id as string
								}

								if (
									!hasContent &&
									parsed.response &&
									parsed.response.output &&
									Array.isArray(parsed.response.output)
								) {
									for (const outputItem of parsed.response.output) {
										if (outputItem.type === "message" && outputItem.content) {
											for (const content of outputItem.content) {
												if (content.type === "output_text" && content.text) {
													hasContent = true
													this.sawTextOutputInCurrentResponse = true
													yield { type: "text", text: content.text }
												}
											}
										}
										if (outputItem.type === "reasoning" && Array.isArray(outputItem.summary)) {
											for (const summary of outputItem.summary) {
												if (
													summary?.type === "summary_text" &&
													typeof summary.text === "string"
												) {
													hasContent = true
													yield { type: "reasoning", text: summary.text }
												}
											}
										}
									}
								}
							} else if (parsed.choices?.[0]?.delta?.content) {
								hasContent = true
								this.sawTextOutputInCurrentResponse = true
								yield { type: "text", text: parsed.choices[0].delta.content }
							} else if (
								parsed.item &&
								typeof parsed.item.text === "string" &&
								parsed.item.text.length > 0
							) {
								hasContent = true
								this.sawTextOutputInCurrentResponse = true
								yield { type: "text", text: parsed.item.text }
							} else if (parsed.usage) {
								const usageData = this.normalizeUsage(parsed.usage, model)
								if (usageData) {
									yield usageData
								}
							}
						} catch (e) {
							if (!(e instanceof SyntaxError)) {
								throw e
							}
						}
					} else if (line.trim() && !line.startsWith(":")) {
						try {
							const parsed = JSON.parse(line)
							if (parsed.content || parsed.text || parsed.message) {
								hasContent = true
								this.sawTextOutputInCurrentResponse = true
								yield { type: "text", text: parsed.content || parsed.text || parsed.message }
							}
						} catch {
							// Not JSON, ignore
						}
					}
				}
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			const apiError = new ApiProviderError(errorMessage, this.providerName, model.id, "createMessage")
			getTelemetryService().captureException(apiError)

			if (error instanceof Error) {
				throw new Error(t("common:errors.openAiCodex.streamProcessingError", { message: error.message }))
			}
			throw new Error(t("common:errors.openAiCodex.unexpectedStreamError"))
		} finally {
			reader.releaseLock()
		}
	}

	private async *processEvent(event: Record<string, unknown>, model: OpenAiCodexModel): ApiStream {
		const evResponse = event.response as { output?: unknown[]; id?: string } | undefined
		if (evResponse?.output && Array.isArray(evResponse.output)) {
			this.lastResponseOutput = evResponse.output as Record<string, unknown>[]
		}
		if (evResponse?.id) {
			this.lastResponseId = evResponse.id as string
		}

		const eventType = event.type as string | undefined

		// Handle text deltas
		if (eventType === "response.text.delta" || eventType === "response.output_text.delta") {
			const delta = event.delta as string | undefined
			if (delta) {
				this.sawTextDeltaInCurrentResponse = true
				this.sawTextOutputInCurrentResponse = true
				yield { type: "text", text: delta }
			}
			return
		}

		if (eventType === "response.text.done" || eventType === "response.output_text.done") {
			const doneText =
				typeof event.text === "string"
					? (event.text as string)
					: typeof event.output_text === "string"
						? (event.output_text as string)
						: typeof event.delta === "string"
							? (event.delta as string)
							: undefined
			if (!this.sawTextOutputInCurrentResponse && doneText) {
				this.sawTextOutputInCurrentResponse = true
				yield { type: "text", text: doneText }
			}
			return
		}

		if (eventType === "response.content_part.added" || eventType === "response.content_part.done") {
			const part = event.part as { type?: string; text?: string | { value?: string } } | undefined
			if (
				!this.sawTextDeltaInCurrentResponse &&
				(part?.type === "text" || part?.type === "output_text") &&
				(typeof part?.text === "string" ||
					typeof (part?.text as { value?: string } | undefined)?.value === "string")
			) {
				const partText = typeof part.text === "string" ? part.text : (part.text as { value: string }).value
				if (partText) {
					this.sawTextOutputInCurrentResponse = true
					yield { type: "text", text: partText }
				}
			}
			return
		}

		// Handle reasoning deltas
		if (
			eventType === "response.reasoning.delta" ||
			eventType === "response.reasoning_text.delta" ||
			eventType === "response.reasoning_summary.delta" ||
			eventType === "response.reasoning_summary_text.delta"
		) {
			const delta = event.delta as string | undefined
			if (delta) {
				yield { type: "reasoning", text: delta }
			}
			return
		}

		// Handle refusal deltas
		if (eventType === "response.refusal.delta") {
			const delta = event.delta as string | undefined
			if (delta) {
				this.sawTextOutputInCurrentResponse = true
				yield { type: "text", text: `[Refusal] ${delta}` }
			}
			return
		}

		// Handle tool/function call deltas
		if (
			eventType === "response.tool_call_arguments.delta" ||
			eventType === "response.function_call_arguments.delta"
		) {
			const callId = (event.call_id ?? event.tool_call_id ?? event.id ?? this.pendingToolCallId) as
				| string
				| undefined
			const name = (event.name ?? event.function_name ?? this.pendingToolCallName) as string | undefined
			const args = (event.delta ?? event.arguments) as string | undefined

			// Codex/Responses may stream tool-call arguments, but these delta events are not guaranteed
			// to include a stable id/name. Avoid emitting incomplete tool_call_partial chunks because
			// rawChunkProcessor requires a name to start a call.
			if (callId && callId.length > 0 && name && name.length > 0) {
				this.streamedToolCallIds.add(callId)
				yield {
					type: "tool_call_partial",
					index: (event.index ?? 0) as number,
					id: callId,
					name,
					arguments: typeof args === "string" ? args : "",
				}
			}
			return
		}

		// Handle tool/function call completion
		if (
			eventType === "response.tool_call_arguments.done" ||
			eventType === "response.function_call_arguments.done"
		) {
			return
		}

		// Handle output item events
		if (eventType === "response.output_item.added" || eventType === "response.output_item.done") {
			const item = event.item as Record<string, unknown> | undefined
			if (item) {
				// Capture tool identity so subsequent argument deltas can be attributed.
				if (item.type === "function_call" || item.type === "tool_call") {
					const callId = (item.call_id ?? item.tool_call_id ?? item.id) as string | undefined
					const fn = item.function as Record<string, unknown> | undefined
					const name = (item.name ?? fn?.name ?? item.function_name) as string | undefined
					if (typeof callId === "string" && callId.length > 0) {
						this.pendingToolCallId = callId
						this.pendingToolCallName = typeof name === "string" ? name : undefined
					}
				}

				// For "added" events, yield text/reasoning content (streaming path).
				// For "done" events, normally text was already streamed via deltas, but some models
				// only provide assistant text on done events. Emit fallback text only if none was emitted yet.
				if (event.type === "response.output_item.added") {
					const itemType = item.type as string | undefined
					if (itemType === "text" && item.text) {
						this.sawTextOutputInCurrentResponse = true
						yield { type: "text", text: item.text as string }
					} else if (itemType === "output_text" && item.text) {
						this.sawTextOutputInCurrentResponse = true
						yield { type: "text", text: item.text as string }
					} else if (itemType === "reasoning" && item.text) {
						yield { type: "reasoning", text: item.text as string }
					} else if (itemType === "message") {
						const itemContent = item.content as Record<string, unknown>[] | undefined
						if (Array.isArray(itemContent)) {
							for (const content of itemContent) {
								if (
									((content.type as string) === "text" ||
										(content.type as string) === "output_text") &&
									content.text
								) {
									this.sawTextOutputInCurrentResponse = true
									yield { type: "text", text: content.text as string }
								}
							}
						}
					}
				} else if (
					event.type === "response.output_item.done" &&
					((item.type as string) === "function_call" || (item.type as string) === "tool_call")
				) {
					const callId = (item.call_id ?? item.tool_call_id ?? item.id) as string | undefined
					const fn = item.function as Record<string, unknown> | undefined
					const name = (item.name ?? fn?.name ?? item.function_name) as string | undefined
					const argsRaw = (item.arguments ?? fn?.arguments ?? item.input) as
						| string
						| Record<string, unknown>
						| undefined
					const args =
						typeof argsRaw === "string"
							? argsRaw
							: argsRaw && typeof argsRaw === "object"
								? JSON.stringify(argsRaw)
								: ""

					// Fallback for models that only emit a complete function_call in output_item.done.
					// If we already streamed partials for this ID, skip to avoid duplicate tool execution.
					if (
						typeof callId === "string" &&
						callId.length > 0 &&
						typeof name === "string" &&
						name.length > 0 &&
						!this.streamedToolCallIds.has(callId)
					) {
						yield {
							type: "tool_call",
							id: callId,
							name,
							arguments: args,
						}
					}
				} else if (!this.sawTextOutputInCurrentResponse) {
					const itemType = item.type as string | undefined
					if ((itemType === "text" || itemType === "output_text") && item.text) {
						this.sawTextOutputInCurrentResponse = true
						yield { type: "text", text: item.text as string }
					} else if (itemType === "message") {
						const itemContent = item.content as Record<string, unknown>[] | undefined
						if (Array.isArray(itemContent)) {
							for (const content of itemContent) {
								if (
									((content.type as string) === "text" ||
										(content.type as string) === "output_text") &&
									content.text
								) {
									this.sawTextOutputInCurrentResponse = true
									yield { type: "text", text: content.text as string }
								}
							}
						}
					}
				}

				// Note: We intentionally do NOT emit tool_call from response.output_item.done
				// for function_call/tool_call items. The streaming path handles tool calls via:
				// 1. tool_call_partial events during argument deltas
				// 2. rawChunkProcessor.finalizeRawChunks() at stream end emitting tool_call_end
				// 3. rawChunkProcessor.finalizeStreamingToolCall() creating the final ToolUse
				// Emitting tool_call here would cause duplicate tool rendering.
			}
			return
		}

		// Handle completion events
		if (eventType === "response.done" || eventType === "response.completed") {
			// Some Codex variants only provide assistant text in the final completed payload.
			const response = event.response as { output?: unknown[]; usage?: Record<string, unknown> } | undefined
			if (!this.sawTextOutputInCurrentResponse && Array.isArray(response?.output)) {
				for (const outputItem of response.output as Record<string, unknown>[]) {
					const outputType = outputItem.type as string | undefined
					if ((outputType === "text" || outputType === "output_text") && outputItem.text) {
						this.sawTextOutputInCurrentResponse = true
						yield { type: "text", text: outputItem.text as string }
						continue
					}

					if (outputType === "message") {
						const outputContent = outputItem.content as Record<string, unknown>[] | undefined
						if (Array.isArray(outputContent)) {
							for (const content of outputContent) {
								if (
									((content.type as string) === "text" ||
										(content.type as string) === "output_text") &&
									content.text
								) {
									this.sawTextOutputInCurrentResponse = true
									yield { type: "text", text: content.text as string }
								}
							}
						}
					}
				}
			}

			const usage = (response?.usage ?? event.usage) as Record<string, unknown> | undefined
			const usageData = this.normalizeUsage(usage ?? ({} as Record<string, unknown>), model)
			if (usageData) {
				yield usageData
			}
			return
		}

		// Fallbacks
		const choices = event.choices as Array<{ delta?: { content?: string } }> | undefined
		if (choices?.[0]?.delta?.content) {
			this.sawTextDeltaInCurrentResponse = true
			this.sawTextOutputInCurrentResponse = true
			yield { type: "text", text: choices[0].delta.content }
			return
		}

		const eventUsage = event.usage as Record<string, unknown> | undefined
		if (eventUsage) {
			const usageData = this.normalizeUsage(eventUsage, model)
			if (usageData) {
				yield usageData
			}
		}
	}

	private getReasoningEffort(model: OpenAiCodexModel): ReasoningEffortExtended | undefined {
		const selected = this.options.reasoningEffort ?? model.info.reasoningEffort
		return selected && selected !== "disable" && selected !== "none" ? selected : undefined
	}

	override getModel() {
		const modelId = this.options.apiModelId

		let id = modelId && modelId in openAiCodexModels ? (modelId as OpenAiCodexModelId) : openAiCodexDefaultModelId

		const info: ModelInfo = openAiCodexModels[id]

		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: 0,
		})

		return { id, info, ...params }
	}

	getEncryptedContent(): { encrypted_content: string; id?: string } | undefined {
		if (!this.lastResponseOutput) return undefined

		const reasoningItem = this.lastResponseOutput.find(
			(item) => item.type === "reasoning" && item.encrypted_content,
		)

		if (!reasoningItem?.encrypted_content) return undefined

		return {
			encrypted_content: reasoningItem.encrypted_content as string,
			...(reasoningItem.id ? { id: reasoningItem.id as string } : {}),
		}
	}

	getResponseId(): string | undefined {
		return this.lastResponseId
	}

	async completePrompt(prompt: string): Promise<string> {
		this.abortController = new AbortController()

		try {
			const model = this.getModel()

			// Get access token
			const accessToken = await openAiCodexOAuthManager.getAccessToken()
			if (!accessToken) {
				throw new Error(
					t("common:errors.openAiCodex.notAuthenticated", {
						defaultValue:
							"Not authenticated with OpenAI Codex. Please sign in using the OpenAI Codex OAuth flow.",
					}),
				)
			}

			const reasoningEffort = this.getReasoningEffort(model)

			const requestBody: Record<string, unknown> = {
				model: model.id,
				input: [
					{
						role: "user",
						content: [{ type: "input_text", text: prompt }],
					},
				],
				stream: false,
				store: false,
				...(reasoningEffort ? { include: ["reasoning.encrypted_content"] } : {}),
			}

			if (reasoningEffort) {
				requestBody.reasoning = {
					effort: reasoningEffort,
					summary: "auto" as const,
				}
			}

			const url = `${CODEX_API_BASE_URL}/responses`

			// Get ChatGPT account ID for organization subscriptions
			const accountId = await openAiCodexOAuthManager.getAccountId()

			// Build headers with required Codex-specific fields
			const headers: Record<string, string> = {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`,
				originator: "jabberwock",
				session_id: this.sessionId,
				"User-Agent": `jabberwock/${Package.version} (${os.platform()} ${os.release()}; ${os.arch()}) node/${process.version.slice(1)}`,
			}

			// Add ChatGPT-Account-Id if available
			if (accountId) {
				headers["ChatGPT-Account-Id"] = accountId
			}

			const response = await fetch(url, {
				method: "POST",
				headers,
				body: JSON.stringify(requestBody),
				signal: this.abortController.signal,
			})

			if (!response.ok) {
				const errorText = await response.text()
				throw new Error(
					t("common:errors.openAiCodex.genericError", { status: response.status }) +
						(errorText ? `: ${errorText}` : ""),
				)
			}

			const responseData = await response.json()

			if (responseData?.output && Array.isArray(responseData.output)) {
				for (const outputItem of responseData.output) {
					if (outputItem.type === "message" && outputItem.content) {
						for (const content of outputItem.content) {
							if (content.type === "output_text" && content.text) {
								return content.text
							}
						}
					}
				}
			}

			if (responseData?.text) {
				return responseData.text
			}

			return ""
		} catch (error) {
			const errorModel = this.getModel()
			const errorMessage = error instanceof Error ? error.message : String(error)
			const apiError = new ApiProviderError(errorMessage, this.providerName, errorModel.id, "completePrompt")
			getTelemetryService().captureException(apiError)

			if (error instanceof Error) {
				throw new Error(t("common:errors.openAiCodex.completionError", { message: error.message }))
			}
			throw error
		} finally {
			this.abortController = undefined
		}
	}
}

import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { isRetiredProvider, type ProviderSettings, type ModelInfo } from "@jabberwock/types"

import { ApiStream } from "./transform/stream"

import {
	AnthropicHandler,
	AwsBedrockHandler,
	OpenRouterHandler,
	VertexHandler,
	AnthropicVertexHandler,
	OpenAiHandler,
	OpenAiCodexHandler,
	LmStudioHandler,
	GeminiHandler,
	OpenAiNativeHandler,
	DeepSeekHandler,
	MoonshotHandler,
	MistralHandler,
	VsCodeLmHandler,
	RequestyHandler,
	UnboundHandler,
	FakeAIHandler,
	XAIHandler,
	LiteLLMHandler,
	QwenCodeHandler,
	SambaNovaHandler,
	ZAiHandler,
	FireworksHandler,
	RooHandler,
	VercelAiGatewayHandler,
	MiniMaxHandler,
	BasetenHandler,
} from "./providers"
import { NativeOllamaHandler } from "./providers/native-ollama"

export interface SingleCompletionHandler {
	completePrompt(prompt: string): Promise<string>
}

export interface ApiHandlerCreateMessageMetadata {
	/**
	 * Task ID used for tracking and provider-specific features:
	 * - Jabberwock: Sent as X-Jabberwock-Task-ID header
	 * - Requesty: Sent as trace_id
	 */
	taskId: string
	/**
	 * Current mode slug for provider-specific tracking:
	 * - Requesty: Sent in extra metadata
	 */
	mode?: string
	suppressPreviousResponseId?: boolean
	/**
	 * Controls whether the response should be stored for 30 days in OpenAI's Responses API.
	 * When true (default), responses are stored and can be referenced in future requests
	 * using the previous_response_id for efficient conversation continuity.
	 * Set to false to opt out of response storage for privacy or compliance reasons.
	 * @default true
	 */
	store?: boolean
	/**
	 * Optional array of tool definitions to pass to the model.
	 * For OpenAI-compatible providers, these are ChatCompletionTool definitions.
	 */
	tools?: OpenAI.Chat.ChatCompletionTool[]
	/**
	 * Controls which (if any) tool is called by the model.
	 * Can be "none", "auto", "required", or a specific tool choice.
	 */
	tool_choice?: OpenAI.Chat.ChatCompletionCreateParams["tool_choice"]
	/**
	 * Controls whether the model can return multiple tool calls in a single response.
	 * When true (default), parallel tool calls are enabled (OpenAI's parallel_tool_calls=true).
	 * When false, only one tool call is returned per response.
	 */
	parallelToolCalls?: boolean
	/**
	 * Optional array of tool names that the model is allowed to call.
	 * When provided, all tool definitions are passed to the model (so it can reference
	 * historical tool calls), but only the specified tools can actually be invoked.
	 * This is used when switching modes to prevent model errors from missing tool
	 * definitions while still restricting callable tools to the current mode's permissions.
	 * Only applies to providers that support function calling restrictions (e.g., Gemini).
	 */
	allowedFunctionNames?: string[]
	/**
	 * Optional model ID override for this specific request.
	 * Used by ThinkTool to route reasoning tasks to specialized models.
	 */
	modelId?: string
}

export interface ApiHandler {
	createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream

	getModel(): { id: string; info: ModelInfo }

	/**
	 * Counts tokens for content blocks
	 * All providers extend BaseProvider which provides a default tiktoken implementation,
	 * but they can override this to use their native token counting endpoints
	 *
	 * @param content The content to count tokens for
	 * @returns A promise resolving to the token count
	 */
	countTokens(content: Array<Anthropic.Messages.ContentBlockParam>): Promise<number>
}

type ProviderConstructor = new (options: Record<string, unknown>) => ApiHandler

const providerHandlerMap: Record<string, ProviderConstructor | ((options: Record<string, unknown>) => ApiHandler)> = {
	anthropic: AnthropicHandler,
	openrouter: OpenRouterHandler,
	bedrock: AwsBedrockHandler,
	vertex: (options) => {
		const opts = options as ProviderSettings
		return opts.apiModelId?.startsWith("claude") ? new AnthropicVertexHandler(options) : new VertexHandler(options)
	},
	openai: OpenAiHandler,
	ollama: NativeOllamaHandler,
	lmstudio: LmStudioHandler,
	gemini: GeminiHandler,
	"openai-codex": OpenAiCodexHandler,
	"openai-native": OpenAiNativeHandler,
	deepseek: DeepSeekHandler,
	"qwen-code": QwenCodeHandler,
	moonshot: MoonshotHandler,
	"vscode-lm": VsCodeLmHandler,
	mistral: MistralHandler,
	requesty: RequestyHandler,
	unbound: UnboundHandler,
	"fake-ai": FakeAIHandler,
	xai: XAIHandler,
	litellm: LiteLLMHandler,
	sambanova: SambaNovaHandler,
	zai: ZAiHandler,
	fireworks: FireworksHandler,
	jabberwock: RooHandler,
	"vercel-ai-gateway": VercelAiGatewayHandler,
	minimax: MiniMaxHandler,
	baseten: BasetenHandler,
}

export function buildApiHandler(configuration: ProviderSettings): ApiHandler {
	const { apiProvider, ...options } = configuration

	if (apiProvider && isRetiredProvider(apiProvider)) {
		throw new Error(
			`Sorry, this provider is no longer supported. We saw very few Jabberwock users actually using it and we need to reduce the surface area of our codebase so we can keep shipping fast and serving our community well in this space. It was a really hard decision but it lets us focus on what matters most to you. It sucks, we know.\n\nPlease select a different provider in your API profile settings.`,
		)
	}

	const handlerFactory = providerHandlerMap[apiProvider ?? ""]
	if (handlerFactory) {
		if (handlerFactory.prototype instanceof Object) {
			const Ctor = handlerFactory as ProviderConstructor
			return new Ctor(options)
		}
		return (handlerFactory as (options: Record<string, unknown>) => ApiHandler)(options)
	}

	return new AnthropicHandler(options)
}

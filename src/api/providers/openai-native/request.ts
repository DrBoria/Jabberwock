import type { ReasoningEffortExtended, ServiceTier, VerbosityLevel } from "@jabberwock/types"
import type { ApiHandlerCreateMessageMetadata } from "@api/index"
import type { OpenAiNativeModel, ResponsesRequestBody } from "./types"
import { processSchemaProp } from "./types"
import { isMcpTool } from "@utils/mcp"

export type { ReasoningEffortExtended, ServiceTier, VerbosityLevel }

export function buildReasoningSection(
	reasoningEffort: ReasoningEffortExtended | undefined,
	enableSummary?: boolean,
): Record<string, unknown> {
	if (!reasoningEffort) return {}
	return {
		reasoning: {
			effort: reasoningEffort,
			...(enableSummary ? { summary: "auto" as const } : {}),
		},
	}
}

export function buildTierSection(
	requestedTier: ServiceTier | undefined,
	allowedTierNames: Set<string>,
): Record<string, unknown> {
	if (!requestedTier || (requestedTier !== "default" && !allowedTierNames.has(requestedTier))) {
		return {}
	}
	return { service_tier: requestedTier }
}

export function buildRequestTools(
	metadata: ApiHandlerCreateMessageMetadata | undefined,
	ensureStrict: (params: Record<string, unknown>) => Record<string, unknown>,
	ensureMcp: (params: Record<string, unknown>) => Record<string, unknown>,
): ResponsesRequestBody["tools"] {
	if (!metadata?.tools?.length) return undefined
	return metadata.tools
		.map((tool) => {
			const functionDef =
				"function" in tool
					? (
							tool as {
								function: { name: string; description?: string; parameters?: Record<string, unknown> }
							}
						).function
					: undefined
			if (!functionDef) return undefined
			const isMcp = isMcpTool(functionDef.name)
			return {
				type: "function" as const,
				name: functionDef.name,
				description: functionDef.description,
				parameters: isMcp
					? ensureMcp(functionDef.parameters ?? {})
					: ensureStrict(functionDef.parameters ?? {}),
				strict: !isMcp,
			}
		})
		.filter((t): t is NonNullable<typeof t> => t !== undefined)
}

export function ensureStrictParameters(
	parameters: Record<string, unknown>,
	transform: (params: Record<string, unknown>) => Record<string, unknown>,
): Record<string, unknown> {
	if (!parameters || typeof parameters !== "object" || parameters.type !== "object") {
		return parameters
	}
	const result = { ...parameters }
	if (result.additionalProperties !== false) {
		result.additionalProperties = false
	}
	if (!result.properties) return result
	const propsMap = result.properties as Record<string, unknown>
	const allKeys = Object.keys(propsMap)
	result.required = allKeys
	const newProps: Record<string, unknown> = { ...propsMap }
	for (const key of allKeys) {
		newProps[key] = processSchemaProp(newProps[key] as Record<string, unknown> | undefined, transform)
	}
	result.properties = newProps
	return result
}

export function ensureMcpParameters(
	parameters: Record<string, unknown>,
	transform: (params: Record<string, unknown>) => Record<string, unknown>,
): Record<string, unknown> {
	if (!parameters || typeof parameters !== "object" || parameters.type !== "object") {
		return parameters
	}
	const result = { ...parameters }
	if (result.additionalProperties !== false) {
		result.additionalProperties = false
	}
	if (!result.properties) return result
	const propsMap = result.properties as Record<string, unknown>
	const newProps: Record<string, unknown> = { ...propsMap }
	for (const key of Object.keys(propsMap)) {
		newProps[key] = processSchemaProp(newProps[key] as Record<string, unknown> | undefined, transform)
	}
	result.properties = newProps
	return result
}

export function buildNativeResponseBody(
	model: OpenAiNativeModel,
	formattedInput: ResponsesRequestBody["input"],
	systemPrompt: string,
	verbosity: VerbosityLevel | undefined,
	reasoningSection: Record<string, unknown>,
	tierSection: Record<string, unknown>,
	mappedTools: ResponsesRequestBody["tools"],
	promptCacheRetention: "24h" | undefined,
	temperature: number,
	toolChoice?: string,
	parallelToolCalls?: boolean,
): ResponsesRequestBody {
	const body: ResponsesRequestBody = {
		model: model.id,
		input: formattedInput,
		stream: true,
		store: false,
		instructions: systemPrompt,
		...reasoningSection,
		...(model.info.supportsTemperature !== false && {
			temperature,
		}),
		...(model.maxTokens ? { max_output_tokens: model.maxTokens } : {}),
		...tierSection,
		...(promptCacheRetention ? { prompt_cache_retention: promptCacheRetention } : {}),
		tools: mappedTools,
		tool_choice: toolChoice,
		parallel_tool_calls: parallelToolCalls,
	}

	if (model.info.supportsVerbosity === true) {
		body.text = { verbosity: (verbosity || "medium") as VerbosityLevel }
	}

	return body
}

export function buildRequestBody(
	model: OpenAiNativeModel,
	formattedInput: ResponsesRequestBody["input"],
	systemPrompt: string,
	verbosity: VerbosityLevel | undefined,
	reasoningEffort: ReasoningEffortExtended | undefined,
	metadata: ApiHandlerCreateMessageMetadata | undefined,
	options: {
		openAiNativeServiceTier?: string
		enableResponsesReasoningSummary?: boolean
		modelTemperature?: number
	},
	getPromptCacheRetention: (model: OpenAiNativeModel) => "24h" | undefined,
): ResponsesRequestBody {
	const promptCacheRetention = getPromptCacheRetention(model)
	const strictTransform: (params: Record<string, unknown>) => Record<string, unknown> = (p) =>
		ensureStrictParameters(p, strictTransform)
	const mcpTransform: (params: Record<string, unknown>) => Record<string, unknown> = (p) =>
		ensureMcpParameters(p, mcpTransform)
	const mappedTools = buildRequestTools(metadata, strictTransform, mcpTransform)
	const reasoningSection = buildReasoningSection(reasoningEffort, options.enableResponsesReasoningSummary)
	const allowedTierNames = new Set(
		model.info.tiers?.map((t) => t.name).filter((n): n is ServiceTier => n !== undefined) || [],
	)
	const tierSection = buildTierSection(options.openAiNativeServiceTier as ServiceTier | undefined, allowedTierNames)
	const toolChoice = metadata?.tool_choice as string | undefined
	const parallelToolCalls = metadata?.parallelToolCalls ?? true
	const temperature = options.modelTemperature ?? 0.7

	return buildNativeResponseBody(
		model,
		formattedInput,
		systemPrompt,
		verbosity,
		reasoningSection,
		tierSection,
		mappedTools,
		promptCacheRetention,
		temperature,
		toolChoice,
		parallelToolCalls,
	)
}

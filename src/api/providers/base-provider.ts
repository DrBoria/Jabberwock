import { Anthropic } from "@anthropic-ai/sdk"

import type { ModelInfo } from "@jabberwock/types"

import type OpenAI from "openai"

import type { ApiHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { ApiStream } from "../transform/stream"
import { countTokens } from "../../utils/countTokens"
import { isMcpTool } from "../../utils/mcp-name"

/**
 * Base class for API providers that implements common functionality.
 */
export abstract class BaseProvider implements ApiHandler {
	abstract createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream

	abstract getModel(modelIdOverride?: string): { id: string; info: ModelInfo }

	/**
	 * Converts an array of tools to be compatible with OpenAI's strict mode.
	 * Filters for function tools, applies schema conversion to their parameters,
	 * and ensures all tools have consistent strict: true values.
	 */
	protected convertToolsForOpenAI(
		tools: OpenAI.Chat.ChatCompletionTool[] | undefined,
	): OpenAI.Chat.ChatCompletionTool[] | undefined {
		if (!tools) {
			return undefined
		}

		return tools.map((tool) => {
			if (tool.type !== "function") {
				return tool
			}

			// MCP tools use the 'mcp--' prefix - disable strict mode for them
			// to preserve optional parameters from the MCP server schema
			const isMcp = isMcpTool(tool.function.name)

			return {
				...tool,
				function: {
					...tool.function,
					strict: !isMcp,
					parameters: isMcp
						? tool.function.parameters
						: this.convertToolSchemaForOpenAI(tool.function.parameters ?? {}),
				},
			}
		})
	}

	/**
	 * Converts tool schemas to be compatible with OpenAI's strict mode by:
	 * - Ensuring all properties are in the required array (strict mode requirement)
	 * - Converting nullable types (["type", "null"]) to non-nullable ("type")
	 * - Adding additionalProperties: false to all object schemas (required by OpenAI Responses API)
	 * - Recursively processing nested objects and arrays
	 *
	 * This matches the behavior of ensureAllRequired in openai-native.ts
	 */
	/**
	 * Internal type representing a JSON Schema node with known structural properties.
	 * Index signature allows passing unknown extra keys through.
	 */
	private static jsonSchemaForOpenAI(schema: Record<string, unknown>): Record<string, unknown> {
		if (!schema || typeof schema !== "object") {
			return schema
		}
		const typeVal = schema["type"]
		if (typeVal !== "object") {
			return schema
		}

		const result: Record<string, unknown> = { ...schema }

		// OpenAI Responses API requires additionalProperties: false on all object schemas
		// Only add if not already set to false (to avoid unnecessary mutations)
		if (result["additionalProperties"] !== false) {
			result["additionalProperties"] = false
		}

		const properties = result["properties"]
		if (properties && typeof properties === "object" && !Array.isArray(properties)) {
			const allKeys = Object.keys(properties)
			// OpenAI strict mode requires ALL properties to be in required array
			result["required"] = allKeys

			// Recursively process nested objects and convert nullable types
			const newProps: Record<string, unknown> = { ...(properties as Record<string, unknown>) }
			for (const key of allKeys) {
				const prop = newProps[key]
				if (!prop || typeof prop !== "object") {
					continue
				}
				const propObj = prop as Record<string, unknown>

				// Handle nullable types by removing null
				const propType = propObj["type"]
				if (Array.isArray(propType) && propType.includes("null")) {
					const nonNullTypes = propType.filter((t: string) => t !== "null")
					propObj["type"] = nonNullTypes.length === 1 ? nonNullTypes[0] : nonNullTypes
				}

				// Recursively process nested objects
				if (propObj["type"] === "object") {
					newProps[key] = this.jsonSchemaForOpenAI(propObj)
				} else if (propObj["type"] === "array") {
					const items = propObj["items"]
					if (items && typeof items === "object" && (items as Record<string, unknown>)["type"] === "object") {
						newProps[key] = {
							...propObj,
							items: this.jsonSchemaForOpenAI(items as Record<string, unknown>),
						}
					}
				}
			}
			result["properties"] = newProps
		}

		return result
	}

	protected convertToolSchemaForOpenAI(schema: Record<string, unknown>): Record<string, unknown> {
		return BaseProvider.jsonSchemaForOpenAI(schema)
	}

	/**
	 * Default token counting implementation using tiktoken.
	 * Providers can override this to use their native token counting endpoints.
	 *
	 * @param content The content to count tokens for
	 * @returns A promise resolving to the token count
	 */
	async countTokens(content: Anthropic.Messages.ContentBlockParam[]): Promise<number> {
		if (content.length === 0) {
			return 0
		}

		return countTokens(content, { useWorker: true })
	}
}

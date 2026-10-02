import { Anthropic } from "@anthropic-ai/sdk"

import type OpenAI from "openai"

import type { ApiHandler } from "@api/index"
import { countTokens } from "@utils/token"
import { isMcpTool } from "@utils/mcp"

/**
 * Internal type representing a JSON Schema node with known structural properties.
 * Index signature allows passing unknown extra keys through.
 */
function handleNullableType(propObj: Record<string, unknown>): void {
	const propType = propObj["type"]
	if (Array.isArray(propType) && propType.includes("null")) {
		const nonNullTypes = propType.filter((t: string) => t !== "null")
		propObj["type"] = nonNullTypes.length === 1 ? nonNullTypes[0] : nonNullTypes
	}
}

function processProperty(key: string, newProps: Record<string, unknown>): void {
	const prop = newProps[key]
	if (!prop || typeof prop !== "object") {
		return
	}
	const propObj = prop as Record<string, unknown>

	handleNullableType(propObj)

	if (propObj["type"] === "object") {
		newProps[key] = jsonSchemaForOpenAI(propObj)
	} else if (propObj["type"] === "array") {
		const items = propObj["items"]
		if (items && typeof items === "object" && (items as Record<string, unknown>)["type"] === "object") {
			newProps[key] = {
				...propObj,
				items: jsonSchemaForOpenAI(items as Record<string, unknown>),
			}
		}
	}
}

function jsonSchemaForOpenAI(schema: Record<string, unknown>): Record<string, unknown> {
	if (!schema || typeof schema !== "object") {
		return schema
	}
	const typeVal = schema["type"]
	if (typeVal !== "object") {
		return schema
	}

	const result: Record<string, unknown> = { ...schema }

	if (result["additionalProperties"] !== false) {
		result["additionalProperties"] = false
	}

	const properties = result["properties"]
	if (properties && typeof properties === "object" && !Array.isArray(properties)) {
		const allKeys = Object.keys(properties)
		result["required"] = allKeys

		const newProps: Record<string, unknown> = { ...(properties as Record<string, unknown>) }
		for (const key of allKeys) {
			processProperty(key, newProps)
		}
		result["properties"] = newProps
	}

	return result
}

/**
 * Converts an array of tools to be compatible with OpenAI's strict mode.
 * Filters for function tools, applies schema conversion to their parameters,
 * and ensures all tools have consistent strict: true values.
 */
export function convertToolsForOpenAI(
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
		// to preserve optional parameters from "the" MCP server schema
		const isMcp = isMcpTool(tool.function.name)

		return {
			...tool,
			function: {
				...tool.function,
				strict: !isMcp,
				parameters: isMcp ? tool.function.parameters : jsonSchemaForOpenAI(tool.function.parameters ?? {}),
			},
		}
	})
}

/**
 * Base factory for API providers. Returns the shared handler methods
 * (default token counting). Concrete provider factories spread this into their
 * returned object: `{ ...createBaseProvider(), ... }`.
 *
 * Providers may override `countTokens` to use their native token counting
 * endpoints by defining their own `countTokens` after the spread.
 */
export function createBaseProvider(): Pick<ApiHandler, "countTokens"> & {
	convertToolsForOpenAI: typeof convertToolsForOpenAI
} {
	return {
		convertToolsForOpenAI,

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
		},
	}
}

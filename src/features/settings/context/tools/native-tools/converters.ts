import type OpenAI from "openai"
import type Anthropic from "@anthropic-ai/sdk"

/**
 * Converts an OpenAI ChatCompletionTool to Anthropic's Tool format.
 *
 * OpenAI format wraps the tool definition in a `function` object with `parameters`,
 * while Anthropic uses a flatter structure with `input_schema`.
 *
 * @param tool - OpenAI ChatCompletionTool to convert
 * @returns Anthropic Tool definition
 *
 * @example
 * ```typescript
 * const openAITool = {
 *   type: "function",
 *   function: {
 *     name: "get_weather",
 *     description: "Get weather",
 *     parameters: { type: "object", properties: {...} }
 *   }
 * }
 *
 * const anthropicTool = convertOpenAIToolToAnthropic(openAITool)
 * // Returns: { name: "get_weather", description: "Get weather", input_schema: {...} }
 * ```
 */
export function convertOpenAIToolToAnthropic(tool: OpenAI.Chat.ChatCompletionTool): Anthropic.Tool {
	// Handle both ChatCompletionFunctionTool and ChatCompletionCustomTool
	if (tool.type !== "function") {
		throw new Error(`Unsupported tool type: ${tool.type}`)
	}

	return {
		name: tool.function.name,
		description: tool.function.description || "",
		input_schema: tool.function.parameters as Anthropic.Tool.InputSchema,
	}
}

/**
 * Converts an array of OpenAI ChatCompletionTools to Anthropic's Tool format.
 *
 * @param tools - Array of OpenAI ChatCompletionTools to convert
 * @returns Array of Anthropic Tool definitions
 */
export function convertOpenAIToolsToAnthropic(tools: OpenAI.Chat.ChatCompletionTool[]): Anthropic.Tool[] {
	const converted = tools.map(convertOpenAIToolToAnthropic)
	return converted
}

/**
 * Converts an OpenAI tool_choice to Anthropic's tool_choice format.
 *
 * @param toolChoice - OpenAI tool_choice value
 * @param parallelToolCalls - Whether parallel tool calls are enabled
 * @returns Anthropic tool_choice or undefined
 */
export function convertOpenAIToolChoiceToAnthropic(
	toolChoice: OpenAI.Chat.ChatCompletionCreateParams["tool_choice"],
	_parallelToolCalls?: boolean,
): Anthropic.Messages.MessageCreateParams["tool_choice"] | undefined {
	if (!toolChoice) {
		return undefined
	}

	if (typeof toolChoice === "string") {
		switch (toolChoice) {
			case "none":
				return undefined
			case "auto":
				return { type: "auto" }
			case "required":
				return { type: "any" }
			default:
				return { type: "auto" }
		}
	}

	if (typeof toolChoice === "object" && "function" in toolChoice) {
		return {
			type: "tool",
			name: toolChoice.function.name,
		}
	}

	return { type: "auto" }
}

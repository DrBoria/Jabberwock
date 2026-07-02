import OpenAI from "openai"
import { Tool, ToolChoice } from "@aws-sdk/client-bedrock-runtime"
import { normalizeToolSchema } from "@utils/json-schema"

export function convertToolsForBedrock(tools: OpenAI.Chat.ChatCompletionTool[]): Tool[] {
	return tools
		.filter((tool) => tool.type === "function")
		.map(
			(tool) =>
				({
					toolSpec: {
						name: tool.function.name,
						description: tool.function.description,
						inputSchema: {
							json: normalizeToolSchema(tool.function.parameters as Record<string, unknown>),
						},
					},
				}) as Tool,
		)
}

export function convertToolChoiceForBedrock(
	toolChoice: OpenAI.Chat.ChatCompletionCreateParams["tool_choice"],
): ToolChoice | undefined {
	if (!toolChoice) {
		return { auto: {} } as ToolChoice
	}

	if (typeof toolChoice === "string") {
		switch (toolChoice) {
			case "none":
				return undefined
			case "auto":
				return { auto: {} } as ToolChoice
			case "required":
				return { any: {} } as ToolChoice
			default:
				return { auto: {} } as ToolChoice
		}
	}

	if (typeof toolChoice === "object" && "function" in toolChoice) {
		return {
			tool: {
				name: toolChoice.function.name,
			},
		} as ToolChoice
	}

	return { auto: {} } as ToolChoice
}

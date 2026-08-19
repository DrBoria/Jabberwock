import OpenAI from "openai"

import { isMcpTool } from "@utils/mcp"

import type { ResponsesRequestBody } from "@api/providers/openai-codex/types"
import { ensureAllRequired, ensureAdditionalPropertiesFalse } from "@api/providers/openai-codex/utils"

export function formatTools(tools?: OpenAI.Chat.ChatCompletionTool[]): ResponsesRequestBody["tools"] {
	if (!tools) return undefined
	return tools
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
		})
}

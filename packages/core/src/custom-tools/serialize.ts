import { z } from "zod/v4"
import type { OpenAI } from "openai"

import { type SerializedCustomToolDefinition, type CustomToolParametersSchema } from "@jabberwock/types"

interface SerializeableTool {
	name: string
	description: string
	parameters?: CustomToolParametersSchema
	source?: string
}

export function serializeCustomTool({
	name,
	description,
	parameters,
	source,
}: SerializeableTool): SerializedCustomToolDefinition {
	return {
		name,
		description,
		parameters: parameters ? z.toJSONSchema(parameters) : undefined,
		source,
	}
}

export function formatNative(tool: SerializedCustomToolDefinition): OpenAI.Chat.ChatCompletionFunctionTool {
	let params = tool.parameters

	if (params) {
		params = { ...params }
		delete params["$schema"]

		if (!params.required) {
			params.required = []
		}
	} else {
		params = { type: "object", properties: {}, required: [], additionalProperties: false }
	}

	return { type: "function", function: { ...tool, strict: true, parameters: params } }
}

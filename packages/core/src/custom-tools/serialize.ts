import {
	type SerializedCustomToolDefinition,
	type CustomToolParametersSchema,
	parametersSchema,
} from "@jabberwock/types"

import type { StoredCustomTool } from "./types.ts"

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
		parameters: parameters ? parametersSchema.toJSONSchema(parameters) : undefined,
		source,
	}
}

export function serializeCustomTools(tools: StoredCustomTool[]): SerializedCustomToolDefinition[] {
	return tools.map(serializeCustomTool)
}

import { FunctionCallingConfigMode } from "@google/genai"
import type { GenerateContentConfig } from "@google/genai"

import type { ApiHandlerCreateMessageMetadata } from "@api/index"

export function buildGeminiTools(metadata?: ApiHandlerCreateMessageMetadata): GenerateContentConfig["tools"] {
	return [
		{
			functionDeclarations: (metadata?.tools ?? []).map((tool) => {
				const fn = (tool as { function: { name: string; description?: string; parameters?: unknown } }).function
				return {
					name: fn.name,
					description: fn.description,
					parametersJsonSchema: fn.parameters,
				}
			}),
		},
	]
}

export function applyToolChoiceConfig(
	config: GenerateContentConfig,
	choice: NonNullable<ApiHandlerCreateMessageMetadata["tool_choice"]>,
): void {
	let mode: FunctionCallingConfigMode
	let allowedFunctionNames: string[] | undefined

	if (choice === "auto") {
		mode = FunctionCallingConfigMode.AUTO
	} else if (choice === "none") {
		mode = FunctionCallingConfigMode.NONE
	} else if (choice === "required") {
		mode = FunctionCallingConfigMode.ANY
	} else if (typeof choice === "object" && "function" in choice && choice.type === "function") {
		mode = FunctionCallingConfigMode.ANY
		allowedFunctionNames = [choice.function.name]
	} else {
		mode = FunctionCallingConfigMode.AUTO
	}

	config.toolConfig = {
		functionCallingConfig: {
			mode,
			...(allowedFunctionNames ? { allowedFunctionNames } : {}),
		},
	}
}

export function applyToolConfig(config: GenerateContentConfig, metadata?: ApiHandlerCreateMessageMetadata): void {
	if (metadata?.allowedFunctionNames && metadata.allowedFunctionNames.length > 0) {
		config.toolConfig = {
			functionCallingConfig: {
				mode: FunctionCallingConfigMode.ANY,
				allowedFunctionNames: metadata.allowedFunctionNames,
			},
		}
	} else if (metadata?.tool_choice) {
		applyToolChoiceConfig(config, metadata.tool_choice)
	}
}

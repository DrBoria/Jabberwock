import * as vscode from "vscode"
import OpenAI from "openai"

import { type ModelInfo, openAiModelInfoSaneDefaults } from "@jabberwock/types"

import type { ApiHandlerOptions } from "@shared/api"
import { SELECTOR_SEPARATOR, stringifyVsCodeLmModelSelector } from "@shared/vsCodeSelectorUtils"

import { normalizeToolSchema } from "@utils/json-schema"

/**
 * Converts OpenAI-format tools to VSCode Language Model tools.
 * Normalizes the JSON Schema to draft 2020-12 compliant format required by
 * GitHub Copilot's backend, converting type: ["T", "null"] to anyOf format.
 * @param tools Array of OpenAI ChatCompletionTool definitions
 * @returns Array of VSCode LanguageModelChatTool definitions
 */
export function convertToVsCodeLmTools(tools: OpenAI.Chat.ChatCompletionTool[]): vscode.LanguageModelChatTool[] {
	return tools
		.filter((tool) => tool.type === "function")
		.map((tool) => ({
			name: tool.function.name,
			description: tool.function.description || "",
			inputSchema: tool.function.parameters
				? normalizeToolSchema(tool.function.parameters as Record<string, unknown>)
				: undefined,
		}))
}

// Static blacklist of VS Code Language Model IDs that should be excluded from the model list e.g. because they will never work
const VSCODE_LM_STATIC_BLACKLIST: string[] = ["claude-3.7-sonnet", "claude-3.7-sonnet-thought"]

export async function getVsCodeLmModels() {
	try {
		const models = (await vscode.lm.selectChatModels({})) || []
		return models.filter((model) => !VSCODE_LM_STATIC_BLACKLIST.includes(model.id))
	} catch (error) {
		console.error(
			`Error fetching VS Code LM models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
		)
		return []
	}
}

/**
 * Builds model information for the VsCodeLmHandler.
 * Returns model info based on the current client state or fallback defaults.
 */
export function buildModelInfo(
	client: vscode.LanguageModelChat | null,
	options: ApiHandlerOptions,
): { id: string; info: ModelInfo } {
	if (client) {
		const requiredProps = {
			id: client.id,
			vendor: client.vendor,
			family: client.family,
			version: client.version,
			maxInputTokens: client.maxInputTokens,
		}

		for (const [prop, value] of Object.entries(requiredProps)) {
			if (!value && value !== 0) {
				console.warn(`[jabberwock] Jabberwock <Language Model API>: Client missing ${prop} property`)
			}
		}

		const modelParts = [client.vendor, client.family, client.version].filter(Boolean)
		const modelId = client.id || modelParts.join(SELECTOR_SEPARATOR)

		const modelInfo: ModelInfo = {
			maxTokens: -1,
			contextWindow:
				typeof client.maxInputTokens === "number"
					? Math.max(0, client.maxInputTokens)
					: openAiModelInfoSaneDefaults.contextWindow,
			supportsImages: false,
			supportsPromptCache: true,
			inputPrice: 0,
			outputPrice: 0,
			description: `VSCode Language Model: ${modelId}`,
		}

		return { id: modelId, info: modelInfo }
	}

	const fallbackId = options.vsCodeLmModelSelector
		? stringifyVsCodeLmModelSelector(options.vsCodeLmModelSelector)
		: "vscode-lm"

	console.debug("Jabberwock <Language Model API>: No client available, using fallback model info")

	return {
		id: fallbackId,
		info: {
			...openAiModelInfoSaneDefaults,
			description: `VSCode Language Model (Fallback): ${fallbackId}`,
		},
	}
}

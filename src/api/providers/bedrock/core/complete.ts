import type { ModelInfo, BedrockModelId, ProviderSettings } from "@jabberwock/types"
import { logger } from "@utils/logging"
import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime"
import type { Message } from "@aws-sdk/client-bedrock-runtime"
import type { BedrockInferenceConfig } from "./types"
import { convertToBedrockConverseMessages } from "./cache"
import { buildCompletePromptError, type ErrorHandlerContext } from "@api/providers/bedrock/errors"

export function buildCompletePromptPayload(
	modelConfig: { id: BedrockModelId | string; info: ModelInfo; maxTokens?: number; temperature?: number },
	prompt: string,
	conversationId: string,
): { modelId: string; messages: Message[]; inferenceConfig: BedrockInferenceConfig } {
	const inferenceConfig: BedrockInferenceConfig = {
		maxTokens: modelConfig.maxTokens || (modelConfig.info.maxTokens as number),
		temperature: modelConfig.temperature ?? (0 as number),
	}

	return {
		modelId: modelConfig.id,
		messages: convertToBedrockConverseMessages(
			[{ role: "user", content: prompt }],
			undefined,
			false,
			modelConfig.info,
			conversationId,
		).messages,
		inferenceConfig,
	}
}

export function extractCompletePromptResponse(response: {
	output?: { message?: { content?: Array<{ text?: string }> } }
}): string {
	if (
		response?.output?.message?.content &&
		response.output.message.content.length > 0 &&
		response.output.message.content[0].text &&
		response.output.message.content[0].text.trim().length > 0
	) {
		try {
			return response.output.message.content[0].text
		} catch (parseError) {
			logger.error("Failed to parse Bedrock response", {
				ctx: "bedrock",
				error: parseError instanceof Error ? parseError : String(parseError),
			})
		}
	}
	return ""
}

export async function completePrompt(
	prompt: string,
	client: {
		send: (cmd: ConverseCommand) => Promise<{ output?: { message?: { content?: Array<{ text?: string }> } } }>
	},
	getModel: () => { id: BedrockModelId | string; info: ModelInfo; maxTokens?: number; temperature?: number },
	errorCtx: ErrorHandlerContext,
): Promise<string> {
	try {
		const modelConfig = getModel()
		const conversationId = `prompt_${prompt.substring(0, 20)}`
		const payload = buildCompletePromptPayload(modelConfig, prompt, conversationId)
		const response = await client.send(new ConverseCommand(payload))
		return extractCompletePromptResponse(response)
	} catch (error) {
		throw buildCompletePromptError(error, errorCtx)
	}
}

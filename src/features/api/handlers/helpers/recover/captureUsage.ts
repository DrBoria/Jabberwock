import { type ModelInfo, getApiProtocol, getModelId, isRetiredProvider } from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"
import { calculateApiCostAnthropic, calculateApiCostOpenAI } from "@shared/api/cost"
import type { StreamHandle } from "@features/chat/task/condense/actions/types"

export async function captureUsageData(
	task: StreamHandle,
	tokens: {
		input: number
		output: number
		cacheWrite: number
		cacheRead: number
		total?: number
	},
	streamModelInfo: { [key: string]: unknown },
	updateApiReqMsg: () => void,
	saveMessages?: () => Promise<unknown>,
): Promise<void> {
	if (tokens.input > 0 || tokens.output > 0 || tokens.cacheWrite > 0 || tokens.cacheRead > 0) {
		updateApiReqMsg()
		await saveMessages?.()

		const modelId = getModelId(task.apiConfiguration)
		const apiProvider = task.apiConfiguration.apiProvider
		const apiProtocol = getApiProtocol(
			apiProvider && !isRetiredProvider(apiProvider) ? apiProvider : undefined,
			modelId,
		)

		const costResult =
			apiProtocol === "anthropic"
				? calculateApiCostAnthropic(
						streamModelInfo as ModelInfo,
						tokens.input,
						tokens.output,
						tokens.cacheWrite,
						tokens.cacheRead,
					)
				: calculateApiCostOpenAI(
						streamModelInfo as ModelInfo,
						tokens.input,
						tokens.output,
						tokens.cacheWrite,
						tokens.cacheRead,
					)

		getTelemetryService().captureLlmCompletion(task.taskId, {
			inputTokens: costResult.totalInputTokens,
			outputTokens: costResult.totalOutputTokens,
			cacheWriteTokens: tokens.cacheWrite,
			cacheReadTokens: tokens.cacheRead,
			cost: tokens.total ?? costResult.totalCost,
		})
	}
}

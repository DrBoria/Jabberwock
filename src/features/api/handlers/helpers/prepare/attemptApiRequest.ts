import { Anthropic } from "@anthropic-ai/sdk"

import type { ITaskModel } from "@features/chat/task/store"
import { getSystemPrompt } from "@features/settings/context/systemPrompt"
import { buildNativeToolsArray } from "@features/chat/tools/actions/buildToolDefinitions"
import { getBackendRootStore } from "@features/storeSingleton"

/**
 * Creates an async generator that wraps the API stream for a task.
 *
 * This function is assigned to the task's volatile `attemptApiRequest` property
 * during model creation. It generates the system prompt, builds tool definitions,
 * and delegates to the ApiHandler's createMessage, yielding all stream chunks.
 */
export async function* createAttemptApiRequest(
	task: ITaskModel,
	retryAttempt: number,
	_opts: { [key: string]: unknown },
): AsyncGenerator<unknown> {
	const systemPrompt = await getSystemPrompt(task)

	const store = getBackendRootStore()
	const tools = await buildNativeToolsArray({
		cwd: task.cwd,
		mode: task.taskMode,
		customModes: store.settings.modes.customModes,
		experiments: undefined,
		apiConfiguration: task.apiConfiguration,
		modelInfo: task.api?.getModel().info,
	})

	const stream = task.api!.createMessage(
		systemPrompt,
		task.apiConversationHistory as Anthropic.Messages.MessageParam[],
		{
			taskId: task.taskId,
			tools,
			tool_choice: "auto",
		},
	)

	yield* stream
}

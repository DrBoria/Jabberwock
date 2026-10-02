import { createTool, ToolCallbacks } from "@features/chat/tools/tool"
import type { ITaskModel } from "@features/chat/task/store"
import { getStore } from "@features/singleton"
import { DevToolsLogger } from "@jabberwock/devtool"

/**
 * ThinkTool provides specialized reasoning capabilities.
 * It uses AgentStore routing to select a model (e.g., DeepSeek-R1) for thinking.
 */
export const thinkTool = createTool<"think_tool">({
	name: "think_tool" as const,

	async execute(params: { prompt: string }, task: ITaskModel, callbacks: ToolCallbacks): Promise<void> {
		const { prompt } = params
		const { pushToolResult, handleError } = callbacks

		return DevToolsLogger.track(this.name, task.taskId, async () => {
			try {
				// 1. Resolve model from AgentStore
				const currentModelId = task.apiConfiguration.apiModelId || ""
				const routedModelId = getStore().agents.resolveModelForTool(this.name, currentModelId)

				// 2. Prepare API call
				// We use the task's existing API handler but potentially with a different modelId
				const apiHandler = task.api
				const systemPrompt =
					"You are a specialized reasoning agent. Think through the provided prompt deeply and provide a structured, logical response."

				const stream = apiHandler!.createMessage(systemPrompt, [{ role: "user", content: prompt }], {
					taskId: task.taskId,
					modelId: routedModelId,
				})

				// 3. Consume stream
				let fullText = ""
				for await (const chunk of stream) {
					if (chunk.type === "text") {
						fullText += chunk.text
					}
				}

				if (!fullText) {
					throw new Error("ThinkTool received an empty response from the LLM.")
				}

				// 4. Return result
				pushToolResult(fullText)
			} catch (error) {
				await handleError("thinking", error as Error)
			}
		})
	},
})

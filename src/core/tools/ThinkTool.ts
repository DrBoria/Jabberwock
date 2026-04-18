import { BaseTool, ToolCallbacks } from "./BaseTool"
import { Task } from "../task/Task"
import { agentStore } from "../state/AgentStore"
import { DevToolsLogger } from "../devtools/DevToolsLogger"

/**
 * ThinkTool provides specialized reasoning capabilities.
 * It uses AgentStore routing to select a model (e.g., DeepSeek-R1) for thinking.
 */
export class ThinkTool extends BaseTool<"think_tool"> {
	readonly name = "think_tool" as const

	async execute(params: { prompt: string }, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { prompt } = params
		const { pushToolResult, handleError } = callbacks

		return DevToolsLogger.track(this.name, task.taskId, async () => {
			try {
				// 1. Resolve model from AgentStore
				const currentModelId = task.apiConfiguration.apiModelId || ""
				const routedModelId = agentStore.resolveModelForTool(this.name, currentModelId)

				// 2. Prepare API call
				// We use the task's existing API handler but potentially with a different modelId
				const apiHandler = task.api
				const systemPrompt =
					"You are a specialized reasoning agent. Think through the provided prompt deeply and provide a structured, logical response."

				const stream = apiHandler.createMessage(systemPrompt, [{ role: "user", content: prompt }], {
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
	}
}

export const thinkTool = new ThinkTool()

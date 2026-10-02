import type { ITaskModel } from "@features/chat/task"
import { formatResponse } from "@features/settings"
import type { ToolUse } from "@shared/tools"

import { createTool, ToolCallbacks } from "@features/chat/tools/tool"
import { ask } from "@features/chat/task/notifications/actions/ask"
import { emitBroadcast } from "@features/chat/task/messages/actions/say"
import { sayAndCreateMissingParamError } from "@features/chat/task/messages/actions/command/sayAndCreateMissingParamError"

interface Suggestion {
	text: string
	mode?: string
}

interface AskFollowupQuestionParams {
	question: string
	follow_up: Suggestion[]
}

export const askFollowupQuestionTool = createTool<"ask_followup_question">({
	name: "ask_followup_question" as const,

	async execute(params: AskFollowupQuestionParams, task: ITaskModel, callbacks: ToolCallbacks): Promise<void> {
		const { question, follow_up } = params
		const { handleError, pushToolResult } = callbacks

		const recordMissingParamError = async (paramName: string): Promise<void> => {
			task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
			task.recordToolError("ask_followup_question")
			task._state.setDidToolFailInCurrentTurn(true)
			pushToolResult(await sayAndCreateMissingParamError(task.taskId, "ask_followup_question", paramName))
		}

		try {
			if (!question) {
				await recordMissingParamError("question")
				return
			}

			if (!follow_up || !Array.isArray(follow_up)) {
				await recordMissingParamError("follow_up")
				return
			}

			// Transform follow_up suggestions to the format expected by task.ask
			const follow_up_json = {
				question,
				suggest: follow_up.map((s) => ({ answer: s.text, mode: s.mode })),
			}

			task._state.setConsecutiveMistakeCount(0)
			const { text, images } = await ask(task.taskId, "followup", JSON.stringify(follow_up_json), false)
			await emitBroadcast("user", task.taskId, "user_feedback", text ?? "", images)
			pushToolResult(formatResponse.toolResult(`<user_message>\n${text}\n</user_message>`, images))
		} catch (error) {
			await handleError("asking question", error as Error)
		}
	},

	async handlePartial(task: ITaskModel, block: ToolUse<"ask_followup_question">): Promise<void> {
		const question: string | undefined = block.nativeArgs?.question ?? block.params.question

		// During partial streaming, only show the question to avoid displaying raw JSON
		// The full JSON with suggestions will be sent when the tool call is complete (!block.partial)
		await ask(task.taskId, "followup", question ?? "", block.partial).catch(() => {})
	},
})

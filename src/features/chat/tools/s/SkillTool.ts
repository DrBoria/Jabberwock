import type { ITaskModel } from "@features/chat/task/store"
import { formatResponse } from "@features/settings/context/responses"
import { BaseTool, ToolCallbacks } from "@features/chat/tools/a-b/BaseTool"
import type { ToolUse } from "@shared/tools"
import { getBackendRootStore } from "@features/storeSingleton"
import { getSkillsManager } from "@features/settings/skills/store"
import { ask } from "@features/chat/task/notifications/actions/ask"
import { sayAndCreateMissingParamError } from "@features/chat/task/messages/actions/command/sayAndCreateMissingParamError"

import {
	buildSkillApprovalMessage,
	buildSkillResult,
	resolveSkillContentForMode,
} from "@services/skills/skillInvocation"

interface SkillParams {
	skill: string
	args?: string
}

export class SkillTool extends BaseTool<"skill"> {
	readonly name = "skill" as const

	async execute(params: SkillParams, task: ITaskModel, callbacks: ToolCallbacks): Promise<void> {
		const { skill: skillName, args } = params
		const { askApproval, handleError, pushToolResult } = callbacks

		try {
			// Validate skill name parameter
			if (!skillName) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("skill")
				task._state.setDidToolFailInCurrentTurn(true)
				pushToolResult(await sayAndCreateMissingParamError(task.taskId, "skill", "skill"))
				return
			}

			task._state.setConsecutiveMistakeCount(0)

			// Get SkillsManager from provider
			const skillsManager = getSkillsManager(getBackendRootStore())

			if (!skillsManager) {
				task.recordToolError("skill")
				task._state.setDidToolFailInCurrentTurn(true)
				pushToolResult(formatResponse.toolError("Skills Manager not available"))
				return
			}

			// Get current mode for skill resolution
			const currentMode = task.taskMode ?? "code"

			// Fetch skill content
			const skillContent = await resolveSkillContentForMode(skillsManager, skillName, currentMode)

			if (!skillContent) {
				// Get available skills for error message
				const availableSkills = skillsManager.getSkillsForMode(currentMode)
				const skillNames = availableSkills.map((s) => s.name)

				task.recordToolError("skill")
				task._state.setDidToolFailInCurrentTurn(true)
				pushToolResult(
					formatResponse.toolError(
						`Skill '${skillName}' not found. Available skills: ${skillNames.join(", ") || "(none)"}`,
					),
				)
				return
			}

			// Build approval message
			const toolMessage = buildSkillApprovalMessage(skillName, args, skillContent)

			const didApprove = await askApproval("tool", toolMessage)

			if (!didApprove) {
				return
			}

			pushToolResult(buildSkillResult(skillName, args, skillContent))
		} catch (error) {
			await handleError("executing skill", error as Error)
		}
	}

	override async handlePartial(task: ITaskModel, block: ToolUse<"skill">): Promise<void> {
		const skillName: string | undefined = block.params.skill
		const args: string | undefined = block.params.args

		const partialMessage = JSON.stringify({
			tool: "skill",
			skill: skillName,
			args: args,
		})

		await ask(task.taskId, "tool", partialMessage, block.partial).catch(() => {})
	}
}

export const skillTool = new SkillTool()

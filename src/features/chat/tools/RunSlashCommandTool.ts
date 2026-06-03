import type { ITaskModel } from "../../../features/chat/task/store"
import { formatResponse } from "../../settings/context/responses"
import { getCommand, getCommandNames } from "../../../services/command/commands"
import { EXPERIMENT_IDS, experiments } from "../../../shared/experiments"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../../shared/tools"
import { getModeBySlug } from "../../../shared/modes"
import { getBackendRootStore } from "../../../features/storeSingleton"
import { getSkillsManager } from "../../../features/settings/skills/store"
import { handleModeSwitch } from "@features/foundation/window-manager/store"
import { ask } from "../task/notifications/actions/ask"
import { sayAndCreateMissingParamError } from "../task/messages/actions/missingParamError"

import {
	buildSkillApprovalMessage,
	buildSkillResult,
	resolveSkillContentForMode,
} from "../../../services/skills/skillInvocation"
import { getState } from "@features/storeSingleton"

interface RunSlashCommandParams {
	command: string
	args?: string
}

export class RunSlashCommandTool extends BaseTool<"run_slash_command"> {
	readonly name = "run_slash_command" as const

	async execute(params: RunSlashCommandParams, task: ITaskModel, callbacks: ToolCallbacks): Promise<void> {
		const { command: commandName, args } = params
		const { askApproval, handleError, pushToolResult } = callbacks

		// Check if run slash command experiment is enabled
		const provider = task.providerRef!.deref()
		const isRunSlashCommandEnabled = experiments.isEnabled({}, EXPERIMENT_IDS.RUN_SLASH_COMMAND)

		if (!isRunSlashCommandEnabled) {
			pushToolResult(
				formatResponse.toolError(
					"Run slash command is an experimental feature that must be enabled in settings. Please enable 'Run Slash Command' in the Experimental Settings section.",
				),
			)
			return
		}

		try {
			if (!commandName) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("run_slash_command")
				task._state.setDidToolFailInCurrentTurn(true)
				pushToolResult(await sayAndCreateMissingParamError(task.taskId, "run_slash_command", "command"))
				return
			}

			task._state.setConsecutiveMistakeCount(0)

			// Get the command from the commands service
			const command = await getCommand(task.cwd, commandName)

			if (!command) {
				const currentMode = task.taskMode ?? "code"
				const skillsManager = getSkillsManager(getBackendRootStore())
				const skillContent = await resolveSkillContentForMode(skillsManager, commandName, currentMode)

				if (skillContent) {
					const skillMessage = buildSkillApprovalMessage(commandName, args, skillContent)
					const didApprove = await askApproval("tool", skillMessage)

					if (!didApprove) {
						return
					}

					pushToolResult(buildSkillResult(commandName, args, skillContent))
					return
				}

				// Get available commands for error message
				const availableCommands = await getCommandNames(task.cwd)
				task.recordToolError("run_slash_command")
				task._state.setDidToolFailInCurrentTurn(true)
				pushToolResult(
					formatResponse.toolError(
						`Command '${commandName}' not found. Available commands: ${availableCommands.join(", ") || "(none)"}`,
					),
				)
				return
			}

			const toolMessage = JSON.stringify({
				tool: "runSlashCommand",
				command: commandName,
				args: args,
				source: command.source,
				description: command.description,
				mode: command.mode,
			})

			const didApprove = await askApproval("tool", toolMessage)

			if (!didApprove) {
				return
			}

			// Switch mode if specified in the command frontmatter
			if (command.mode) {
				const provider = task.providerRef!.deref()
				const customModes = getBackendRootStore().settings.modes.customModes
				const targetMode = getModeBySlug(command.mode, customModes)
				if (targetMode) {
					await handleModeSwitch(provider!, command.mode)
				}
			}

			// Build the result message
			let result = `Command: /${commandName}`

			if (command.description) {
				result += `\nDescription: ${command.description}`
			}

			if (command.argumentHint) {
				result += `\nArgument hint: ${command.argumentHint}`
			}

			if (command.mode) {
				result += `\nMode: ${command.mode}`
			}

			if (args) {
				result += `\nProvided arguments: ${args}`
			}

			result += `\nSource: ${command.source}`
			result += `\n\n--- Command Content ---\n\n${command.content}`

			// Return the command content as the tool result
			pushToolResult(result)
		} catch (error) {
			await handleError("running slash command", error as Error)
		}
	}

	override async handlePartial(task: ITaskModel, block: ToolUse<"run_slash_command">): Promise<void> {
		const commandName: string | undefined = block.params.command
		const args: string | undefined = block.params.args

		const partialMessage = JSON.stringify({
			tool: "runSlashCommand",
			command: commandName,
			args: args,
		})

		await ask(task.taskId, "tool", partialMessage, block.partial).catch(() => {})
	}
}

export const runSlashCommandTool = new RunSlashCommandTool()

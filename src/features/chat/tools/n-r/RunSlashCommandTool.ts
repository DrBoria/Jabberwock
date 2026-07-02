import type { ITaskModel } from "@features/chat/task/store"
import { formatResponse } from "@features/settings/context/responses"
import { getCommand, getCommandNames } from "@services/command/commands"
import { EXPERIMENT_IDS, experiments } from "@shared/experiments"
import { BaseTool, ToolCallbacks } from "@features/chat/tools/a-b/BaseTool"
import type { ToolUse } from "@shared/tools"
import { getModeBySlug } from "@shared/modes"
import { getBackendRootStore } from "@features/storeSingleton"
import { getSkillsManager } from "@features/settings/skills/store"
import { handleModeSwitch } from "@features/foundation/window-manager/store"
import { ask } from "@features/chat/task/notifications/actions/ask"
import { sayAndCreateMissingParamError } from "@features/chat/task/messages/actions/command/sayAndCreateMissingParamError"

import {
	buildSkillApprovalMessage,
	buildSkillResult,
	resolveSkillContentForMode,
} from "@services/skills/skillInvocation"
import { getState } from "@features/storeSingleton"
import { getProvider } from "@features/foundation/webview/providerRegistry"

interface RunSlashCommandParams {
	command: string
	args?: string
}

/**
 * Handles the case where a command is not found, trying skills fallback.
 */
async function handleMissingCommand(
	task: ITaskModel,
	commandName: string,
	args: string | undefined,
	callbacks: ToolCallbacks,
): Promise<void> {
	const { askApproval, pushToolResult } = callbacks
	const currentMode = task.taskMode ?? "code"
	const skillsManager = getSkillsManager(getBackendRootStore())
	const skillContent = await resolveSkillContentForMode(skillsManager, commandName, currentMode)

	if (skillContent) {
		const skillMessage = buildSkillApprovalMessage(commandName, args, skillContent)
		const didApprove = await askApproval("tool", skillMessage)
		if (!didApprove) return

		pushToolResult(buildSkillResult(commandName, args, skillContent))
		return
	}

	const availableCommands = await getCommandNames(task.cwd)
	task.recordToolError("run_slash_command")
	task._state.setDidToolFailInCurrentTurn(true)
	pushToolResult(
		formatResponse.toolError(
			`Command '${commandName}' not found. Available commands: ${availableCommands.join(", ") || "(none)"}`,
		),
	)
}

/**
 * Switches the current task mode to the one specified in the command.
 */
async function switchToCommandMode(mode: string): Promise<void> {
	const customModes = getBackendRootStore().settings.modes.customModes
	const targetMode = getModeBySlug(mode, customModes)
	if (targetMode) {
		await handleModeSwitch(getProvider(), mode)
	}
}

/**
 * Builds the result message string from a resolved command.
 */
function buildCommandResult(
	commandName: string,
	command: { description?: string; argumentHint?: string; mode?: string; source: string; content: string },
	args: string | undefined,
): string {
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

	return result
}

export class RunSlashCommandTool extends BaseTool<"run_slash_command"> {
	readonly name = "run_slash_command" as const

	async execute(params: RunSlashCommandParams, task: ITaskModel, callbacks: ToolCallbacks): Promise<void> {
		const { command: commandName, args } = params
		const { askApproval, handleError, pushToolResult } = callbacks

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

			const command = await getCommand(task.cwd, commandName)
			if (!command) {
				await handleMissingCommand(task, commandName, args, callbacks)
				return
			}

			const didApprove = await askApproval(
				"tool",
				JSON.stringify({
					tool: "runSlashCommand",
					command: commandName,
					args,
					source: command.source,
					description: command.description,
					mode: command.mode,
				}),
			)
			if (!didApprove) return

			if (command.mode) {
				await switchToCommandMode(command.mode)
			}

			pushToolResult(buildCommandResult(commandName, command, args))
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

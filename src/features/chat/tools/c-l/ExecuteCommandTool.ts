import * as vscode from "vscode"

import { Package } from "@shared/package"
import { ToolUse } from "@shared/tools"
import { formatResponse } from "@features/settings/context/responses"
import { unescapeHtmlEntities } from "@utils/text"
import type { ITaskModel } from "@features/chat/task/store"

import { BaseTool, ToolCallbacks } from "@features/chat/tools/a-b/BaseTool"
import { ask } from "@features/chat/task/notifications/actions/ask"
import { systemBroadcast } from "@features/chat/task/messages/actions/say"
import { sayAndCreateMissingParamError } from "@features/chat/task/messages/actions/command/sayAndCreateMissingParamError"
import { validateCommand } from "@utils/ignore"

import {
	type ExecuteCommandOptions,
	resolveAgentTimeoutMs,
	executeWithShellFallback,
} from "@features/chat/tools/helpers/execute"

interface ExecuteCommandParams {
	command: string
	cwd?: string
	timeout?: number | null
}

function resolveCommandOptions(
	canonicalCommand: string,
	executionId: string,
	customCwd?: string,
	timeoutSeconds?: number | null,
): ExecuteCommandOptions {
	const commandExecutionTimeoutSeconds = vscode.workspace
		.getConfiguration(Package.name)
		.get<number>("commandExecutionTimeout", 0)

	const commandTimeoutAllowlist = vscode.workspace
		.getConfiguration(Package.name)
		.get<string[]>("commandTimeoutAllowlist", [])

	const isCommandAllowlisted = commandTimeoutAllowlist.some((prefix) => canonicalCommand.startsWith(prefix.trim()))

	const commandExecutionTimeout = isCommandAllowlisted ? 0 : commandExecutionTimeoutSeconds * 1000
	const agentTimeout = resolveAgentTimeoutMs(timeoutSeconds)

	return {
		executionId,
		command: canonicalCommand,
		customCwd,
		terminalShellIntegrationDisabled: true,
		commandExecutionTimeout,
		agentTimeout,
	}
}

export class ExecuteCommandTool extends BaseTool<"execute_command"> {
	readonly name = "execute_command" as const

	async execute(params: ExecuteCommandParams, task: ITaskModel, callbacks: ToolCallbacks): Promise<void> {
		const { command, cwd: customCwd, timeout: timeoutSeconds } = params
		const { handleError, pushToolResult, askApproval } = callbacks

		try {
			if (!command) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("execute_command")
				pushToolResult(await sayAndCreateMissingParamError(task.taskId, "execute_command", "command"))
				return
			}

			const canonicalCommand = unescapeHtmlEntities(command)

			const ignoredFileAttemptedToAccess = validateCommand(
				task.jabberwockIgnoreController,
				canonicalCommand,
				task.cwd,
			)

			if (ignoredFileAttemptedToAccess) {
				await systemBroadcast(task.taskId, "rooignore_error", ignoredFileAttemptedToAccess)
				pushToolResult(formatResponse.jabberwockIgnoreError(ignoredFileAttemptedToAccess))
				return
			}

			task._state.setConsecutiveMistakeCount(0)

			const didApprove = await askApproval("command", canonicalCommand)

			if (!didApprove) {
				return
			}

			const executionId = task.lastMessageTs?.toString() ?? Date.now().toString()

			const options = resolveCommandOptions(canonicalCommand, executionId, customCwd, timeoutSeconds)

			await executeWithShellFallback(task, options, pushToolResult, handleError)
		} catch (error) {
			await handleError("executing command", error as Error)
		}
	}

	override async handlePartial(task: ITaskModel, block: ToolUse<"execute_command">): Promise<void> {
		const command = block.params.command
		await ask(task.taskId, "command", command ?? "", block.partial).catch(() => {})
	}
}

export const executeCommandTool = new ExecuteCommandTool()

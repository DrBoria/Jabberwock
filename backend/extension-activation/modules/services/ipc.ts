import * as vscode from "vscode"

import { IpcMessageType, TaskCommandName } from "@jabberwock/types"
import type { TaskCommand } from "@jabberwock/types"
import { IpcServer } from "@jabberwock/ipc"

import {
	dispatchTaskCancelIntent,
	dispatchSendMessageToAgent,
	dispatchTaskResumeIntent,
	dispatchTaskNewIntent,
} from "@features/api/events/actions/task-command-intents"

export function setupIpcServer(
	socketPath: string | undefined,
	enableLogging: boolean,
	outputChannel: vscode.OutputChannel,
): void {
	if (!socketPath) return

	const ipcLog = enableLogging
		? (...args: unknown[]) => {
				for (const arg of args) {
					outputChannel.appendLine(arg === undefined ? "undefined" : String(arg))
				}
				console.log(args)
			}
		: () => {}

	const ipc = new IpcServer(socketPath, ipcLog)
	ipc.listen()

	ipc.on(IpcMessageType.TaskCommand, async (_clientId, command: TaskCommand) => {
		switch (command.commandName) {
			case TaskCommandName.StartNewTask: {
				const { text, images, configuration } = command.data
				const taskConfiguration = (configuration as Record<string, unknown> | undefined) ?? undefined
				dispatchTaskNewIntent({ text, images, taskConfiguration })
				break
			}
			case TaskCommandName.CancelTask:
				dispatchTaskCancelIntent()
				break
			case TaskCommandName.CloseTask:
				vscode.commands.executeCommand("workbench.action.files.saveFiles")
				vscode.commands.executeCommand("workbench.action.closeWindow")
				break
			case TaskCommandName.ResumeTask:
				dispatchTaskResumeIntent(command.data)
				break
			case TaskCommandName.SendMessage: {
				const dispatched = dispatchSendMessageToAgent((command.data as { text?: string }).text ?? "")
				if (!dispatched) ipcLog("[IPC] sendMessage: no active task to deliver the prompt")
				break
			}
			default:
				ipcLog(`[IPC] Unhandled command: ${command.commandName}`)
		}
	})
}

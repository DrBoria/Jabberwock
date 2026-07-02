import * as vscode from "vscode"
import { randomUUID } from "crypto"

import { IpcMessageType, IntentType, IntentStatus, TaskCommandName } from "@jabberwock/types"
import type { TaskCommand } from "@jabberwock/types"
import { IpcServer } from "@jabberwock/ipc"

import { getBackendRootStore } from "@features/storeSingleton"

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
				getBackendRootStore().intentStore.createIntent({
					id: randomUUID(),
					type: IntentType.TaskNewRequested,
					payload: {
						text: text ?? "",
						images: images ?? undefined,
						taskConfiguration: configuration as Record<string, unknown> | undefined,
					},
					status: IntentStatus.Queued,
					createdAt: Date.now(),
				})
				break
			}
			case TaskCommandName.CancelTask:
				getBackendRootStore().intentStore.createIntent({
					id: randomUUID(),
					type: IntentType.TaskCancelRequested,
					payload: {},
					status: IntentStatus.Queued,
					createdAt: Date.now(),
				})
				break
			case TaskCommandName.CloseTask:
				vscode.commands.executeCommand("workbench.action.files.saveFiles")
				vscode.commands.executeCommand("workbench.action.closeWindow")
				break
			case TaskCommandName.ResumeTask:
				getBackendRootStore().intentStore.createIntent({
					id: randomUUID(),
					type: IntentType.TaskResumeRequested,
					payload: { taskId: command.data },
					status: IntentStatus.Queued,
					createdAt: Date.now(),
				})
				break
			case TaskCommandName.SendMessage: {
				const activeTask = getBackendRootStore().chat.activeTask
				if (activeTask) {
					getBackendRootStore().intentStore.createIntent({
						id: randomUUID(),
						type: IntentType.SendMessageToAgentRequested,
						payload: {
							taskId: activeTask.taskId,
							prompt: (command.data as { text?: string }).text ?? "",
						},
						status: IntentStatus.Queued,
						createdAt: Date.now(),
					})
				}
				break
			}
			default:
				ipcLog(`[IPC] Unhandled command: ${command.commandName}`)
		}
	})
}

import * as vscode from "vscode"

import {
	type JabberwockAPIEvents,
	type TaskEvent,
	JabberwockEventName,
	TaskCommandName,
	IpcOrigin,
	IpcMessageType,
} from "@jabberwock/types"
import { IpcServer } from "@jabberwock/ipc"
import { getCloudService, hasCloudService } from "@jabberwock/cloud"

import type { EventBridge } from "../../core/webview/EventBridge"
import { getCommands } from "../../services/command/commands"
import { getModels } from "../../api/providers/fetchers/modelCache"
import { startNewTask, cancelCurrentTask, resumeTask, sendMessage, deleteQueuedMessage } from "../chat/api-methods"

/**
 * Creates and starts an IPC server, registers all IPC command handlers,
 * and returns a function to broadcast task events to IPC clients.
 */
export function registerIpcListeners(
	provider: EventBridge,
	context: vscode.ExtensionContext,
	outputChannel: vscode.OutputChannel,
	socketPath: string,
	enableLogging: boolean,
): {
	ipc: IpcServer
	emit: <K extends keyof JabberwockAPIEvents>(eventName: K, ...args: JabberwockAPIEvents[K]) => void
} {
	const log = enableLogging
		? (...args: unknown[]) => {
				for (const arg of args) {
					outputChannel.appendLine(arg === undefined ? "undefined" : String(arg))
				}
				console.log(args)
			}
		: () => {}

	log(`[IPC] server started: socketPath=${socketPath}, pid=${process.pid}, ppid=${process.ppid}`)

	const ipc = new IpcServer(socketPath, log)
	ipc.listen()

	// Create an emit function that broadcasts to IPC clients and returns void
	const emit = <K extends keyof JabberwockAPIEvents>(eventName: K, ...args: JabberwockAPIEvents[K]) => {
		const data = { eventName: eventName as JabberwockEventName, payload: args } as TaskEvent
		ipc.broadcast({ type: IpcMessageType.TaskEvent, origin: IpcOrigin.Server, data })
	}

	// Register IPC command handlers
	ipc.on(IpcMessageType.TaskCommand, async (clientId, command) => {
		const sendResponse = (eventName: JabberwockEventName, payload: unknown[]) => {
			ipc.send(clientId, {
				type: IpcMessageType.TaskEvent,
				origin: IpcOrigin.Server,
				data: { eventName, payload } as TaskEvent,
			})
		}

		switch (command.commandName) {
			case TaskCommandName.StartNewTask: {
				log(`[IPC] StartNewTask -> ${command.data.text}, ${JSON.stringify(command.data.configuration)}`)
				const { configuration, text, images, newTab } = command.data
				await startNewTask(provider, context, outputChannel, { configuration, text, images, newTab })
				break
			}
			case TaskCommandName.CancelTask:
				log(`[IPC] CancelTask`)
				await cancelCurrentTask(provider)
				break
			case TaskCommandName.CloseTask:
				log(`[IPC] CloseTask`)
				await vscode.commands.executeCommand("workbench.action.files.saveFiles")
				await vscode.commands.executeCommand("workbench.action.closeWindow")
				break
			case TaskCommandName.ResumeTask:
				log(`[IPC] ResumeTask -> ${command.data}`)
				try {
					await resumeTask(provider, command.data)
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error)
					log(`[IPC] ResumeTask failed for taskId ${command.data}: ${errorMessage}`)
				}
				break
			case TaskCommandName.SendMessage:
				log(`[IPC] SendMessage -> ${command.data.text}`)
				await sendMessage(provider, command.data.text, command.data.images)
				break
			case TaskCommandName.GetCommands:
				try {
					const commands = await getCommands(provider.cwd)
					sendResponse(JabberwockEventName.CommandsResponse, [
						commands.map((cmd) => ({
							name: cmd.name,
							source: cmd.source,
							filePath: cmd.filePath,
							description: cmd.description,
							argumentHint: cmd.argumentHint,
						})),
					])
				} catch (error) {
					sendResponse(JabberwockEventName.CommandsResponse, [[]])
				}
				break
			case TaskCommandName.GetModes:
				try {
					const customModes = (await provider.customModesManager?.getCustomModes?.()) ?? []
					sendResponse(JabberwockEventName.ModesResponse, [customModes])
				} catch (error) {
					sendResponse(JabberwockEventName.ModesResponse, [[]])
				}
				break
			case TaskCommandName.GetModels:
				try {
					const models = await getModels({
						provider: "jabberwock" as const,
						baseUrl: process.env.JABBERWOCK_CODE_PROVIDER_URL ?? "https://api.jabberwock.com/proxy",
						apiKey: hasCloudService() ? getCloudService().authService?.getSessionToken() : undefined,
					})
					sendResponse(JabberwockEventName.ModelsResponse, [models])
				} catch (error) {
					sendResponse(JabberwockEventName.ModelsResponse, [{}])
				}
				break
			case TaskCommandName.DeleteQueuedMessage:
				log(`[IPC] DeleteQueuedMessage -> ${command.data}`)
				try {
					deleteQueuedMessage(provider, command.data)
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error)
					log(`[IPC] DeleteQueuedMessage failed for messageId ${command.data}: ${errorMessage}`)
				}
				break
		}
	})

	return { ipc, emit }
}

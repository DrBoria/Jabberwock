import * as vscode from "vscode"

import type { ProviderHandle } from "@features/foundation/webview/EventBridge"
import type { CreateTaskOptions, JabberwockSettings } from "@jabberwock/types"
import { Package } from "@shared/package"
import { openClineInNewTab } from "@activate/registerCommands"
import { postStateToWebview } from "@features/foundation/window-manager/store"
import { getBackendRootStore } from "@features/storeSingleton"
import { createTask } from "./create-task"

export async function startNewTask(
	provider: ProviderHandle,
	context: vscode.ExtensionContext,
	outputChannel: vscode.OutputChannel,
	options: {
		configuration: JabberwockSettings
		text?: string
		images?: string[]
		newTab?: boolean
	},
): Promise<string> {
	const { configuration, text, images, newTab } = options
	let targetProvider: ProviderHandle

	if (newTab) {
		await vscode.commands.executeCommand("workbench.action.files.revert")
		await vscode.commands.executeCommand("workbench.action.closeAllEditors")

		targetProvider = await openClineInNewTab({ context, outputChannel })
	} else {
		await vscode.commands.executeCommand(`${Package.name}.SidebarProvider.focus`)
		targetProvider = provider
	}

	const chatStore = getBackendRootStore().chat
	const activeTask = chatStore.activeTask

	if (activeTask) {
		chatStore.clearAllStreamingToolCalls()
		chatStore.removeTask(activeTask.taskId)
	}

	await postStateToWebview(targetProvider)
	await targetProvider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
	await targetProvider.postMessageToWebview({ type: "invoke", invoke: "newChat", text, images })

	const taskOptions: CreateTaskOptions = {
		consecutiveMistakeLimit: Number.MAX_SAFE_INTEGER,
	}

	const task = await createTask(targetProvider, text, images, { ...configuration, ...taskOptions }, undefined)

	if (!task) {
		throw new Error("Failed to create task due to policy restrictions")
	}

	return task.taskId
}

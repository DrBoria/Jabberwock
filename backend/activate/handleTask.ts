import * as vscode from "vscode"

import { Package } from "@shared/package"
import { t } from "@i18n"
import { getVisibleProviderOrLog } from "@activate/registerCommands"

export const handleNewChat = async (params: { prompt?: string } | null | undefined) => {
	let prompt = params?.prompt

	if (!prompt) {
		prompt = await vscode.window.showInputBox({
			prompt: t("common:input.task_prompt"),
			placeHolder: t("common:input.task_placeholder"),
		})
	}

	// Use the visible provider (not just first available) to ensure we update the correct webview
	const outputChannel = vscode.window.createOutputChannel("Jabberwock")
	const provider = await getVisibleProviderOrLog(outputChannel)
	if (!provider) {
		if (!prompt) {
			await vscode.commands.executeCommand(`${Package.name}.SidebarProvider.focus`)
		}
		return
	}

	// Clear the task stack (mirrors plusButtonClicked behavior) to navigate to home screen
	const vp = provider as { taskStack?: unknown[] }
	const taskStack = vp.taskStack
	if (taskStack && taskStack.length > 0) {
		taskStack.splice(0, taskStack.length)
	}

	// Navigate to chat home screen
	await provider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })

	// Send newChat invoke to clear frontend state (currentTaskItem, input, etc.)
	await provider.postMessageToWebview({ type: "invoke", invoke: "newChat" })

	// If user provided a prompt, pre-populate the chat box
	if (prompt) {
		await provider.postMessageToWebview({
			type: "invoke",
			invoke: "setChatBoxMessage",
			text: prompt,
			images: [],
		})
	}

	// Focus the input field
	await provider.postMessageToWebview({ type: "action", action: "focusInput" })
}

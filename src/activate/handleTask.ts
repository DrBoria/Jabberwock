import * as vscode from "vscode"

import { Package } from "../shared/package"
import { EventBridge } from "../features/foundation/webview/EventBridge"
import { handleCodeAction } from "../features/settings/agents/handlers"
import { t } from "../i18n"

export const handleNewTask = async (params: { prompt?: string } | null | undefined) => {
	let prompt = params?.prompt

	if (!prompt) {
		prompt = await vscode.window.showInputBox({
			prompt: t("common:input.task_prompt"),
			placeHolder: t("common:input.task_placeholder"),
		})
	}

	if (!prompt) {
		await vscode.commands.executeCommand(`${Package.name}.SidebarProvider.focus`)
		return
	}

	const provider = EventBridge.getFirstAvailableInstance()
	if (provider) {
		await handleCodeAction(provider, {
			type: "handleCodeAction",
			command: "newTask",
			promptType: "NEW_TASK",
			params: { userInput: prompt },
		})
	}
}

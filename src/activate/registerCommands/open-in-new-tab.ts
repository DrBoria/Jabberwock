import * as vscode from "vscode"
import delay from "delay"

import { initVscodeContext } from "@features/foundation/vscode/context"
import { EventBridge } from "@features/foundation/webview/EventBridge"
import { MdmService, getMdmService } from "@services/mdm/MdmService"
import { setPanel } from "./panel-store"

export const openClineInNewTab = async ({
	context,
	outputChannel,
}: {
	context: vscode.ExtensionContext
	outputChannel: vscode.OutputChannel
}) => {
	initVscodeContext(context)
	let mdmService: MdmService | undefined
	try {
		mdmService = getMdmService()
	} catch (_error) {
		mdmService = undefined
	}

	const tabProvider = new EventBridge(context, outputChannel, "editor", mdmService)
	const lastCol = Math.max(...vscode.window.visibleTextEditors.map((editor) => editor.viewColumn || 0))

	const hasVisibleEditors = vscode.window.visibleTextEditors.length > 0

	if (!hasVisibleEditors) {
		await vscode.commands.executeCommand("workbench.action.newGroupRight")
	}

	const targetCol = hasVisibleEditors ? Math.max(lastCol + 1, 1) : vscode.ViewColumn.Two

	const newPanel = vscode.window.createWebviewPanel(EventBridge.tabPanelId, "Jabberwock", targetCol, {
		enableScripts: true,
		retainContextWhenHidden: true,
		localResourceRoots: [context.extensionUri],
	})

	setPanel(newPanel, "tab")

	newPanel.iconPath = {
		light: vscode.Uri.joinPath(context.extensionUri, "assets", "icons", "panel_light.png"),
		dark: vscode.Uri.joinPath(context.extensionUri, "assets", "icons", "panel_dark.png"),
	}

	await tabProvider.resolveWebviewView(newPanel)

	newPanel.onDidChangeViewState(
		(e) => {
			const panel = e.webviewPanel
			if (panel.visible) {
				panel.webview.postMessage({ type: "action", action: "didBecomeVisible" })
			}
		},
		null,
		context.subscriptions,
	)

	newPanel.onDidDispose(
		() => {
			setPanel(undefined, "tab")
		},
		null,
		context.subscriptions,
	)

	await delay(100)
	await vscode.commands.executeCommand("workbench.action.lockEditorGroup")

	return tabProvider
}

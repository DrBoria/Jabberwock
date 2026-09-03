import * as vscode from "vscode"
import delay from "delay"

import { installBackendState } from "@features/foundation/host-context/context"
import { getBackendCapabilities } from "@features/foundation/capabilities/registry"
import { EventBridge } from "@features/foundation/webview/EventBridge"
import { wireInboundToQueue } from "@features/foundation/webview/inbound-wiring"
import { setPanel } from "./panel-store"
import { VscodeWebviewBackendConnector } from "@connectors/vscode/backend/connector"

export const openClineInNewTab = async ({
	context,
	outputChannel,
}: {
	context: vscode.ExtensionContext
	outputChannel: vscode.OutputChannel
}) => {
	installBackendState(context)

	// v4 B3 (§4.2): the editor tab gets its own connector instance (mirroring the old per-panel
	// EventBridge); inbound is wired to the shared capabilities.queue so the extension-level drain
	// consumer feeds webviewMessageHandler for the tab too.
	const tabConnector = new VscodeWebviewBackendConnector(context, outputChannel)
	const capabilities = getBackendCapabilities()
	await tabConnector.start(capabilities)
	wireInboundToQueue(tabConnector, capabilities.queue, tabConnector.id)
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

	await tabConnector.resolveWebviewView(newPanel)

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

	return tabConnector
}

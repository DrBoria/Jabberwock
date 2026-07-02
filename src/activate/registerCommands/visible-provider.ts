import * as vscode from "vscode"
import { EventBridge } from "@features/foundation/webview/EventBridge"

export async function getVisibleProviderOrLog(outputChannel: vscode.OutputChannel): Promise<EventBridge | undefined> {
	const visibleProvider = await EventBridge.getVisibleInstance()
	if (!visibleProvider) {
		const fallback = EventBridge.getFirstAvailableInstance()
		if (fallback) {
			outputChannel.appendLine(
				"No visible Jabberwock instance found; using first available instance as fallback.",
			)
			return fallback
		}
		outputChannel.appendLine("Cannot find any visible or available Jabberwock instances.")
		return undefined
	}
	return visibleProvider
}

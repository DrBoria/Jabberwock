import * as vscode from "vscode"
import { EventBridge, getFirstAvailableInstance } from "@features/foundation/webview/EventBridge"

export async function getVisibleProviderOrLog(outputChannel: vscode.OutputChannel): Promise<EventBridge | undefined> {
	const provider = getFirstAvailableInstance()
	if (!provider) {
		outputChannel.appendLine("Cannot find any available Jabberwock instance.")
		return undefined
	}
	return provider
}

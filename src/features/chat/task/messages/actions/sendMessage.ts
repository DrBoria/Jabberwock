import type { EventBridge } from "../../../../foundation/webview/EventBridge"
import { getBackendRootStore } from "@features/storeSingleton"

function getViewLaunched(): boolean {
	const state = getBackendRootStore()
	return state.foundation.windowManager.viewLaunched
}

/**
 * Sends a message to the current task.
 * In headless/sandbox flows the webview may not be launched.
 */
export async function sendMessage(provider: EventBridge, text?: string, images?: string[]): Promise<void> {
	const currentTask = getBackendRootStore().chat.activeTask

	// In headless/sandbox flows the webview may not be launched
	if (!getViewLaunched()) {
		if (!currentTask) {
			return
		}

		await currentTask.submitUserMessage(text ?? "", images)
		return
	}

	await provider.postMessageToWebview({ type: "invoke", invoke: "sendMessage", text, images })
}

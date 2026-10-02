import type { EventBridge } from "@features/foundation"
import { healthcheck } from "@features/foundation"
import { getStore } from "@features/singleton"
import { sendSendMessageInvoke } from "@features/chat"

/**
 * Sends a message to the current task.
 * In headless/sandbox flows the webview may not be launched.
 */
export async function sendMessage(provider: EventBridge, text?: string, images?: string[]): Promise<void> {
	const currentTask = getStore().chat.activeTask

	// In headless/sandbox flows the webview may not be launched
	if (!healthcheck()) {
		if (!currentTask) {
			return
		}

		await currentTask.submitUserMessage(text ?? "", images)
		return
	}

	await sendSendMessageInvoke(provider, text, images)
}

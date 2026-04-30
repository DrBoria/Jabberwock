import { JabberwockEventName } from "@jabberwock/types"
import type { Task } from "../../../../task/Task"

/**
 * Submits a user message to the task.
 * Handles mode switching, provider profile changes, and routes the message
 * through the ask response handler.
 *
 * @param task - The Task instance
 * @param text - The message text
 * @param images - Optional array of image data URIs
 * @param mode - Optional mode to switch to
 * @param providerProfile - Optional provider profile to switch to
 */
export async function submitUserMessage(
	task: Task,
	text: string,
	images?: string[],
	mode?: string,
	providerProfile?: string,
): Promise<void> {
	try {
		text = (text ?? "").trim()
		images = images ?? []

		if (text.length === 0 && images.length === 0) {
			return
		}

		const provider = task.providerRef.deref()

		if (provider) {
			if (mode) {
				await provider.setMode(mode)
			}

			if (providerProfile) {
				await provider.setProviderProfile(providerProfile)

				// Update this task's API configuration to match the new profile
				// This ensures the parser state is synchronized with the selected model
				const newState = await provider.getState()
				if (newState?.apiConfiguration) {
					task.updateApiConfiguration(newState.apiConfiguration)
				}
			}

			task.emit(JabberwockEventName.TaskUserMessage, task.taskId)

			// Handle the message directly instead of routing through the webview.
			// This avoids a race condition where the webview's message state hasn't
			// hydrated yet, causing it to interpret the message as a new task request.
			task.handleWebviewAskResponse("messageResponse", text, images)
		} else {
			console.error("[Task#submitUserMessage] Provider reference lost")
		}
	} catch (error) {
		console.error("[Task#submitUserMessage] Failed to submit user message:", error)
	}
}

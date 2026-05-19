import type { Task } from "../Task"

/**
 * Submits a user message to the task.
 */
export async function submitUserMessage(
	task: Task,
	text?: string,
	images?: string[],
	mode?: string,
	providerProfile?: string,
): Promise<void> {
	if (typeof task.submitUserMessage === "function") {
		await task.submitUserMessage(text ?? "", images)
	}
}

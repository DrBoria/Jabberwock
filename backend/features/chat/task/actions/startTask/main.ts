import { getTask } from "@features/chat"
import { emitBroadcast } from "@features/chat/task/messages/actions/say"
import { armTaskRuntime } from "./registry"

export async function startTask(taskId: string, taskText?: string, images?: string[]): Promise<void> {
	const task = getTask(taskId)

	if (taskText) {
		// The user's initial message is user-originated content, not an agent
		// response. Broadcast it as a user message (say: "user_feedback") so the
		// frontend renders it as the user bubble ("You said"), consistent with
		// follow-ups and resumes (resumeTask.ts uses userBroadcast + "user_feedback").
		// Broadcasting it as agent "text" made the UI render the user's own
		// message as "<Mode> said" (e.g. "Architect said").
		await emitBroadcast("user", taskId, "user_feedback", taskText, images)
	}

	armTaskRuntime(task, taskText, images)
}

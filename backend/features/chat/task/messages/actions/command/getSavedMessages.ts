import { type Notification } from "@jabberwock/types"
import { readTaskMessages } from "@features/chat/task/messages/actions"

export function getSavedMessages(taskId: string, globalStoragePath: string): Promise<Notification[]> {
	const options = { taskId, globalStoragePath }
	return readTaskMessages(options)
}

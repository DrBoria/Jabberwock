import type { Task } from "../Task"
import type { MessageQueueService } from "../../../../core/message-queue/MessageQueueService"

type MessageQueueServiceWithSubmit = MessageQueueService & { dequeueAndSubmit?: () => void }

/**
 * Processes queued messages by dequeuing and submitting them.
 */
export function processQueuedMessages(task: Task): void {
	const service = task.messageQueueService as MessageQueueServiceWithSubmit
	if (service && typeof service.dequeueAndSubmit === "function") {
		service.dequeueAndSubmit()
	}
}

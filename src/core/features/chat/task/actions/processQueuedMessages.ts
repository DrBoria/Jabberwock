import { Task } from "../../../../task/Task"
import { createTimerQueueStore } from "../../../../features/foundation/timer-queue/store"

let _timerQueue: ReturnType<typeof createTimerQueueStore> | undefined

function getTimerQueue(): ReturnType<typeof createTimerQueueStore> {
	if (!_timerQueue) {
		_timerQueue = createTimerQueueStore()
	}
	return _timerQueue
}

/**
 * Process any queued messages by dequeuing and submitting them.
 * This ensures that queued user messages are sent when appropriate,
 * preventing them from getting stuck in the queue.
 */
export function processQueuedMessages(task: Task): void {
	try {
		const messageQueueService = task.messageQueueService
		if (!messageQueueService.isEmpty()) {
			const queued = messageQueueService.dequeueMessage()
			if (queued) {
				const queueTimeoutId = `process-queue-${Date.now()}`
				getTimerQueue().schedule({
					id: queueTimeoutId,
					label: "Process queued message",
					timeoutMs: 0,
				})
				getTimerQueue()
					.createAbortPromise(queueTimeoutId)
					.then(() => {
						task.submitUserMessage(queued.text, queued.images).catch((err: Error) =>
							console.error(`[Task] Failed to submit queued message:`, err),
						)
					})
			}
		}
	} catch (e) {
		console.error(`[Task] Queue processing error:`, e)
	}
}

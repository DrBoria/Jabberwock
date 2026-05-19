import { createTimerQueueStore } from "./store"

let _timerQueue: ReturnType<typeof createTimerQueueStore> | undefined

export function getTimerQueue(): ReturnType<typeof createTimerQueueStore> {
	if (!_timerQueue) {
		_timerQueue = createTimerQueueStore()
	}
	return _timerQueue
}

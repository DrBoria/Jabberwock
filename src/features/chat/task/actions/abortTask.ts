import { getBackendRootStore } from "@features/storeSingleton"

/**
 * Aborts a task.
 * Sets both the legacy Task state and the MST execution store to abort.
 */
import { getTask } from "./taskRegistry"

export function abortTask(taskId: string, isAbandoned?: boolean): void {
	const task = getTask(taskId)
	task._state.setAbort(true)
	task.cancelCurrentRequest()

	// Also set MST execution state to abort, so the reactive flow stops cleanly
	try {
		const store = getBackendRootStore()
		store.chat.setAbort(true)
		store.chat.setAbortReason(isAbandoned ? "abandoned" : "aborted_by_user")
	} catch {
		// Store may not be initialized yet during early startup
	}
}

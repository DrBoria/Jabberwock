import type { Task } from "../Task"

/**
 * Aborts a task.
 */
export function abortTask(task: Task, isAbandoned?: boolean): void {
	task.abort = true
	if (typeof task.cancelCurrentRequest === "function") {
		task.cancelCurrentRequest()
	}
}

/**
 * Disposes a task, cleaning up resources.
 */
export function dispose(task: Task): void {
	if (typeof task.dispose === "function") {
		task.dispose()
	}
}

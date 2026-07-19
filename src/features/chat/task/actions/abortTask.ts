import { getTask } from "./taskRegistry"

export function abortTask(taskId: string, _isAbandoned?: boolean): void {
	const task = getTask(taskId)
	task._state.setAbort(true)
	task.cancelCurrentRequest()
}

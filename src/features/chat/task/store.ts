import { types, getSnapshot } from "mobx-state-tree"
import { TaskEventListenersType, CallbackType, TaskRefType, TaskStackType } from "../../mst-custom-types"
import type { EventBridge } from "../../../core/webview/EventBridge"
import type { Task } from "./Task"
import { getState } from "../../storeSingleton"

// ─── Backward-compatible interface (derived from MST instance) ────────
export interface TaskState {
	currentTask: Task | null
	taskStack: Task[]
	taskEventListeners: Map<string, unknown[]>
	taskCreationCallback?: (instance: Record<string, unknown>) => void
}

// ─── MST Model ─────────────────────────────────────────────────────────
export const TaskSliceModel = types
	.model("TaskSlice", {
		currentTask: TaskRefType,
		taskStack: TaskStackType,
		taskEventListeners: TaskEventListenersType,
		taskCreationCallback: CallbackType,
	})
	.actions((self) => ({
		setCurrentTask(task: Task | null) {
			self.currentTask = task
		},
		setTaskStack(stack: Task[]) {
			self.taskStack = stack
		},
		pushToTaskStack(task: Task) {
			self.taskStack.push(task)
		},
		popTaskStack(): Task | undefined {
			return self.taskStack.pop()
		},
		addTaskEventListener(event: string, listener: unknown) {
			const listeners = self.taskEventListeners.get(event) || []
			listeners.push(listener)
			self.taskEventListeners.set(event, listeners)
		},
		setTaskCreationCallback(cb: (...args: unknown[]) => unknown) {
			self.taskCreationCallback = cb
		},
	}))

// ─── Backward-compatible init/get ──────────────────────────────────────

export function initTaskState(_provider: EventBridge): void {
	// MST default factory handles initialization
}

export function getTaskState(provider: EventBridge): TaskState {
	return getState(provider).chat.task as TaskState
}

import { types, Instance } from "mobx-state-tree"

/**
 * Lifecycle status for a task node.
 */
export type TaskStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled"

/**
 * Task node model — represents a single task in the task tree.
 */
export const TaskNode = types
	.model("TaskNode", {
		id: types.identifier,
		title: types.string,
		status: types.optional(
			types.enumeration<TaskStatus>(["pending", "in_progress", "completed", "failed", "cancelled"]),
			"pending",
		),
		parentId: types.maybe(types.string),
		createdAt: types.optional(types.number, () => Date.now()),
		startedAt: types.maybe(types.number),
		completedAt: types.maybe(types.number),
		error: types.maybe(types.string),
	})
	.actions((self) => ({
		markInProgress() {
			self.status = "in_progress"
			self.startedAt = Date.now()
		},
		markCompleted() {
			self.status = "completed"
			self.completedAt = Date.now()
		},
		markFailed(error?: string) {
			self.status = "failed"
			self.completedAt = Date.now()
			if (error) self.error = error
		},
		markCancelled() {
			self.status = "cancelled"
			self.completedAt = Date.now()
		},
		setTitle(title: string) {
			self.title = title
		},
	}))

/**
 * Task store — manages the lifecycle state of task nodes.
 */
export const TaskStore = types
	.model("TaskStore", {
		nodes: types.map(TaskNode),
		activeTaskId: types.maybe(types.string),
	})
	.views((self) => ({
		/**
		 * The currently active task node.
		 */
		get activeTask() {
			if (!self.activeTaskId) return null
			return self.nodes.get(self.activeTaskId) ?? null
		},

		/**
		 * All task nodes as an array.
		 */
		get allTasks() {
			return [...self.nodes.values()]
		},

		/**
		 * Tasks filtered by status.
		 */
		getTasksByStatus(status: TaskStatus) {
			return [...self.nodes.values()].filter((n) => n.status === status)
		},

		/**
		 * Get children of a given task node.
		 */
		getChildren(taskId: string) {
			return [...self.nodes.values()].filter((n) => n.parentId === taskId)
		},

		/**
		 * Get the root task (task with no parent).
		 */
		get rootTask() {
			return [...self.nodes.values()].find((n) => !n.parentId) ?? null
		},
	}))
	.actions((self) => ({
		/**
		 * Create a new task node.
		 */
		createTask(opts: { id: string; title: string; parentId?: string }): Instance<typeof TaskNode> {
			const node = TaskNode.create({
				id: opts.id,
				title: opts.title,
				parentId: opts.parentId,
			})
			self.nodes.put(node)
			return node
		},

		/**
		 * Set the active task by id.
		 */
		setActiveTask(taskId: string) {
			if (self.nodes.has(taskId)) {
				self.activeTaskId = taskId
			}
		},

		/**
		 * Remove a task node by id.
		 */
		removeTask(taskId: string) {
			if (self.activeTaskId === taskId) {
				self.activeTaskId = undefined
			}
			self.nodes.delete(taskId)
		},

		/**
		 * Clear all tasks.
		 */
		clear() {
			self.nodes.clear()
			self.activeTaskId = undefined
		},
	}))

export function createTaskStore() {
	return TaskStore.create({})
}

export type ITaskStore = Instance<typeof TaskStore>
export type ITaskNode = Instance<typeof TaskNode>

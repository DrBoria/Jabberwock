import { ChatModelDefinition } from "@features/chat/store"

export const ChatModelWithViews = ChatModelDefinition.views((self) => ({
	get activeTask(): import("../task/store").ITaskModel | undefined {
		return self.activeTaskId ? self.tasks.get(self.activeTaskId) : undefined
	},
	get hasActiveTask(): boolean {
		return self.activeTaskId !== undefined && self.tasks.has(self.activeTaskId)
	},
	get taskCount(): number {
		return self.tasks.size
	},
	getTask(taskId: string): import("../task/store").ITaskModel | undefined {
		return self.tasks.get(taskId)
	},
	hasTask(taskId: string): boolean {
		return self.tasks.has(taskId)
	},
}))

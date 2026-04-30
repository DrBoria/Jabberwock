import { Task } from "../../../task/Task"

export const findTaskById = (task, id) => {
	if (task.taskId === id) return task
	if (!task.childTasks) return undefined
	for (const child of task.childTasks) {
		const found = findTaskById(child, id)
		if (found) return found
	}
	return undefined
}

export const getTaskSummary = (task) => {
	const lastMessage = task.clineMessages.at(-1)
	return {
		taskId: task.taskId,
		mode: task.taskMode,
		isCompleted: task.isCompleted,
		isStreaming: task.isStreaming,
		messageCount: task.clineMessages.length,
		lastMessageType: lastMessage?.type,
		lastMessageAsk: lastMessage?.ask,
		lastMessageSay: lastMessage?.say,
		todoList: (task.todoList || []).map((t) => ({
			id: t.id,
			title: t.title,
			status: t.status,
			assignedTo: t.assignedTo,
		})),
	}
}

export const buildHierarchyData = (task) => {
	return {
		taskId: task.taskId,
		mode: task.taskMode,
		isCompleted: task.isCompleted,
		messageCount: task.clineMessages.length,
		children: (task.childTasks || []).map((t) => buildHierarchyData(t)),
	}
}

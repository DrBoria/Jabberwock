/**
 * Type definitions for integration tests
 */

export interface TaskNode {
	taskId: string
	mode: string
	title: string
	parentTaskId?: string
	children: string[]
	messages: Array<{ role: "user" | "assistant"; content: string; timestamp: number }>
	summary: string
	isStreaming: boolean
	status: "active" | "completed" | "failed"
}

export interface TaskPlan {
	initialTasks: Array<{
		id: string
		title: string
		description?: string
		assignedTo: string
		isAsync?: boolean
	}>
}

export interface AgentInfo {
	id: string
	name: string
	mode: string
	isAvailable: boolean
	currentTaskId?: string
	capabilities: string[]
}

export interface FileState {
	path: string
	content: string
	type: "html" | "image" | "text" | "unknown"
	createdAt: number
}

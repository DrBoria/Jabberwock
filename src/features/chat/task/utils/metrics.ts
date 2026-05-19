import type { TokenUsage, ToolName } from "@jabberwock/types"
import { JabberwockEventName, TaskStatus } from "@jabberwock/types"
import { getApiMetrics } from "../../../../shared/getApiMetrics"
import type { Task } from "../Task"

/**
 * Records a tool usage attempt for metrics tracking.
 */
export function recordToolUsage(task: Task, toolName: ToolName) {
	if (!task.toolUsage[toolName]) {
		task.toolUsage[toolName] = { attempts: 0, failures: 0 }
	}

	task.toolUsage[toolName].attempts++
}

/**
 * Records a tool error/failure for metrics tracking.
 */
export function recordToolError(task: Task, toolName: ToolName, error?: string) {
	if (!task.toolUsage[toolName]) {
		task.toolUsage[toolName] = { attempts: 0, failures: 0 }
	}

	task.toolUsage[toolName].failures++

	if (error) {
		task.emit(JabberwockEventName.TaskToolFailed, task.taskId, toolName, error)
	}
}

/**
 * Gets the current token usage from the API metrics.
 */
export function getTokenUsage(task: Task): TokenUsage {
	return getApiMetrics(task.combineMessages(task.clineMessages.slice(1)))
}

/**
 * Gets the current task status based on ask states.
 */
export function getTaskStatus(task: Task): TaskStatus {
	if (task.interactiveAsk) {
		return TaskStatus.Interactive
	}

	if (task.resumableAsk) {
		return TaskStatus.Resumable
	}

	if (task.idleAsk) {
		return TaskStatus.Idle
	}

	return TaskStatus.Running
}

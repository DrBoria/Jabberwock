import fs from "fs/promises"
import * as path from "path"
import * as os from "os"

import { type JabberwockAPIEvents, JabberwockEventName } from "@jabberwock/types"

import type { EventBridge, CurrentTask } from "../../core/webview/EventBridge"
import { lazyPostStateToWebview } from "./api-methods"
import { createOutputChannelLogger } from "../../utils/outputChannelLogger"

/**
 * Registers all task lifecycle listeners on the given provider.
 * Forwards task events to an external emitter (e.g., IPC broadcast)
 * and writes task lifecycle events to a file log.
 */
export function registerTaskLifecycleListeners(
	provider: EventBridge,
	emit: <K extends keyof JabberwockAPIEvents>(event: K, ...args: JabberwockAPIEvents[K]) => void,
	enableLogging = false,
): void {
	const logfile = enableLogging ? path.join(os.tmpdir(), "jabberwock-messages.log") : undefined

	provider.on(JabberwockEventName.TaskCreated, (task) => {
		// Task Lifecycle
		task.on(JabberwockEventName.TaskStarted, async () => {
			emit(JabberwockEventName.TaskStarted, task.taskId)
			await fileLog(logfile, `[${new Date().toISOString()}] taskStarted -> ${task.taskId}\n`)
		})

		task.on(JabberwockEventName.TaskCompleted, async (_, tokenUsage, toolUsage) => {
			emit(JabberwockEventName.TaskCompleted, task.taskId, tokenUsage, toolUsage, {
				isSubtask: !!task.parentTaskId,
			})

			await fileLog(
				logfile,
				`[${new Date().toISOString()}] taskCompleted -> ${task.taskId} | ${JSON.stringify(tokenUsage, null, 2)} | ${JSON.stringify(toolUsage, null, 2)}\n`,
			)
		})

		task.on(JabberwockEventName.TaskAborted, () => {
			emit(JabberwockEventName.TaskAborted, task.taskId)
		})

		task.on(JabberwockEventName.TaskFocused, () => {
			emit(JabberwockEventName.TaskFocused, task.taskId)
		})

		task.on(JabberwockEventName.TaskUnfocused, () => {
			emit(JabberwockEventName.TaskUnfocused, task.taskId)
		})

		task.on(JabberwockEventName.TaskActive, () => {
			emit(JabberwockEventName.TaskActive, task.taskId)
		})

		task.on(JabberwockEventName.TaskInteractive, () => {
			emit(JabberwockEventName.TaskInteractive, task.taskId)
		})

		task.on(JabberwockEventName.TaskResumable, () => {
			emit(JabberwockEventName.TaskResumable, task.taskId)
		})

		task.on(JabberwockEventName.TaskIdle, () => {
			emit(JabberwockEventName.TaskIdle, task.taskId)
		})

		// Subtask Lifecycle
		task.on(JabberwockEventName.TaskPaused, () => {
			emit(JabberwockEventName.TaskPaused, task.taskId)
		})

		task.on(JabberwockEventName.TaskUnpaused, () => {
			emit(JabberwockEventName.TaskUnpaused, task.taskId)
		})

		task.on(JabberwockEventName.TaskSpawned, (childTaskId) => {
			emit(JabberwockEventName.TaskSpawned, task.taskId, childTaskId)
		})

		task.on(JabberwockEventName.TaskDelegated, (childTaskId: string) => {
			emit(JabberwockEventName.TaskDelegated, task.taskId, childTaskId)
		})

		task.on(JabberwockEventName.TaskDelegationCompleted, (childTaskId: string, summary: string) => {
			emit(JabberwockEventName.TaskDelegationCompleted, task.taskId, childTaskId, summary)
		})

		task.on(JabberwockEventName.TaskDelegationResumed, (childTaskId: string) => {
			emit(JabberwockEventName.TaskDelegationResumed, task.taskId, childTaskId)
		})

		// Task Execution
		task.on(JabberwockEventName.Message, async (message) => {
			emit(JabberwockEventName.Message, { taskId: task.taskId, ...message })

			if (message.message.partial !== true) {
				await fileLog(logfile, `[${new Date().toISOString()}] ${JSON.stringify(message.message, null, 2)}\n`)
			}
		})

		task.on(JabberwockEventName.TaskModeSwitched, (taskId, mode) => {
			emit(JabberwockEventName.TaskModeSwitched, taskId, mode)
		})

		task.on(JabberwockEventName.TaskAskResponded, () => {
			emit(JabberwockEventName.TaskAskResponded, task.taskId)
		})

		task.on(JabberwockEventName.QueuedMessagesUpdated, (taskId, messages) => {
			emit(JabberwockEventName.QueuedMessagesUpdated, taskId, messages)
		})

		// Task Analytics
		task.on(JabberwockEventName.TaskToolFailed, (taskId, tool, error) => {
			emit(JabberwockEventName.TaskToolFailed, taskId, tool, error)
		})

		task.on(JabberwockEventName.TaskTokenUsageUpdated, (_, tokenUsage, toolUsage) => {
			emit(JabberwockEventName.TaskTokenUsageUpdated, task.taskId, tokenUsage, toolUsage)
		})

		// Let's go!
		emit(JabberwockEventName.TaskCreated, task.taskId)
	})
}

async function fileLog(logfile: string | undefined, message: string): Promise<void> {
	if (!logfile) {
		return
	}

	try {
		await fs.appendFile(logfile, message, "utf8")
	} catch (_) {
		// Logfile disabled on write failure
	}
}

// Re-export for convenience
export { createOutputChannelLogger }

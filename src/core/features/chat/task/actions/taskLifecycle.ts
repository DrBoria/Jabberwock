import * as path from "path"
import { JabberwockEventName } from "@jabberwock/types"
import { applySnapshot } from "mobx-state-tree"
import type { HistoryItem } from "@jabberwock/types"
import { TerminalRegistry } from "../../../../../integrations/terminal/TerminalRegistry"
import { OutputInterceptor } from "../../../../../integrations/terminal/OutputInterceptor"
import { getTaskDirectoryPath } from "../../../../../utils/storage"
import type { ClineProvider } from "../../../../webview/ClineProvider"
import type { Task } from "../../../../task/Task"

let clearTaskStackCounter = 0

/**
 * Aborts the task execution.
 * Sets abort flags, emits events, marks messages as non-partial,
 * disposes resources, and saves messages.
 *
 * @param task - The Task instance
 * @param isAbandoned - Whether the task is being abandoned (e.g., for delegation)
 */
export async function abortTask(task: Task, isAbandoned = false): Promise<void> {
	// Aborting task

	// Will stop any autonomously running promises.
	if (isAbandoned) {
		task.abandoned = true
	}

	task.abort = true

	// Reset consecutive error counters on abort (manual intervention)
	task.consecutiveNoToolUseCount = 0
	task.consecutiveNoAssistantMessagesCount = 0

	// Force final token usage update before abort event
	task.emitFinalTokenUsageUpdate()

	task.emit(JabberwockEventName.TaskAborted)
	// Mark all messages as not partial on abort so UI doesn't get stuck in streaming state
	for (const message of task.clineMessages) {
		if (message.partial) {
			message.partial = false
		}
	}

	try {
		dispose(task) // Call the centralized dispose method
	} catch (error) {
		console.error(`Error during task ${task.taskId}.${task.instanceId} disposal:`, error)
		// Don't rethrow - we want abort to always succeed
	}
	// Save the countdown message in the automatic retry or other content.
	try {
		// Save the countdown message in the automatic retry or other content.
		await task.saveClineMessages()
	} catch (error) {
		console.error(`Error saving messages during abort for task ${task.taskId}.${task.instanceId}:`, error)
	}
}

/**
 * Disposes all resources held by the task.
 * Cancels HTTP requests, removes listeners, releases terminals,
 * cleans up command output artifacts, and disposes controllers.
 *
 * @param task - The Task instance
 */
export function dispose(task: Task): void {
	console.log(`[Task#dispose] disposing task ${task.taskId}.${task.instanceId}`)

	// Cancel any in-progress HTTP request
	try {
		task.cancelCurrentRequest()
	} catch (error) {
		console.error("Error cancelling current request:", error)
	}

	// Remove provider profile change listener
	try {
		if (task.providerProfileChangeListener) {
			const provider = task.providerRef.deref()
			if (provider) {
				provider.off(JabberwockEventName.ProviderProfileChanged, task.providerProfileChangeListener)
			}
			task.providerProfileChangeListener = undefined
		}
	} catch (error) {
		console.error("Error removing provider profile change listener:", error)
	}

	// Dispose message queue and remove event listeners.
	try {
		if (task.messageQueueStateChangedHandler) {
			task.messageQueueService.removeListener("stateChanged", task.messageQueueStateChangedHandler)
			task.messageQueueStateChangedHandler = undefined
		}

		task.messageQueueService.dispose()
	} catch (error) {
		console.error("Error disposing message queue:", error)
	}

	// Remove all event listeners to prevent memory leaks.
	try {
		task.removeAllListeners()
	} catch (error) {
		console.error("Error removing event listeners:", error)
	}

	// Release any terminals associated with this task.
	try {
		// Release any terminals associated with this task.
		TerminalRegistry.releaseTerminalsForTask(task.taskId)
	} catch (error) {
		console.error("Error releasing terminals:", error)
	}

	// Cleanup command output artifacts
	getTaskDirectoryPath(task.globalStoragePath, task.taskId)
		.then((taskDir) => {
			const outputDir = path.join(taskDir, "command-output")
			return OutputInterceptor.cleanup(outputDir)
		})
		.catch((error) => {
			console.error("Error cleaning up command output artifacts:", error)
		})

	try {
		if (task.jabberwockIgnoreController) {
			task.jabberwockIgnoreController.dispose()
			task.jabberwockIgnoreController = undefined
		}
	} catch (error) {
		console.error("Error disposing JabberwockIgnoreController:", error)
		// This is the critical one for the leak fix.
	}

	try {
		task.fileContextTracker.dispose()
	} catch (error) {
		console.error("Error disposing file context tracker:", error)
	}

	try {
		// If we're not streaming then `abortStream` won't be called.
		if (task.isStreaming && task.diffViewProvider.isEditing) {
			task.diffViewProvider.revertChanges().catch(console.error)
		}
	} catch (error) {
		console.error("Error reverting diff changes:", error)
	}
}

/**
 * Adds a task to the provider's task stack.
 * Pushes the task onto the stack, emits TaskFocused event,
 * performs preparation tasks, and retrieves state asynchronously.
 */
export async function addClineToStack(provider: ClineProvider, task: Task): Promise<void> {
	provider.clineStack.push(task)
	task.emit("taskFocused" as any)

	// Perform special setup provider specific tasks.
	await provider.performPreparationTasks(task)

	// Fire state retrieval asynchronously so it doesn't block the
	// task-creation hot path (e.g. MCP tool handlers).
	provider
		.getState()
		.then((state: any) => {
			if (!state || typeof state.mode !== "string") {
				console.error("[ClineProvider] Failed to retrieve mode state during addClineToStack")
			}
		})
		.catch((err: Error) => {
			console.error("[ClineProvider] getState() failed during addClineToStack:", err)
		})
}

/**
 * Removes the top task from the provider's task stack.
 * Aborts the running task, cleans up event listeners, and repairs
 * delegation metadata on the parent task if applicable.
 */
export async function removeClineFromStack(
	provider: ClineProvider,
	options?: { skipDelegationRepair?: boolean },
): Promise<void> {
	if (provider.clineStack.length === 0) {
		return
	}

	// Pop the top Cline instance from the stack.
	let task = provider.clineStack.pop()

	if (task) {
		// Capture delegation metadata before abort/dispose, since abortTask(true)
		// is async and the task reference is cleared afterwards.
		const childTaskId = task.taskId
		const parentTaskId = task.parentTaskId

		task.emit("taskUnfocused" as any)

		try {
			// Abort the running task and set isAbandoned to true so
			// all running promises will exit as well.
			await task.abortTask(true)
		} catch (e: any) {
			provider.log(
				`[ClineProvider#removeClineFromStack] abortTask() failed ${task.taskId}.${task.instanceId}: ${e.message}`,
			)
		}

		// Remove event listeners before clearing the reference.
		const cleanupFunctions = provider.taskEventListeners.get(task)

		if (cleanupFunctions) {
			cleanupFunctions.forEach((cleanup) => cleanup())
			provider.taskEventListeners.delete(task)
		}

		// Make sure no reference kept, once promises end it will be
		// garbage collected.
		task = undefined as any

		// Delegation-aware parent metadata repair:
		if (parentTaskId && childTaskId && !options?.skipDelegationRepair) {
			try {
				const { historyItem: parentHistory } = await provider.getTaskWithId(parentTaskId)

				if (parentHistory.status === "delegated" && parentHistory.awaitingChildId === childTaskId) {
					await provider.updateTaskHistory({
						...parentHistory,
						status: "active",
						awaitingChildId: undefined,
					})
					provider.log(
						`[ClineProvider#removeClineFromStack] Repaired parent ${parentTaskId} metadata: delegated → active (child ${childTaskId} removed)`,
					)
				}
			} catch (err) {
				provider.log(
					`[ClineProvider#removeClineFromStack] Failed to repair parent metadata for ${parentTaskId} (non-fatal): ${
						err instanceof Error ? err.message : String(err)
					}`,
				)
			}
		}
	}

	await provider.postStateToWebview()
}

/**
 * Clears all tasks from the provider's task stack.
 * Aborts each task, cleans up event listeners, resets the chat store,
 * and posts the updated state to the webview.
 */
export async function clearTaskStack(provider: ClineProvider): Promise<void> {
	clearTaskStackCounter++
	if (clearTaskStackCounter % 10 === 0) {
		console.log(`[DEBUG: clearTaskStack] Called ${clearTaskStackCounter} times`)
	}
	while (provider.clineStack.length > 0) {
		const task = provider.clineStack.pop()
		if (task) {
			try {
				await task.abortTask(true)
				const cleanupFunctions = provider.taskEventListeners.get(task)
				if (cleanupFunctions) {
					cleanupFunctions.forEach((cleanup) => cleanup())
					provider.taskEventListeners.delete(task)
				}
			} catch (e: any) {
				provider.log(`[ClineProvider#clearTaskStack] Failed to cleanup task: ${e.message}`)
			}
		}
	}
	applySnapshot(provider.chatStore, { nodes: {} })
	await provider.postStateToWebview()
}

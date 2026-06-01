import { Anthropic } from "@anthropic-ai/sdk"
import { when } from "mobx"
import * as vscode from "vscode"

import { createTaskModel } from "./createTaskModel"
import type { EventBridge } from "../../../../features/foundation/webview/EventBridge"
import {
	JabberwockEventName,
	type ProviderSettings,
	type CreateTaskOptions,
	type JabberwockSettings,
} from "@jabberwock/types"
import type { ITaskModel } from "../../task/store"
import { checkExistKey } from "../../../../shared/checkExistApiConfig"
import { agentBroadcast } from "../../task/messages/actions/say"
import { getBackendRootStore } from "@features/storeSingleton"
import { registerTask, unregisterTask } from "./taskRegistry"
import { getTask } from "./taskRegistry"
import { Package } from "../../../../shared/package"
import { openClineInNewTab } from "../../../../activate/registerCommands"
import { postStateToWebview } from "../../../../features/foundation/window-manager/store"

/**
 * Registers a Task class instance with the new MST TaskManagerModel.
 * This bridges the legacy Task class with the new MST architecture.
 * The TaskManagerModel gets a lean TaskModel entry that references
 * the same task identity as the full Task class instance.
 */
function registerTaskWithStore(task: ITaskModel): void {
	try {
		const store = getBackendRootStore()
		store.chat.createTask({
			taskId: task.taskId,
			instanceId: task.instanceId,
			rootTaskId: task.rootTaskId ?? task.taskId,
			parentTaskId: task.parentTaskId,
			childTaskIds: [],
			taskNumber: task._state.taskNumber,
			workspacePath: task.workspacePath,
			apiConfiguration: task.apiConfiguration,
		})
	} catch {
		// Backend root store may not be initialized yet during early startup.
	}
}

/**
 * Starts a new task with the given text and images.
 * Uses the reactive event-driven flow directly (no loop, no recursion).
 */
export async function startTask(taskId: string, taskText?: string, images?: string[]): Promise<void> {
	const task = getTask(taskId)

	// Display the user's initial message in the chat as a visible say("text") message.
	if (taskText) {
		await agentBroadcast(taskId, "text", taskText, images)
	}

	// ── Reactive intent-driven execution (replaces the old processNextMessage loop) ─────
	const store = getBackendRootStore()

	// Register task in the module-level registry so handlers can look it up
	registerTask(taskId, task)

	// Create a UserMessageReceived intent — the IntentBus reaction picks it up
	// and dispatches to the registered handler which runs the API pipeline.
	const { IntentType, IntentStatus } = await import("@jabberwock/types")
	store.intentStore.createIntent({
		id: crypto.randomUUID(),
		type: IntentType.UserMessageReceived,
		payload: { taskId, text: taskText, images: images ?? [] },
		status: IntentStatus.Queued,
		createdAt: Date.now(),
	})

	// Wait until the execution model signals completion or abort
	await when(() => store.chat.isCompleted || store.chat.abort)

	// Cleanup
	unregisterTask(taskId)
}

/**
 * Creates a task with the given history item.
 */
export async function createTaskWithHistoryItem(provider: EventBridge, historyItem: unknown): Promise<void> {
	const currentTask = getBackendRootStore().chat.activeTask
	if (!currentTask) {
		throw new Error("No current task available to resume history item")
	}

	// At runtime, currentTask in the provider's task stack is a Task instance.
	// resumeTaskFromHistory exists on Task; use Reflect to access it
	// without type-level coupling to the ITaskModel interface.
	const resumeFn = Reflect.get(currentTask, "resumeTaskFromHistory")
	if (typeof resumeFn === "function") {
		await resumeFn.call(currentTask)
	}
}

/**
 * Alias for startTask, used by Task.start().
 */
export const start = startTask

/**
 * Creates a new task from the given provider with text/images/configuration.
 * Used by newTask handler and API to create/start tasks.
 * Uses the reactive event-driven flow directly (no loop, no recursion).
 */
export async function createTask(
	provider: EventBridge,
	text?: string,
	images?: string[],
	taskConfiguration?: { [key: string]: unknown },
	_extra?: unknown,
): Promise<ITaskModel> {
	const currentTask = getBackendRootStore().chat.activeTask
	if (currentTask && text) {
		// At runtime, currentTask in the provider's task stack is a Task instance.
		// Use the reactive intent-driven flow directly (replaces initiateTaskLoop).
		// ── Reactive intent-driven execution ─────
		const store = getBackendRootStore()
		const taskInstance = currentTask

		registerTask(taskInstance.taskId, taskInstance)

		// Create a UserMessageReceived intent — the IntentBus reaction picks it up
		const { IntentType, IntentStatus } = await import("@jabberwock/types")
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: IntentType.UserMessageReceived,
			payload: { taskId: taskInstance.taskId, text, images: images ?? [] },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})

		await when(() => store.chat.isCompleted || store.chat.abort)

		unregisterTask(taskInstance.taskId)

		return currentTask
	}

	// When no current task exists and text is provided, create a brand-new
	// Task instance and add it to the provider's task stack. Without this
	// branch the function silently returns undefined, and the calling handler
	// (e.g. newTask) only sends invoke:"newChat" — no task is ever created
	// and the webview stays on HomeScreen indefinitely.
	if (text) {
		// Get API configuration from the MST store directly instead of going through
		// getState() (which returns a GetStateResult with [key: string]: unknown index
		// signature that is structurally incompatible with ProviderSettings).
		// toProviderSettings() constructs a runtime-valid ProviderSettings value.
		const store = getBackendRootStore()
		const apiModel = store.settings.apiConfig
		const rawConfig = apiModel.toProviderSettings()
		// Type predicate: narrow { [key: string]: unknown } -> ProviderSettings.
		// The MST model's toProviderSettings() produces a value structurally identical
		// to ProviderSettings at runtime — the incompatibility is a TypeScript
		// structural typing issue (index signature vs. discriminated union).
		const isProviderSettings = (v: { [key: string]: unknown }): v is ProviderSettings =>
			typeof v === "object" && v !== null
		if (!isProviderSettings(rawConfig)) {
			throw new Error("Invalid provider settings from MST store")
		}
		const rawTaskId: unknown = taskConfiguration?.taskId
		const resolvedTaskId: string | undefined =
			typeof rawTaskId === "string" && rawTaskId.length > 0 ? rawTaskId : undefined
		const newTask = createTaskModel({
			provider,
			apiConfiguration: rawConfig,
			task: text,
			images: images ?? [],
			taskId: resolvedTaskId,
		})
		await startTask(newTask.taskId, text, images)
		return newTask
	}

	// When no text is provided, we can't create or return a task
	throw new Error("Cannot create task: no text provided")
}

/**
 * Starts a background subtask (non-blocking).
 * Unlike delegateParentAndOpenChild, the parent task continues running.
 */
export async function startBackgroundTask(
	provider: EventBridge,
	params: {
		parentTaskId: string
		message: string
		initialTodos?: unknown[]
		mode?: string
	},
): Promise<ITaskModel> {
	const { parentTaskId, message, initialTodos, mode } = params

	const parentTask = getBackendRootStore().chat.getTask(parentTaskId)
	if (!parentTask) {
		throw new Error(`[startBackgroundTask] Parent task ${parentTaskId} not found`)
	}

	const startSubtaskFn = Reflect.get(parentTask, "startSubtask")
	if (typeof startSubtaskFn !== "function") {
		throw new Error(`[startBackgroundTask] Parent task ${parentTaskId} has no startSubtask method`)
	}

	// Create a subtask using the parent task's startSubtask method
	const childTask = await startSubtaskFn.call(parentTask, message, initialTodos ?? [], mode ?? "")
	if (!childTask) {
		throw new Error(`[startBackgroundTask] Failed to create subtask for task ${parentTaskId}`)
	}

	return childTask
}

/**
 * API method: Starts a new task from an external API consumer.
 * Opens the task in a new tab or the current sidebar based on the `newTab` option.
 */
export async function startNewTask(
	provider: EventBridge,
	context: vscode.ExtensionContext,
	outputChannel: vscode.OutputChannel,
	options: {
		configuration: JabberwockSettings
		text?: string
		images?: string[]
		newTab?: boolean
	},
): Promise<string> {
	const { configuration, text, images, newTab } = options
	let targetProvider: EventBridge

	if (newTab) {
		await vscode.commands.executeCommand("workbench.action.files.revert")
		await vscode.commands.executeCommand("workbench.action.closeAllEditors")

		targetProvider = await openClineInNewTab({ context, outputChannel })
	} else {
		await vscode.commands.executeCommand(`${Package.name}.SidebarProvider.focus`)
		targetProvider = provider
	}

	// Remove any active task from MST store
	const activeTask = getBackendRootStore().chat.activeTask
	if (activeTask) {
		getBackendRootStore().chat.removeTask(activeTask.taskId)
	}
	await postStateToWebview(targetProvider)
	await targetProvider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
	await targetProvider.postMessageToWebview({ type: "invoke", invoke: "newChat", text, images })

	const taskOptions: CreateTaskOptions = {
		consecutiveMistakeLimit: Number.MAX_SAFE_INTEGER,
	}

	const task = await createTask(targetProvider, text, images, configuration ?? taskOptions, undefined)

	if (!task) {
		throw new Error("Failed to create task due to policy restrictions")
	}

	return task.taskId
}

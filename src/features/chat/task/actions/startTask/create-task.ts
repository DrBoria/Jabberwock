import { createTaskModel } from "@features/chat/task/actions/createTaskModel"
import type { ProviderHandle } from "@features/foundation/webview/EventBridge"
import type { Goal, ProviderSettings } from "@jabberwock/types"
import type { ITaskModel } from "@features/chat/task/store"
import { getBackendRootStore } from "@features/storeSingleton"
import { registerTask } from "@features/chat/task/actions/taskRegistry"
import { startTask } from "./start-task"
import { removeZombieTask, resolveTaskId, resolveGoals } from "./task-registry-helpers"
import { resumeActiveTask } from "./resume-active-task"

import type { IBackendRootStore } from "@features/store"

export async function createTaskWithHistoryItem(_provider: ProviderHandle, _historyItem: unknown): Promise<void> {
	const currentTask = getBackendRootStore().chat.activeTask

	if (!currentTask) {
		throw new Error("No current task available to resume history item")
	}

	const resumeFn = Reflect.get(currentTask, "resumeTaskFromHistory")

	if (typeof resumeFn === "function") {
		await resumeFn.call(currentTask)
	}
}

async function createFreshTask(
	store: IBackendRootStore,
	provider: ProviderHandle,
	text: string,
	images?: string[],
	taskConfiguration?: { [key: string]: unknown },
	goals?: Goal[],
): Promise<ITaskModel> {
	const apiModel = store.settings.apiConfig
	const rawConfig = apiModel.toProviderSettings()
	const isProviderSettings = (v: { [key: string]: unknown }): v is ProviderSettings =>
		typeof v === "object" && v !== null

	if (!isProviderSettings(rawConfig)) {
		throw new Error("Invalid provider settings from MST store")
	}

	const resolvedTaskId = resolveTaskId(taskConfiguration)
	const taskNumber = store.chat.tasks.size + 1
	const newTask = createTaskModel({
		provider,
		apiConfiguration: rawConfig,
		task: text,
		images: images ?? [],
		taskId: resolvedTaskId,
		taskNumber,
	})

	if (typeof newTask.setGoals === "function") {
		const resolvedGoals = resolveGoals(text, goals)

		if (resolvedGoals.length > 0) {
			newTask.setGoals(resolvedGoals)
		}
	}

	registerTask(newTask.taskId, newTask)
	await startTask(newTask.taskId, text, images)

	return newTask
}

export async function createTask(
	provider: ProviderHandle,
	text?: string,
	images?: string[],
	taskConfiguration?: { [key: string]: unknown },
	_extra?: unknown,
	goals?: Goal[],
): Promise<ITaskModel> {
	const store = getBackendRootStore()
	const currentTask = store.chat.activeTask

	if (currentTask && text) {
		if (!currentTask.isInitialized && !currentTask.isCompleted && !currentTask.isStreaming) {
			removeZombieTask(store, currentTask)
		} else if (currentTask.taskStatus === "active") {
			return resumeActiveTask(store, currentTask, provider, text, images)
		}
	}

	if (text) {
		return createFreshTask(store, provider, text, images, taskConfiguration, goals)
	}

	throw new Error("Cannot create task: no text provided")
}

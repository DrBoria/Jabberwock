import type { IBackendRootStore } from "@features/store"
import type { ITaskModel } from "@features/chat/task/store"
import type { ProviderHandle } from "@features/foundation/webview/EventBridge"
import type { Goal } from "@jabberwock/types"

export function removeZombieTask(store: IBackendRootStore, task: ITaskModel): void {
	console.warn(`[createTask] Zombie task detected: ${task.taskId}, removing`)
	store.chat.clearAllStreamingToolCalls()
	store.chat.removeTask(task.taskId)
}

export function resolveTaskId(taskConfiguration?: { [key: string]: unknown }): string | undefined {
	const rawTaskId: unknown = taskConfiguration?.taskId

	return typeof rawTaskId === "string" && rawTaskId.length > 0 ? rawTaskId : undefined
}

export function resolveGoals(text: string, goals?: Goal[]): Goal[] {
	if (goals && goals.length > 0) {
		return goals
	}

	const lines = text
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0)

	return lines.map((line, index) => ({
		id: crypto.randomUUID(),
		text: line,
		ts: Date.now(),
		version: 1,
		order: index,
	}))
}

export function ensureTaskVolatileDeps(taskInstance: ITaskModel, provider: ProviderHandle): void {
	if (!taskInstance.globalStoragePath) {
		taskInstance.setGlobalStoragePath(provider.context.globalStorageUri.fsPath)
	}

	if (!taskInstance.taskModeReady) {
		taskInstance.setTaskModeReady(Promise.resolve())
	}
}

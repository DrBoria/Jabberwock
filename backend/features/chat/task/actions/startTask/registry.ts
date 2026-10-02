import type { IBackendRootStore } from "@features/store"
import type { ITaskModel } from "@features/chat/task"
import type { ProviderHandle } from "@features/foundation"
import type { Goal } from "@jabberwock/types"
import { IntentType, IntentStatus } from "@jabberwock/types"
import { registerTask } from "@features/chat/task/actions"
import { getStore } from "@features/singleton"
import { setTimeMachineState } from "@features/foundation/time-machine"
import { getHostEditorService } from "@features/foundation"
import { virtualWorkspace } from "@features/foundation"
import { FileContextTracker } from "@features/foundation"

/**
 * Shared runtime-arming for any task that is about to receive a user message:
 * (re)registers the task in the registry, (re)creates the time-machine state
 * (diff view provider, virtual workspace, file-context tracker), and queues a
 * `UserMessageReceived` intent on the bus.
 *
 * Used by BOTH fresh task starts (startTask) and active-task resumes
 * (resumeActiveTask) — previously each of them carried a verbatim copy of this
 * block, which drifted apart and caused subtle start/resume differences.
 */
export function armTaskRuntime(task: ITaskModel, text?: string, images?: string[]): void {
	registerTask(task.taskId, task)

	// D4g-2 (batch 4): the diff view is created through the hostEditorService capability slot.
	// Hosts without the slot (e.g. the web server) have no diff view; the slot is optional so
	// task start/resume succeeds and getDiffViewProvider() degrades to an error only if a tool edits a file.
	const editorService = getHostEditorService()
	setTimeMachineState({
		diffViewProvider: editorService?.createDiffViewProvider(task.cwd),
		virtualWorkspace,
		fileContextTracker: FileContextTracker(task.taskId),
	})

	getStore().intentStore.createIntent({
		id: crypto.randomUUID(),
		type: IntentType.UserMessageReceived,
		payload: { taskId: task.taskId, text, images: images ?? [] },
		status: IntentStatus.Queued,
		createdAt: Date.now(),
	})
}

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

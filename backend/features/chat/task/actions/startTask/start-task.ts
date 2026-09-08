import { getTask, registerTask } from "@features/chat/task/actions/taskRegistry"
import { agentBroadcast } from "@features/chat/task/messages/actions/say"
import { getBackendRootStore } from "@features/storeSingleton"
import { getHostEditorService } from "@features/foundation/capabilities/registry"
import { virtualWorkspace } from "@features/foundation/time-machine/VirtualWorkspace"
import { FileContextTracker } from "@features/foundation/time-machine/file-context/FileContextTracker"
import { setTimeMachineState } from "@features/foundation/time-machine/actions/getTimeMachine"
import { IntentType, IntentStatus } from "@jabberwock/types"

export async function startTask(taskId: string, taskText?: string, images?: string[]): Promise<void> {
	const task = getTask(taskId)

	if (taskText) {
		await agentBroadcast(taskId, "text", taskText, images)
	}

	const store = getBackendRootStore()

	registerTask(taskId, task)

	// D4g-2 (batch 4): the diff view is created through the hostEditorService capability slot.
	// Hosts without the slot (e.g. the web server) have no diff view; the slot is optional so
	// task start succeeds and getDiffViewProvider() degrades to an error only if a tool edits a file.
	const editorService = getHostEditorService()
	setTimeMachineState({
		diffViewProvider: editorService?.createDiffViewProvider(task.cwd),
		virtualWorkspace,
		fileContextTracker: new FileContextTracker(taskId),
	})

	store.intentStore.createIntent({
		id: crypto.randomUUID(),
		type: IntentType.UserMessageReceived,
		payload: { taskId, text: taskText, images: images ?? [] },
		status: IntentStatus.Queued,
		createdAt: Date.now(),
	})
}

export const start = startTask

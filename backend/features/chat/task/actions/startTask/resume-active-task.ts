import { registerTask } from "@features/chat/task/actions/taskRegistry"
import type { ITaskModel } from "@features/chat/task/store"
import type { ProviderHandle } from "@features/foundation/webview/EventBridge"
import { setTimeMachineState } from "@features/foundation/time-machine/actions/getTimeMachine"
import { getHostEditorService } from "@features/foundation/capabilities/registry"
import { virtualWorkspace } from "@features/foundation/time-machine/VirtualWorkspace"
import { FileContextTracker } from "@features/foundation/time-machine/file-context/FileContextTracker"
import { IntentType, IntentStatus } from "@jabberwock/types"
import { ensureTaskVolatileDeps } from "./task-registry-helpers"

import type { IBackendRootStore } from "@features/store"

export function resumeActiveTask(
	store: IBackendRootStore,
	taskInstance: ITaskModel,
	provider: ProviderHandle,
	text: string,
	images?: string[],
): ITaskModel {
	registerTask(taskInstance.taskId, taskInstance)
	ensureTaskVolatileDeps(taskInstance, provider)
	// D4g-2 (batch 4): the diff view is created through the hostEditorService capability slot.
	// Hosts without the slot (e.g. the web server) have no diff view; the slot is optional so
	// task resume succeeds and getDiffViewProvider() degrades to an error only if a tool edits a file.
	const editorService = getHostEditorService()
	setTimeMachineState({
		diffViewProvider: editorService?.createDiffViewProvider(taskInstance.cwd),
		virtualWorkspace,
		fileContextTracker: new FileContextTracker(taskInstance.taskId),
	})
	store.intentStore.createIntent({
		id: crypto.randomUUID(),
		type: IntentType.UserMessageReceived,
		payload: { taskId: taskInstance.taskId, text, images: images ?? [] },
		status: IntentStatus.Queued,
		createdAt: Date.now(),
	})

	return taskInstance
}

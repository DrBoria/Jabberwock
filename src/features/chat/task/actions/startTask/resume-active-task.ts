import { registerTask } from "@features/chat/task/actions/taskRegistry"
import { getBackendRootStore } from "@features/storeSingleton"
import type { ITaskModel } from "@features/chat/task/store"
import type { ProviderHandle } from "@features/foundation/webview/EventBridge"
import { setTimeMachineState } from "@features/foundation/time-machine/actions/getTimeMachine"
import { DiffViewProvider } from "@integrations/editor/DiffViewProvider"
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
	setTimeMachineState({
		diffViewProvider: new DiffViewProvider(taskInstance.cwd, taskInstance),
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

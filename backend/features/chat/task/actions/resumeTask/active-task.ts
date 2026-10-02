import type { ITaskModel } from "@features/chat/task"
import type { ProviderHandle } from "@features/foundation"
import type { IBackendRootStore } from "@features/store"
import { armTaskRuntime, ensureTaskVolatileDeps } from "@features/chat"

export function resumeActiveTask(
	_store: IBackendRootStore,
	taskInstance: ITaskModel,
	provider: ProviderHandle,
	text: string,
	images?: string[],
): ITaskModel {
	ensureTaskVolatileDeps(taskInstance, provider)
	armTaskRuntime(taskInstance, text, images)

	return taskInstance
}

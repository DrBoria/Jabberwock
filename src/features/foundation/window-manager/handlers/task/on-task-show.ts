import { IntentType, historyItemSchema } from "@jabberwock/types"
import type { HistoryItem } from "@jabberwock/types"
import type { ProviderHandle } from "@features/foundation/webview/EventBridge"
import type { IntentBus, IntentHandler } from "@features/intents/bus"
import type { IIntentPayload } from "@features/intents/store"
import type { IntentHandlerContext } from "@features/intents/context"
import { postStateToWebview } from "@features/foundation/window-manager/store"
import { getTaskWithId } from "@features/hist/actions"
import { createTaskWithHistoryItem } from "@features/chat/task/actions/startTask"
import { resumeTaskFromHistory } from "@features/chat/task/actions/resumeTask"
import { createTaskModel } from "@features/chat/task/actions/createTaskModel"
import type { IBackendRootStore } from "@features/store"

/**
 * Handles foundation.task.show intent — shows a task by ID.
 */
export function registerOnTaskShow(bus: IntentBus): void {
	bus.register(IntentType.FoundationTaskShow, handleTaskShow)
}

async function handleTaskShow(
	intent: { id: string; type: string; payload: IIntentPayload },
	ctx: IntentHandlerContext,
): Promise<void> {
	const provider = ctx.provider as ProviderHandle | undefined
	if (!provider) return

	const payload = intent.payload as { text: string }
	const id = payload.text!
	const currentTask = ctx.rootStore.chat.activeTask

	const parentTaskId = await resolveTaskParent(id, currentTask ?? null, provider, ctx.rootStore)
	await notifyTaskNavigation(provider, parentTaskId)
}

async function resolveTaskParent(
	id: string,
	currentTask: { taskId: string; parentTaskId?: string } | null,
	provider: ProviderHandle,
	rootStore: IBackendRootStore,
): Promise<string | undefined> {
	if (id === currentTask?.taskId) {
		return currentTask?.parentTaskId
	}

	const { historyItem } = await getTaskWithId(id)
	const parentTaskId = historyItem?.parentTaskId

	if (currentTask) {
		await createTaskWithHistoryItem(provider, historyItem)
	} else if (historyItem) {
		await createTaskFromHistoryItem(rootStore, provider, historyItem as HistoryItem)
	}

	return parentTaskId
}

async function createTaskFromHistoryItem(
	rootStore: IBackendRootStore,
	provider: ProviderHandle,
	historyItem: HistoryItem,
): Promise<void> {
	const apiModel = rootStore.settings.apiConfig
	const rawConfig = apiModel.toProviderSettings()
	const taskNumber = rootStore.chat.tasks.size + 1
	const newTask = createTaskModel({
		provider,
		apiConfiguration: rawConfig,
		historyItem: historyItemSchema.parse(historyItem),
		taskNumber,
	})
	rootStore.chat.createTask({
		taskId: newTask.taskId,
		instanceId: newTask.instanceId,
		rootTaskId: newTask.rootTaskId ?? newTask.taskId,
		parentTaskId: newTask.parentTaskId,
		childTaskIds: [],
		taskNumber: newTask._state.taskNumber,
		workspacePath: newTask.workspacePath,
		apiConfiguration: newTask.apiConfiguration,
	})
	await resumeTaskFromHistory(newTask)

	await postStateToWebview(provider, {
		messages: newTask.messages,
		currentTaskItem: {
			id: newTask.taskId,
			ts: newTask.messages[0]?.ts ?? Date.now(),
			task: historyItem.task ?? "",
		},
	})
}

async function notifyTaskNavigation(provider: ProviderHandle, parentTaskId: string | undefined): Promise<void> {
	if (parentTaskId) {
		await provider.postMessageToWebview({
			type: "action",
			action: "switchTab",
			tab: "chat",
			values: { parentTaskId },
		})
	} else {
		await provider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
	}
}

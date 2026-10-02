import { IntentType } from "@jabberwock/types"
import type { ProviderHandle } from "@features/foundation"
import type { IntentBus, IIntentPayload, IntentHandlerContext } from "@features/intents"
import { getTaskWithId } from "@features/hist/actions"
import { createTaskFromHistoryItem } from "@features/chat/task/actions"
import { sendChatButtonClicked, sendSwitchTab } from "@features/chat"
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

	if (historyItem) {
		await createTaskFromHistoryItem(rootStore, provider, historyItem)
	}

	return parentTaskId
}

async function notifyTaskNavigation(provider: ProviderHandle, parentTaskId: string | undefined): Promise<void> {
	if (parentTaskId) {
		await sendSwitchTab(provider, { tab: "chat", values: { parentTaskId } })
	} else {
		await sendChatButtonClicked(provider)
	}
}

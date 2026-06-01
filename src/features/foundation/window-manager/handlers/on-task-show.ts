import { IntentType, historyItemSchema } from "@jabberwock/types"
import type { ProviderSettings, HistoryItem } from "@jabberwock/types"
import type { IntentBus } from "../../../intents/bus"
import { postStateToWebview } from "../store"
import { getTaskWithId } from "../../../history/actions"
import { createTaskWithHistoryItem } from "../../../chat/task/actions/startTask"
import { resumeTaskFromHistory } from "../../../chat/task/actions/resumeTask"
import { createTaskModel } from "../../../chat/task/actions/createTaskModel"

/**
 * Handles foundation.task.show intent — shows a task by ID.
 */
export function registerOnTaskShow(bus: IntentBus): void {
	bus.register(IntentType.FoundationTaskShow, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { text: string }
		const id = payload.text!
		const currentTask = ctx.rootStore.chat.activeTask
		let parentTaskId: string | undefined

		if (id !== currentTask?.taskId) {
			const { historyItem } = await getTaskWithId(provider, id)
			parentTaskId = historyItem?.parentTaskId

			if (currentTask) {
				await createTaskWithHistoryItem(provider, historyItem)
			} else if (historyItem) {
				const apiModel = ctx.rootStore.settings.apiConfig
				const rawConfig = apiModel.toProviderSettings()
				const isProviderSettings = (v: { [key: string]: unknown }): v is ProviderSettings =>
					typeof v === "object" && v !== null
				if (!isProviderSettings(rawConfig)) {
					throw new Error("Invalid provider settings from MST store")
				}
				const newTask = createTaskModel({
					provider,
					apiConfiguration: rawConfig,
					historyItem: historyItemSchema.parse(historyItem),
				})
				ctx.rootStore.chat.createTask({
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
		} else {
			parentTaskId = currentTask?.parentTaskId
		}

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
	})
}
